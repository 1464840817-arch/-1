// src/api/message.js
// 消息通知 API — 后续对接后端时确认接口路径即可
import { request } from './client.js'

/**
 * 获取消息列表
 * @returns {Promise<Array>}
 */
export function getMessages() {
  return request('/user/messages')
}

/**
 * 标记消息为已读
 * @param {number|number[]} messageIds — 单个 ID 或 ID 数组
 * @returns {Promise<void>}
 */
export function markAsRead(messageIds) {
  return request('/user/messages/read', {
    method: 'PUT',
    body: { ids: Array.isArray(messageIds) ? messageIds : [messageIds] },
  })
}

/**
 * 标记全部消息为已读
 * @returns {Promise<void>}
 */
export function markAllAsRead() {
  return request('/user/messages/read-all', { method: 'PUT' })
}

/**
 * 获取通知消息列表（排除私聊）
 * @param {object} [params] - 分页参数
 * @returns {Promise<{list:Array, total:number, unreadCount:number}>}
 */
export function getNotifications(params = {}) {
  const { page = 1, pageSize = 20 } = params
  return request(`/user/messages?not=chat&page=${page}&pageSize=${pageSize}`)
}

/**
 * 获取私聊消息列表
 * @param {object} [params] - 分页参数
 * @returns {Promise<{list:Array, total:number, unreadCount:number}>}
 */
export function getChatMessages(params = {}) {
  const { page = 1, pageSize = 50 } = params
  return request(`/user/messages?type=chat&page=${page}&pageSize=${pageSize}`)
}

/**
 * 获取通知未读数（通知入口小红点用）
 * @returns {Promise<{count:number}>}
 */
export function getNotificationCount() {
  return request('/user/notifications/count')
}

/**
 * 删除单条消息
 * @param {number} id - 消息 ID
 * @returns {Promise<void>}
 */
export function deleteMessage(id) {
  return request(`/user/messages/${id}`, { method: 'DELETE' })
}
