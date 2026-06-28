// src/store/friends.js
// 好友列表状态 — reactive 单例 + localStorage 持久化
// API 优先，失败静默降级到本地
import { reactive } from 'vue'
import { load, save } from '../utils/storage.js'
import {
  getFriendList,
  getFriendRequests,
  addFriend as apiAddFriend,
  handleFriendRequest as apiHandleRequest,
  removeFriend as apiRemoveFriend,
} from '../api/friend.js'

const STORAGE_KEY = 'friends'

// ==================== 种子数据 ====================
const SEED_FRIENDS = [
  { id: 3, name: '李工', account: 'ENG_20230512', role: '一线工程师', department: '自动化部', isOnline: true },
  { id: 4, name: '王工', account: 'ENG_20240108', role: '一线工程师', department: '设备维护部', isOnline: false },
  { id: 5, name: '赵工', account: 'ENG_20231105', role: '一线工程师', department: '设备部', isOnline: true },
]

// ==================== 初始化：localStorage 优先 ====================
function loadPersistedFriends() {
  const stored = load(STORAGE_KEY, null)
  // 剔除旧版种子数据（假 ID ≥100），避免跳转用户详情 404
  if (stored && Array.isArray(stored) && stored.length > 0 && !stored.some(f => f.id >= 100)) {
    return stored
  }
  // API 未返回或数据来源为旧种子时，写入新版种子数据对齐数据库
  save(STORAGE_KEY, SEED_FRIENDS)
  return JSON.parse(JSON.stringify(SEED_FRIENDS))
}

const persisted = loadPersistedFriends()

export const friendStore = reactive({
  list: persisted,
  requests: [],       // 待处理的好友请求
  _ready: false,
})

// ==================== 持久化 ====================
function persistFriends() {
  save(STORAGE_KEY, [...friendStore.list])
}

// ==================== 初始化：从 API 同步 ====================
export async function initFriendData() {
  try {
    const remote = await getFriendList()
    if (Array.isArray(remote) && remote.length > 0) {
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
