// src/api/search.js
// 搜索 API — 后续对接后端时确认接口路径即可
import { request } from './client.js'

/**
 * 搜索文章
 * @param {object} params
 * @param {string} params.keyword   - 搜索关键词
 * @param {string} [params.tag]     - 筛选标签，"全部" 表示不限
 * @param {string} [params.sortBy]  - 排序方式：'latest' | 'likes' | 'collections'
 * @param {number} [params.page]    - 页码，从 1 开始
 * @param {number} [params.pageSize] - 每页条数
 * @returns {Promise<{ list: Array, total: number, page: number, pageSize: number }>}
 */
export function searchArticles({
  keyword,
  tag = '全部',
  sortBy = 'latest',
  page = 1,
  pageSize = 20,
} = {}) {
  const params = new URLSearchParams()
  if (keyword) params.set('q', keyword)
  if (tag && tag !== '全部') params.set('tag', tag)
  if (sortBy) params.set('sortBy', sortBy)
  if (page > 1) params.set('page', String(page))
  if (pageSize !== 20) params.set('pageSize', String(pageSize))

  const qs = params.toString()
  return request(`/articles/search${qs ? `?${qs}` : ''}`)
}
