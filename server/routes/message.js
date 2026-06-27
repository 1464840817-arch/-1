// server/routes/message.js
// 消息通知

import { queryAll, queryOne, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'

export default async function messageRoutes(fastify) {
  /**
   * GET /user/messages?page=&pageSize=
   * 获取当前用户的消息列表（按时间倒序，支持分页）
   */
  fastify.get('/user/messages', { preHandler: authGuard }, async (request) => {
    const { page = '1', pageSize = '20' } = request.query
    const limit = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100)
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit

    const { total } = queryOne(
      'SELECT COUNT(*) as total FROM messages WHERE user_id = ?',
      [request.user.userId],
    ) || { total: 0 }

    const unreadCount = queryOne(
      'SELECT COUNT(*) as cnt FROM messages WHERE user_id = ? AND unread = 1',
      [request.user.userId],
    )

    const rows = queryAll(
      'SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [request.user.userId, limit, offset],
    )
    return {
      list: rows.map(formatMessage),
      total,
      page: parseInt(page, 10) || 1,
      pageSize: limit,
      unreadCount: unreadCount?.cnt || 0,
    }
  })

  /**
   * PUT /user/messages/read
   * Body: { ids: number[] }
   * 标记指定消息为已读
   */
  fastify.put('/user/messages/read', { preHandler: authGuard }, async (request, reply) => {
    const { ids } = request.body || {}
    if (!Array.isArray(ids) || ids.length === 0) {
      return reply.status(400).send({ message: '请提供消息 ID 列表' })
    }

    const placeholders = ids.map(() => '?').join(',')
    execute(
      `UPDATE messages SET unread = 0 WHERE user_id = ? AND id IN (${placeholders})`,
      [request.user.userId, ...ids],
    )
    return { ok: true }
  })

  /**
   * PUT /user/messages/read-all
   * 全部标记为已读
   */
  fastify.put('/user/messages/read-all', { preHandler: authGuard }, async (request) => {
    execute('UPDATE messages SET unread = 0 WHERE user_id = ?', [request.user.userId])
    return { ok: true }
  })

  /**
   * DELETE /user/messages/:id
   * 删除单条消息
   */
  fastify.delete('/user/messages/:id', { preHandler: authGuard }, async (request) => {
    const id = parseInt(request.params.id, 10)
    execute('DELETE FROM messages WHERE id = ? AND user_id = ?', [id, request.user.userId])
    return { ok: true }
  })
}

function formatMessage(row) {
  // 生成友好的时间显示
  const created = new Date(row.created_at)
  const now = new Date()
  const diffMs = now - created
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  let time
  if (diffMin < 1) time = '刚刚'
  else if (diffMin < 60) time = `${diffMin}分钟前`
  else if (diffHour < 24) time = `${diffHour}小时前`
  else if (diffDay === 1) time = '昨天'
  else if (diffDay < 7) time = `${diffDay}天前`
  else time = `${created.getMonth() + 1}月${created.getDate()}日`

  return {
    id: row.id,
    type: row.type,
    sender: row.sender,
    action: row.action,
    content: row.content,
    targetId: row.target_id,
    time,
    date: row.created_at,
    unread: !!row.unread,
  }
}
