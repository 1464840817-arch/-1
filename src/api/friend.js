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
 * 获取待处理的好友请求（别人发给我的）
 * @returns {Promise<Array<{messageId:number, senderId:number, sender:string, content:string,
 *   account:string, role:string, department:string, avatar:string, isOnline:boolean, createdAt:string}>>}
 */
export function getFriendRequests() {
  return request('/user/friends/requests')
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
 * 添加好友（发送好友请求）
 * @param {number} userId - 要添加的用户 ID
 * @returns {Promise<{ok:boolean, status:'requested'|'accepted'|'already_requested'}>}
 */
export function addFriend(userId) {
  return request('/user/friends', {
    method: 'POST',
    body: { userId },
  })
}

/**
 * 处理好友请求（接受或拒绝）
 * @param {number} userId - 发起请求的用户 ID
 * @param {'accept'|'decline'} action - 处理动作
 * @returns {Promise<{ok:boolean, action:string}>}
 */
export function handleFriendRequest(userId, action) {
  return request('/user/friends/handle', {
    method: 'POST',
    body: { userId, action },
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
