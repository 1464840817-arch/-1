// src/store/friends.js
// 好友列表状态 — reactive 单例 + localStorage 持久化
// API 优先，失败静默降级到本地
import { reactive } from 'vue'
import { load, save } from '../utils/storage.js'
import {
  getFriendList,
  addFriend as apiAddFriend,
  removeFriend as apiRemoveFriend,
} from '../api/friend.js'

const STORAGE_KEY = 'friends'

// ==================== 种子数据 ====================
const SEED_FRIENDS = [
  { id: 101, name: '李工', account: 'ENG_20230512', role: '高级工程师', department: '自动化部', isOnline: true },
  { id: 102, name: '王工', account: 'ENG_20240108', role: '一线工程师', department: '设备维护部', isOnline: false },
  { id: 103, name: '赵工', account: 'ENG_20220915', role: '技术支持', department: '技术支持部', isOnline: true },
]

// ==================== 初始化：localStorage 优先 ====================
function loadPersistedFriends() {
  const stored = load(STORAGE_KEY, null)
  if (stored && Array.isArray(stored) && stored.length > 0) {
    return stored
  }
  save(STORAGE_KEY, SEED_FRIENDS)
  return JSON.parse(JSON.stringify(SEED_FRIENDS))
}

const persisted = loadPersistedFriends()

export const friendStore = reactive({
  list: persisted,
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

// ==================== 操作 ====================

/** 检查是否已是好友 */
export function isFriend(userId) {
  return friendStore.list.some(f => f.id === userId)
}

/**
 * 添加好友 — API 优先，失败降级本地
 * @param {{ id:number, name:string, account:string, role:string, department:string, isOnline:boolean }} user
 * @returns {Promise<boolean>} 是否添加成功
 */
export async function addToFriends(user) {
  if (isFriend(user.id)) return false

  const entry = {
    id: user.id,
    name: user.name,
    account: user.account,
    role: user.role || '',
    department: user.department || '',
    isOnline: user.isOnline || false,
  }

  // 乐观更新
  friendStore.list.push(entry)
  persistFriends()

  // 异步同步
  try {
    await apiAddFriend(user.id)
  } catch { /* 静默降级 */ }

  return true
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
