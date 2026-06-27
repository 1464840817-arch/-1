// server/routes/search.js
// 搜索相关路由 — 搜索历史

import { queryAll, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'

// 搜索历史上限
const SEARCH_HISTORY_MAX = 8

export default async function searchRoutes(fastify) {
  // ==================== 搜索历史 ====================

  /**
   * GET /user/search-history
   * 获取当前用户的搜索历史，最多返回 8 条
   */
  fastify.get('/user/search-history', { preHandler: authGuard }, async (request) => {
    const rows = queryAll(
      `SELECT term FROM search_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ${SEARCH_HISTORY_MAX}`,
      [request.user.userId],
    )
    return rows.map(r => r.term)
  })

  /**
   * POST /user/search-history
   * Body: { term }
   * 添加搜索词到历史（去重 + 保持最新在前）
   */
  fastify.post('/user/search-history', { preHandler: authGuard }, async (request, reply) => {
    const { term } = request.body || {}
    if (!term || !term.trim()) {
      return reply.status(400).send({ message: '搜索词不能为空' })
    }

    const t = term.trim()
    const userId = request.user.userId

    // 删除已存在的相同词
    execute('DELETE FROM search_history WHERE user_id = ? AND term = ?', [userId, t])

    // 插入新记录在最前面
    execute('INSERT INTO search_history (user_id, term) VALUES (?, ?)', [userId, t])

    // 只保留最近 N 条
    execute(
      `DELETE FROM search_history WHERE id IN (
         SELECT id FROM search_history WHERE user_id = ?
         ORDER BY created_at DESC LIMIT -1 OFFSET ${SEARCH_HISTORY_MAX}
       )`,
      [userId],
    )

    return { ok: true }
  })

  /**
   * DELETE /user/search-history
   * 清空当前用户的全部搜索历史
   */
  fastify.delete('/user/search-history', { preHandler: authGuard }, async (request) => {
    execute('DELETE FROM search_history WHERE user_id = ?', [request.user.userId])
    return { ok: true }
  })

  /**
   * DELETE /user/search-history/:term
   * 删除单条搜索历史
   */
  fastify.delete('/user/search-history/:term', { preHandler: authGuard }, async (request) => {
    const term = decodeURIComponent(request.params.term)
    execute('DELETE FROM search_history WHERE user_id = ? AND term = ?', [request.user.userId, term])
    return { ok: true }
  })

}
