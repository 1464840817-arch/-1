// server/routes/history.js
// 浏览历史路由

import { queryAll, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'

// 浏览历史上限
const HISTORY_MAX = 200

export default async function historyRoutes(fastify) {
  /**
   * GET /user/history
   * 获取当前用户的浏览历史（文章 ID 数组，按时间倒序）
   */
  fastify.get('/user/history', { preHandler: authGuard }, async (request) => {
    const rows = queryAll(
      'SELECT article_id FROM user_history WHERE user_id = ? ORDER BY viewed_at DESC',
      [request.user.userId],
    )
    return rows.map(r => r.article_id)
  })

  /**
   * POST /user/history
   * Body: { articleId }
   * 添加浏览记录（去重 + 移到最前）
   */
  fastify.post('/user/history', { preHandler: authGuard }, async (request, reply) => {
    const { articleId } = request.body || {}
    if (!articleId) {
      return reply.status(400).send({ message: '缺少文章 ID' })
    }

    const userId = request.user.userId

    // 删除旧记录（如果存在）
    execute('DELETE FROM user_history WHERE user_id = ? AND article_id = ?', [userId, articleId])

    // 插入新记录
    execute(
      'INSERT INTO user_history (user_id, article_id) VALUES (?, ?)',
      [userId, articleId],
    )

    // 只保留最近 N 条
    execute(
      `DELETE FROM user_history WHERE rowid IN (
         SELECT rowid FROM user_history WHERE user_id = ?
         ORDER BY viewed_at DESC LIMIT -1 OFFSET ${HISTORY_MAX}
       )`,
      [userId],
    )

    return { ok: true }
  })

  /**
   * DELETE /user/history
   * 清空浏览历史
   */
  fastify.delete('/user/history', { preHandler: authGuard }, async (request) => {
    execute('DELETE FROM user_history WHERE user_id = ?', [request.user.userId])
    return { ok: true }
  })
}
