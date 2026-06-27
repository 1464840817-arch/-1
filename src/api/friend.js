// src/api/friend.js
// 好友相关 API — 后续对接后端时修改此文件即可
import { request } from './client.js'

/**
 * 获取当前用户的好友列表
 * @returns {Promise<Array<{id:number, name:string, account:string, role:string, department:string, isOnline:boolean}>>}
 */
export function getFriendList() {
  return request('/user/friends')
}

/**
 * 搜索用户（按工号、姓名、手机号）
 * @param {string} keyword
 * @returns {Promise<Array>}
 */
export function searchUsers(keyword) {
  return request(`/user/search?q=${encodeURIComponent(keyword)}`)
}

/**
 * 添加好友
 * @param {number} userId - 要添加的用户 ID
 * @returns {Promise<object>}
 */
export function addFriend(userId) {
  return request('/user/friends', {
    method: 'POST',
    body: { userId },
  })
}

/**
 * 删除好友
 * @param {number} friendId - 好友记录 ID（或用户 ID）
 * @returns {Promise<void>}
 */
export function removeFriend(friendId) {
  return request(`/user/friends/${friendId}`, {
    method: 'DELETE',
  })
}

/**
 * 获取平台管理员列表
 * @returns {Promise<Array<{id:number, name:string, account:string, role:string, phone?:string, isOnline:boolean}>>}
 */
export function getAdminList() {
  return request('/tenant/admins')
}
