// src/api/comment.js
// 评论 API — 后续对接后端时确认接口路径即可
import { request } from './client.js'

/**
 * 获取文章评论列表
 * @param {number} articleId
 * @returns {Promise<Array>}
 */
export function getComments(articleId) {
  return request(`/articles/${articleId}/comments`)
}

/**
 * 发表评论
 * @param {number} articleId
 * @param {{ content: string, replyTo?: number }} body
 * @returns {Promise<object>} 新创建的评论对象
 */
export function postComment(articleId, body) {
  return request(`/articles/${articleId}/comments`, {
    method: 'POST',
    body,
  })
}

/**
 * 点赞/取消点赞评论
 * @param {number} commentId
 * @returns {Promise<{ liked: boolean, likes: number }>}
 */
export function toggleLikeComment(commentId) {
  return request(`/comments/${commentId}/like`, { method: 'POST' })
}
