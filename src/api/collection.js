// src/api/collection.js
// 收藏相关 API — 后续对接后端时修改此文件即可
import { request } from './client.js'

/**
 * 获取用户收藏列表
 * @returns {Promise<number[]>} 收藏的文章 ID 数组
 */
export function getCollections() {
  return request('/user/collections')
}

/**
 * 添加收藏
 * @param {number} articleId
 */
export function addCollection(articleId) {
  return request('/user/collections', {
    method: 'POST',
    body: { articleId },
  })
}

/**
 * 取消收藏
 * @param {number} articleId
 */
export function removeCollection(articleId) {
  return request(`/user/collections/${articleId}`, {
    method: 'DELETE',
  })
}
