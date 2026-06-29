// src/api/article.js
// 文章相关 API — 后续对接后端时修改此文件即可
import { request } from './client.js'

/**
 * 获取当前用户已发布的文章列表
 * @returns {Promise<Array>} 文章列表
 */
export function getMyPosts() {
  return request('/user/posts')
}

/**
 * 发布新文章
 * @param {object} data - 文章数据（type, title, desc, steps, tags）
 * @returns {Promise<object>} 创建后的文章对象
 */
export function createArticle(data) {
  return request('/articles', {
    method: 'POST',
    body: data,
  })
}

/**
 * 获取单篇文章详情
 * @param {number} id
 * @returns {Promise<object>}
 */
export function getArticle(id) {
  return request(`/articles/${id}`)
}

/**
 * 更新文章
 * @param {number} id
 * @param {object} data
 * @returns {Promise<object>}
 */
export function updateArticle(id, data) {
  return request(`/articles/${id}`, {
    method: 'PUT',
    body: data,
  })
}

/**
 * 删除文章
 * @param {number} id
 * @returns {Promise<void>}
 */
export function deleteArticle(id) {
  return request(`/articles/${id}`, {
    method: 'DELETE',
  })
}

/**
 * 浏览计数 +1
 * @param {number} id
 * @returns {Promise<void>}
 */
export function incrementView(id) {
  return request(`/articles/${id}/view`, { method: 'POST' }).catch(() => {})
}

/**
 * 点赞文章
 * @param {number} id
 * @returns {Promise<{ liked: boolean, likes: number }>}
 */
export function likeArticle(id) {
  return request(`/articles/${id}/like`, { method: 'POST' })
}

/**
 * 分享文章给好友（向好友发送消息通知）
 * @param {number} id - 文章 ID
 * @param {number} friendId - 好友用户 ID
 * @returns {Promise<object>}
 */
export function shareArticle(id, friendId) {
  return request(`/articles/${id}/share`, {
    method: 'POST',
    body: { friendId },
  })
}

/**
 * 获取当前用户已下架的文章列表
 * @returns {Promise<object>} { list, total, page, pageSize }
 */
export function getDelistedPosts() {
  return request('/user/posts?status=delisted')
}

/**
 * 恢复已下架文章
 * @param {number} id
 * @returns {Promise<object>}
 */
export function restoreArticle(id) {
  return request(`/articles/${id}/restore`, { method: 'PUT' })
}

/**
 * 永久删除已下架文章（物理删除，不可恢复）
 * @param {number} id
 * @returns {Promise<object>}
 */
export function permanentDeleteArticle(id) {
  return request(`/articles/${id}/permanent`, { method: 'DELETE' })
}
