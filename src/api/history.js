// src/api/history.js
// 浏览历史相关 API — 后续对接后端时修改此文件即可
import { request } from './client.js'

/**
 * 获取用户浏览历史
 * @returns {Promise<number[]>} 浏览过的文章 ID 数组（按时间倒序）
 */
export function getHistory() {
  return request('/user/history')
}

/**
 * 添加一条浏览记录
 * @param {number} articleId
 */
export function addHistoryRecord(articleId) {
  return request('/user/history', {
    method: 'POST',
    body: { articleId },
  })
}

/**
 * 清空浏览历史
 */
export function clearHistory() {
  return request('/user/history', {
    method: 'DELETE',
  })
}
