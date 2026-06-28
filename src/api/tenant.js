// src/api/tenant.js
// 租户（单位/公司）配置相关 API
import { request } from './client.js'

/**
 * 获取当前租户的完整配置：部门列表、分类标签、组织类型等
 * 返回数据结构参见 ../mock/tenantData.js 中的 tenantConfig
 * @returns {Promise<{id:number, name:string, orgType:string, departments:array, categoryTags:array}>}
 */
export function getTenantConfig() {
  return request('/tenant/config')
}

/**
 * 获取当前租户的分类标签列表（仅 active 的）
 * @returns {Promise<Array<{id:number, name:string, active:boolean}>>}
 */
export async function getCategoryTags() {
  const config = await getTenantConfig()
  return config.categoryTags || []
}

/**
 * 获取当前租户的部门列表（仅 active 的）
 * @returns {Promise<Array<{id:number, name:string, active:boolean}>>}
 */
export async function getDepartments() {
  const config = await getTenantConfig()
  return config.departments || []
}

// ==================== 分类标签 CRUD（管理员） ====================

/**
 * 新增分类标签
 * @param {string} name - 标签名称
 * @returns {Promise<{id:number, name:string}>}
 */
export function addCategoryTag(name) {
  return request('/tenant/category-tags', {
    method: 'POST',
    body: { name },
  })
}

/**
 * 删除分类标签
 * @param {number} id - 标签 ID
 * @returns {Promise<void>}
 */
export function deleteCategoryTag(id) {
  return request(`/tenant/category-tags/${id}`, {
    method: 'DELETE',
  })
}

/**
 * 更新分类标签（重命名或切换 active 状态）
 * @param {number} id
 * @param {{ name?: string, active?: boolean }} data
 * @returns {Promise<object>}
 */
export function updateCategoryTag(id, data) {
  return request(`/tenant/category-tags/${id}`, {
    method: 'PUT',
    body: data,
  })
}

// ==================== 租户配置（超级管理员） ====================

/**
 * 更新租户全局配置（平台名称、Logo、部门等）
 * @param {{ name?: string, logoUrl?: string, departments?: Array }} data
 * @returns {Promise<object>}
 */
export function updateTenantConfig(data) {
  return request('/tenant/config', {
    method: 'PUT',
    body: data,
  })
}

// ==================== 个人页面可见性配置（管理员） ====================

/**
 * 获取个人页面模块可见性配置
 * @returns {Promise<{myPosts:boolean, totalLikes:boolean, totalViews:boolean, collections:boolean, history:boolean, delisted:boolean}>}
 */
export function getProfileVisibility() {
  return request('/tenant/profile-visibility')
}

/**
 * 更新个人页面模块可见性配置
 * @param {object} data - 部分可见性字段
 * @returns {Promise<{ok:boolean, profileVisibility:object}>}
 */
export function updateProfileVisibility(data) {
  return request('/tenant/profile-visibility', {
    method: 'PUT',
    body: data,
  })
}
