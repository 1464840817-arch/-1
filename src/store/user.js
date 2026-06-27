// src/store/user.js
// 全局用户状态 — reactive 单例 + localStorage 持久化
// 刷新页面后登录态、收藏、历史不丢失
// 写操作：API 优先，失败时降级到本地（离线可用）
import { reactive } from 'vue'
import { load, save } from '../utils/storage.js'
import { isAdmin, isSuperAdmin, canAccessAdmin } from './auth.js'
import { refreshToken, logout as apiLogout } from '../api/auth.js'
import {
  getCollections,
  addCollection as apiAddCollection,
  removeCollection as apiRemoveCollection,
} from '../api/collection.js'
import {
  getHistory,
  addHistoryRecord as apiAddHistory,
  clearHistory as apiClearHistory,
} from '../api/history.js'

const STORAGE_KEY = 'user'

// ==================== 默认值 ====================
const DEFAULTS = {
  name: '张工',
  account: 'ENG_20240601',
  avatar: '',
  role: '一线工程师',
  desc: '专注于西门子 PLC 与变频器调试，乐于分享工业自动化经验。',
  token: '',
  isLoggedIn: true,
  collectIds: [],
  historyIds: [],
}

// ==================== 初始化：localStorage 优先 ====================
function loadPersistedState() {
  const stored = load(STORAGE_KEY, {})
  // 合并存储值与默认值（新字段用默认值兜底）
  const merged = { ...DEFAULTS, ...stored }
  // 确保数组字段不丢失
  if (!Array.isArray(merged.collectIds)) merged.collectIds = []
  if (!Array.isArray(merged.historyIds)) merged.historyIds = []
  return merged
}

const persisted = loadPersistedState()

export const userStore = reactive({
  name: persisted.name,
  account: persisted.account,
  avatar: persisted.avatar,
  role: persisted.role,
  desc: persisted.desc,
  token: persisted.token,
  isLoggedIn: persisted.isLoggedIn,
  collectIds: persisted.collectIds,
  historyIds: persisted.historyIds,
  _ready: false,  // 标记是否已尝试从 API 加载
})

// ==================== 持久化存储 ====================
function persistUser() {
  save(STORAGE_KEY, {
    name: userStore.name,
    account: userStore.account,
    avatar: userStore.avatar,
    role: userStore.role,
    desc: userStore.desc,
    token: userStore.token,
    isLoggedIn: userStore.isLoggedIn,
    collectIds: [...userStore.collectIds],
    historyIds: [...userStore.historyIds],
  })
}

// ==================== 初始化：从 API 同步最新数据 ====================
export async function initUserData() {
  // 并行拉取，互不阻塞
  const [collectResult, historyResult] = await Promise.allSettled([
    getCollections().catch(() => null),
    getHistory().catch(() => null),
  ])

  // 收藏
  if (collectResult.status === 'fulfilled' && Array.isArray(collectResult.value)) {
    userStore.collectIds = collectResult.value
  }
  // 如果 API 不可用，保留本地已有的 collectIds

  // 历史
  if (historyResult.status === 'fulfilled' && Array.isArray(historyResult.value)) {
    userStore.historyIds = historyResult.value
  }

  userStore._ready = true
  persistUser()
}

// ==================== 会话恢复 ====================
let _sessionReady = false

/**
 * 启动时尝试恢复登录态
 * - 无 token → 跳过，由路由守卫引导登录
 * - 有 token → 调用 /auth/refresh 换取新 token
 *   - 成功 → 更新 token，用户无感登录
 *   - 失败 → 清除登录态，下次访问跳转登录页
 * - demo-token（mock 模式）→ 跳过刷新，直接放行
 *
 * @returns {Promise<boolean>} 是否需要跳转登录页
 */
