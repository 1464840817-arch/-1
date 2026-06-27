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
 * 删除单条消息
 * @param {number} id - 消息 ID
 * @returns {Promise<void>}
 */
export function deleteMessage(id) {
  return request(`/user/messages/${id}`, { method: 'DELETE' })
}
