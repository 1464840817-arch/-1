// src/api/user.js
// 用户相关 API
import { request } from './client.js'

/**
 * 获取当前登录用户资料
 * @returns {Promise<{avatar: string, account: string, name: string, desc: string}>}
 */
export function getProfile() {
  return request('/user/profile')
}

/**
 * 更新用户资料
 * @param {object} data - 要更新的字段
 *   支持 JSON 方式：{ name, desc }
 *   支持 FormData：含头像文件时为 multipart/form-data
 * @returns {Promise<any>}
 */
export function updateProfile(data) {
  const isFormData = data instanceof FormData
  return request('/user/profile', {
    method: 'PUT',
    body: isFormData ? data : data,
  })
}

/**
 * 修改密码
 * @param {{ oldPassword: string, newPassword: string }} data
 * @returns {Promise<{ ok: boolean }>}
 */
export function changePassword(data) {
  return request('/user/password', {
    method: 'PUT',
    body: data,
  })
}