export async function restoreSession() {
  if (_sessionReady) return true

  // 无 token → 未登录
  if (!userStore.token) {
    userStore.isLoggedIn = false
    _sessionReady = true
    persistUser()
    return false
  }

  // demo 模式：token 为占位符时跳过刷新（后端不可用时的降级方案）
  if (userStore.token === 'demo-token') {
    userStore.isLoggedIn = true
    _sessionReady = true
    persistUser()
    return true
  }

  // 真实 token：尝试刷新
  try {
    const result = await refreshToken()
    if (result?.token) {
      userStore.token = result.token
      userStore.isLoggedIn = true
      _sessionReady = true
      persistUser()
      return true
    }
  } catch (err) {
    // token 过期或网络不可用
    console.warn('会话恢复失败:', err.message || err)
  }

  // 刷新失败：清除登录态
  userStore.token = ''
  userStore.isLoggedIn = false
  _sessionReady = true
  persistUser()
  return false
}

// ==================== 登录状态 ====================
/**
 * 登录成功后设置用户状态
 * @param {{ name: string, token: string, role: string }} loginData
 */
export function setLoginState({ name, token, role }) {
  _sessionReady = true
  userStore.name = name
  userStore.role = role || '一线工程师'
  userStore.token = token
  userStore.isLoggedIn = true
  persistUser()
}

/** 登出 — 清除登录状态，同时通知后端销毁 refresh token */
export async function clearLoginState() {
  userStore.token = ''
  userStore.isLoggedIn = false
  persistUser()
  // 通知后端登出（销毁 refresh token），失败不阻塞
  try { await apiLogout() } catch { /* 网络不可用或已过期，忽略 */ }
}

// ==================== 用户资料 ====================
/** 更新用户资料（ProfileEdit 保存时调用） */
export function updateUser(partial) {
  Object.assign(userStore, partial)
  persistUser()
}

// ==================== 收藏 ====================
/**
 * 切换收藏状态 — API 优先，失败时降级本地
 * @param {number} articleId
 * @returns {Promise<boolean>} 操作后是否已收藏
 */
export async function toggleCollect(articleId) {
  const idx = userStore.collectIds.indexOf(articleId)
  const wasCollected = idx >= 0

  // 先更新本地（乐观更新，UI 立即响应）
  if (wasCollected) {
    userStore.collectIds.splice(idx, 1)
  } else {
    userStore.collectIds.push(articleId)
  }
  persistUser()

  // 异步同步到服务端（失败时回滚）
  try {
    if (wasCollected) {
      await apiRemoveCollection(articleId)
    } else {
      await apiAddCollection(articleId)
    }
  } catch (err) {
    if (err.status !== 0) {
      console.warn('收藏同步失败:', err.message || err)
    }
  }

  return !wasCollected
}

/**
 * 同步检查是否已收藏（直接读本地缓存，无需 API）
 */
export function isCollected(articleId) {
  return userStore.collectIds.includes(articleId)
}

// ==================== 浏览历史 ====================
/**
 * 添加浏览历史 — API 优先，失败时降级本地
 * @param {number} articleId
 */
export async function addHistory(articleId) {
  // 去重：如果已存在，移到最前面
  const idx = userStore.historyIds.indexOf(articleId)
  if (idx >= 0) {
    userStore.historyIds.splice(idx, 1)
  }
  userStore.historyIds.unshift(articleId)

  // 只保留最近 200 条
  if (userStore.historyIds.length > 200) {
    userStore.historyIds.length = 200
  }
  persistUser()

  // 异步同步到服务端
  try {
    await apiAddHistory(articleId)
  } catch (err) {
    if (err.status !== 0) {
      console.warn('浏览历史同步失败:', err.message || err)
    }
  }
}

/**
 * 清空浏览历史
 */
export async function clearHistory() {
  userStore.historyIds.length = 0
  persistUser()

  try {
    await apiClearHistory()
  } catch (err) {
    if (err.status !== 0) {
      console.warn('清空历史同步失败:', err.message || err)
    }
  }
}

// ==================== 角色权限快捷方法 ====================
/** 当前用户是否为管理员及以上 */
export function currentIsAdmin() {
  return isAdmin(userStore.role)
}

/** 当前用户是否为超级管理员 */
export function currentIsSuperAdmin() {
  return isSuperAdmin(userStore.role)
}

/** 当前用户能否访问管理中心 */
export function currentCanAccessAdmin() {
  return canAccessAdmin(userStore.role)
}
