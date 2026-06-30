// server/routes/collection.js
// 收藏路由

import { queryAll, queryOne, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'
import { publish } from '../sse.js'

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
    const article = queryOne('SELECT id, title, author FROM articles WHERE id = ?', [articleId])
    if (!article) {
      return reply.status(404).send({ message: '文章不存在' })
    }

    // 检查是否已收藏（幂等判断）
    const existing = queryOne(
      'SELECT user_id FROM user_collections WHERE user_id = ? AND article_id = ?',
      [request.user.userId, articleId],
    )

    if (!existing) {
      // 插入收藏记录
      execute(
        'INSERT OR IGNORE INTO user_collections (user_id, article_id) VALUES (?, ?)',
        [request.user.userId, articleId],
      )
    }

    // 通知文章作者（非自己收藏自己，且去重）
    // 注意：通知逻辑放在 existing 判断之外，处理以下场景：
    // 1. 新收藏 → 正常通知
    // 2. 之前收藏过但通知丢失（如旧版未发通知）→ 补发通知
    if (article.author !== request.user.name && article.author !== request.user.account) {
      const authorUser = queryOne('SELECT id FROM users WHERE name = ?', [article.author])
      if (authorUser) {
        const dupNotify = queryOne(
          "SELECT id FROM messages WHERE user_id = ? AND type = 'collect' AND sender = ? AND target_id = ?",
          [authorUser.id, request.user.name, articleId],
        )
        if (!dupNotify) {
          execute(
            `INSERT INTO messages (user_id, type, sender, action, content, target_id)
             VALUES (?, 'collect', ?, '收藏了你的文章', ?, ?)`,
            [authorUser.id, request.user.name, article.title, articleId],
          )

          // SSE 实时推送
          const { id: notifyId } = queryOne('SELECT last_insert_rowid() AS id') || {}
          const now = new Date().toISOString()
          publish(authorUser.id, {
            type: 'new_notification',
            id: notifyId,
            notifyType: 'collect',
            sender: request.user.name,
            senderAccount: request.user.account || '',
            action: '收藏了你的文章',
            content: article.title,
            targetId: articleId,
            time: '刚刚',
            date: now,
            unread: true,
          })
        }
      }
    }

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

    // 同时删除对应的收藏通知，以便重新收藏时能再次通知
    const article = queryOne('SELECT author FROM articles WHERE id = ?', [articleId])
    if (article) {
      const authorUser = queryOne('SELECT id FROM users WHERE name = ?', [article.author])
      if (authorUser) {
        execute(
          "DELETE FROM messages WHERE user_id = ? AND type = 'collect' AND sender = ? AND target_id = ?",
          [authorUser.id, request.user.name, articleId],
        )
      }
    }

    return { ok: true }
  })
}
