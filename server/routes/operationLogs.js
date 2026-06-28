// server/routes/operationLogs.js
// 系统操作日志 — 管理员只读查看（不可修改/删除）

import { queryAll } from '../db.js'
import { authGuard } from '../middleware/auth.js'
import { adminGuard } from '../middleware/admin.js'

export default async function operationLogRoutes(fastify) {
  /**
   * GET /admin/operation-logs
   * 获取全部操作日志（管理员及以上）
   * 按时间倒序排列，日志仅可查看不可修改
   */
  fastify.get('/admin/operation-logs', { preHandler: [authGuard, adminGuard] }, async () => {
    const rows = queryAll('SELECT * FROM operation_logs ORDER BY created_at DESC')
    return {
      list: rows.map(r => ({
        id: r.id,
        operator: r.operator,
        operator_role: r.operator_role,
        action: r.action,
        detail: r.detail,
        created_at: r.created_at,
      })),
      total: rows.length,
    }
  })
}
