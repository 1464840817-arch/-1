// src/api/searchHistory.js
// 搜索历史 API — 后续对接后端时确认接口路径即可
import { request } from './client.js'

/**
 * 获取搜索历史列表
 * @returns {Promise<string[]>}
 */
export function getSearchHistory() {
  return request('/user/search-history')
}

/**
 * 添加搜索词到历史记录
 * @param {string} term - 搜索词
 * @returns {Promise<void>}
 */
export function addSearchHistory(term) {
  return request('/user/search-history', {
    method: 'POST',
    body: { term },
  })
}

/**
 * 清空全部搜索历史
 * @returns {Promise<void>}
 */
export function clearSearchHistory() {
  return request('/user/search-history', { method: 'DELETE' })
}

/**
 * 删除单条搜索历史
 * @param {string} term - 搜索词
 * @returns {Promise<void>}
 */
export function deleteSearchHistory(term) {
  return request(`/user/search-history/${encodeURIComponent(term)}`, {
    method: 'DELETE',
  })
}
