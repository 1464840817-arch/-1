// server/routes/collection.js
// 收藏路由

import { queryAll, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'

export default async function collectionRoutes(fastify) {
  /**
   * GET /user/collections
   * 获取当前用户的收藏文章 ID 列表
   */
  fastify.get('/user/collections', { preHandler: authGuard }, async (request) => {
    const rows = queryAll(
      'SELECT article_id FROM user_collections WHERE user_id = ? ORDER BY created_at DESC',
      [request.user.userId],
    )
    return rows.map(r => r.article_id)
  })

  /**
   * POST /user/collections
   * Body: { articleId }
   * 添加收藏
   */
  fastify.post('/user/collections', { preHandler: authGuard }, async (request, reply) => {
    const { articleId } = request.body || {}
    if (!articleId) {
      return reply.status(400).send({ message: '缺少文章 ID' })
    }

    // 检查文章是否存在
    const article = queryAll('SELECT id FROM articles WHERE id = ?', [articleId])
    if (article.length === 0) {
      return reply.status(404).send({ message: '文章不存在' })
    }

    // 幂等插入（已存在则忽略）
    execute(
      'INSERT OR IGNORE INTO user_collections (user_id, article_id) VALUES (?, ?)',
      [request.user.userId, articleId],
    )

    return { ok: true }
  })

  /**
   * DELETE /user/collections/:articleId
   * 取消收藏
   */
  fastify.delete('/user/collections/:articleId', { preHandler: authGuard }, async (request) => {
    const articleId = parseInt(request.params.articleId, 10)
    execute(
      'DELETE FROM user_collections WHERE user_id = ? AND article_id = ?',
      [request.user.userId, articleId],
    )
    return { ok: true }
  })
}
