// src/api/admin.js
// 管理员 API — 操作日志查询

import { request } from './client.js'

/**
 * 获取系统操作日志（管理员及以上）
 * 返回 { list: [...], total: N }
 */
export function getOperationLogs() {
  return request('/admin/operation-logs')
}
