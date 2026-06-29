// src/store/friends.js
// 好友列表状态 — reactive 单例 + localStorage 持久化
// API 优先，失败静默降级到本地
import { reactive } from 'vue'
import { load, save } from '../utils/storage.js'
import { userStore } from './user.js'
import {
  getFriendList,
  getFriendRequests,
  addFriend as apiAddFriend,
  handleFriendRequest as apiHandleRequest,
  removeFriend as apiRemoveFriend,
} from '../api/friend.js'

const STORAGE_KEY_BASE = 'friends'

// 按用户 account 生成存储键，避免多标签页不同账号共享 localStorage 导致互相覆盖
// 模块初始化阶段 userStore 可能尚未赋值（跨模块 TDZ），降级回退到共享键
function getStorageKey() {
  let account = ''
  try {
    // 运行时：优先读内存中的 userStore（本标签页当前用户，不受跨标签页影响）
    account = userStore.account
  } catch {
    // 模块初始化阶段：userStore 在 TDZ 中，忽略
  }
  if (!account) {
    // 降级：从共享键读取最后登录的账号
    const shared = load('user', {})
    account = shared.account || ''
  }
  if (!account) {
    // 最终降级：无任何登录记录时使用默认账号
    return `${STORAGE_KEY_BASE}_default`
  }
  return `${STORAGE_KEY_BASE}_${account}`
}

// ==================== 初始化：localStorage 优先 ====================
function loadPersistedFriends() {
  const stored = load(getStorageKey(), null)
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored
  }
  return []
}

const persisted = loadPersistedFriends()

export const friendStore = reactive({
  list: persisted,
  requests: [],       // 待处理的好友请求
  _ready: false,
})

// ==================== 持久化 ====================
function persistFriends() {
  save(getStorageKey(), [...friendStore.list])
}

// ==================== 初始化：从 API 同步 ====================
export async function initFriendData() {
  try {
    const remote = await getFriendList()
    if (Array.isArray(remote)) {
      // 始终以 API 数据为准（包括空数组），防止模块初始化阶段
      // 用错误账号加载的 localStorage 数据污染当前用户的好友列表
      friendStore.list.length = 0
      friendStore.list.push(...remote)
    }
  } catch {
    // API 不可用时保留本地数据
  } finally {
    friendStore._ready = true
    persistFriends()
  }
}

// ==================== 加载好友请求 ====================
export async function loadFriendRequests() {
  try {
    const data = await getFriendRequests()
    friendStore.requests = Array.isArray(data) ? data : []
  } catch {
    friendStore.requests = []
  }
}

// ==================== 操作 ====================

/** 检查是否已是好友 */
export function isFriend(userId) {
  return friendStore.list.some(f => f.id === userId)
}

/**
 * 添加好友（发送好友请求）
 * @param {{ id:number, name:string, account:string, role:string, department:string, isOnline:boolean }} user
 * @returns {Promise<{ok:boolean, status:string}>}
 */
export async function addToFriends(user) {
  if (isFriend(user.id)) return { ok: false, status: 'already_friend' }

  try {
    const res = await apiAddFriend(user.id)

    if (res.status === 'accepted') {
      // 双方互相请求 → 直接成为好友
      const entry = {
        id: user.id,
        name: user.name,
        account: user.account,
        role: user.role || '',
        department: user.department || '',
        isOnline: user.isOnline || false,
      }
      friendStore.list.push(entry)
      persistFriends()
    }

    return { ok: true, status: res.status }
  } catch {
    // API 不可用时降级为本地直接添加
    const entry = {
      id: user.id,
      name: user.name,
      account: user.account,
      role: user.role || '',
      department: user.department || '',
      isOnline: user.isOnline || false,
    }
    friendStore.list.push(entry)
    persistFriends()
    return { ok: true, status: 'local_only' }
  }
}

/**
 * 接受好友请求
 * @param {number} userId - 发起请求的用户 ID
 * @returns {Promise<boolean>}
 */
export async function acceptFriendRequest(userId) {
  try {
    await apiHandleRequest(userId, 'accept')
  } catch {
    // 静默降级：即使 API 失败也乐观更新
  }

  // 从请求列表中找到该用户并移入好友列表
  const req = friendStore.requests.find(r => r.senderId === userId)
  if (req) {
    friendStore.requests = friendStore.requests.filter(r => r.senderId !== userId)
    friendStore.list.push({
      id: req.senderId,
      name: req.sender,
      account: req.account,
      role: req.role || '',
      department: req.department || '',
      isOnline: req.isOnline || false,
    })
  }
  persistFriends()
  return true
}

/**
 * 拒绝好友请求
 * @param {number} userId - 发起请求的用户 ID
 */
export async function declineFriendRequest(userId) {
  try {
    await apiHandleRequest(userId, 'decline')
  } catch {
    // 静默降级
  }

  // 从请求列表移除
  friendStore.requests = friendStore.requests.filter(r => r.senderId !== userId)
}

/**
 * 删除好友 — API 优先，失败降级本地
 * @param {number} friendId
 */
export async function removeFromFriends(friendId) {
  const idx = friendStore.list.findIndex(f => f.id === friendId)
  if (idx < 0) return

  // 乐观更新
  friendStore.list.splice(idx, 1)
  persistFriends()

  // 异步同步
  try {
    await apiRemoveFriend(friendId)
  } catch { /* 静默降级 */ }
}
