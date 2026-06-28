// src/api/user.js
// 用户资料相关 API
import { request } from './client.js'

/**
 * 获取当前登录用户的资料
 * @returns {Promise<{avatar:string, account:string, name:string, role:string, department:string, desc:string}>}
 */
export function getProfile() {
  return request('/user/profile')
}

/**
 * 更新当前用户资料（支持 JSON 或 FormData）
 * @param {object|FormData} body
 * @returns {Promise<object>}
 */
export function updateProfile(body) {
  return request('/user/profile', {
    method: 'PUT',
    body,
  })
}

/**
 * 修改当前用户密码
 * @param {{ oldPassword: string, newPassword: string }} data
 * @returns {Promise<object>}
 */
export function changePassword(data) {
  return request('/user/password', {
    method: 'PUT',
    body: data,
  })
}

/**
 * 获取任意用户的公开资料
 * @param {number} id - 用户 ID
 * @returns {Promise<{id:number, account:string, name:string, avatar:string, role:string, department:string, desc:string, isFriend:boolean}>}
 */
export function getUserProfile(id) {
  return request(`/users/${id}`)
}

/**
 * 获取任意用户已发布的文章列表
 * @param {number} id - 用户 ID
 * @param {object} [params] - 分页参数
 * @returns {Promise<{list:Array, total:number, page:number, pageSize:number}>}
 */
export function getUserPosts(id, params = {}) {
  const { page = 1, pageSize = 20 } = params
  return request(`/users/${id}/posts?page=${page}&pageSize=${pageSize}`)
}

/**
 * 发送私信给指定用户
 * @param {number} id - 接收者用户 ID
 * @param {string} content - 消息内容
 * @returns {Promise<{ok:boolean}>}
 */
export function sendMessage(id, content) {
  return request(`/users/${id}/message`, {
    method: 'POST',
    body: { content },
  })
}
