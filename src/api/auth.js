// src/api/auth.js
// 认证相关 API — 登录、登出、token 刷新
// 后续对接后端时，确认接口路径和请求/响应字段即可
import { request } from './client.js'

/**
 * 账号密码登录
 * @param {{ account: string, password: string }} credentials
 * @returns {Promise<{ name: string, token: string, role: string }>}
 */
export function login(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: { account: credentials.account, password: credentials.password },
  })
}

/**
 * 登出
 * @returns {Promise<void>}
 */
export function logout() {
  return request('/auth/logout', { method: 'POST' })
}

/**
 * 刷新 token
 * @returns {Promise<{ token: string }>}
 */
export function refreshToken() {
  return request('/auth/refresh', { method: 'POST' })
}

// ==================== 账号管理（管理员及以上） ====================

/**
 * 获取用户列表（分页）
 * @param {{ page?: number, size?: number, role?: string, keyword?: string }} params
 * @returns {Promise<{ list: Array, total: number }>}
 */
export function getUserList(params = {}) {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', params.page)
  if (params.size) qs.set('size', params.size)
  if (params.role) qs.set('role', params.role)
  if (params.keyword) qs.set('keyword', params.keyword)
  const query = qs.toString()
  return request(`/admin/users${query ? '?' + query : ''}`)
}

/**
 * 创建用户（管理员创建一线工程师，超管可创建管理员）
 * @param {{ account: string, password: string, name: string, role?: string, department?: string }} data
 * @returns {Promise<object>}
 */
export function createUser(data) {
  return request('/admin/users', {
    method: 'POST',
    body: data,
  })
}

/**
 * 更新用户信息（角色、部门、禁用状态等）
 * @param {number} userId
 * @param {object} data
 * @returns {Promise<object>}
 */
export function updateUser(userId, data) {
  return request(`/admin/users/${userId}`, {
    method: 'PUT',
    body: data,
  })
}

/**
 * 禁用/启用用户
 * @param {number} userId
 * @param {boolean} disabled
 * @returns {Promise<void>}
 */
export function setUserStatus(userId, disabled) {
  return request(`/admin/users/${userId}/status`, {
    method: 'PUT',
    body: { disabled },
  })
}

/**
 * 删除用户（不可逆）
 * @param {number} userId
 * @returns {Promise<void>}
 */
export function deleteUser(userId) {
  return request(`/admin/users/${userId}`, {
    method: 'DELETE',
  })
}

/**
 * 重置用户密码
 * @param {number} userId
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
export function resetPassword(userId, newPassword) {
  return request(`/admin/users/${userId}/password`, {
    method: 'PUT',
    body: { password: newPassword },
  })
}
