// server/routes/chat.js
// 私聊 — 聊天记录查询 + 发送消息

import { queryAll, queryOne, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

export default async function chatRoutes(fastify) {
  /**
   * GET /chat/:friendId?before=&limit=
   * 获取当前用户与指定好友的双向聊天记录
   */
  fastify.get('/chat/:friendId', { preHandler: authGuard }, async (request, reply) => {
    const friendId = parseInt(request.params.friendId, 10)
    const { before, limit: limitStr } = request.query
    const limit = Math.min(Math.max(parseInt(limitStr, 10) || DEFAULT_LIMIT, 1), MAX_LIMIT)

    // 校验好友存在
    const friend = queryOne(
      'SELECT id, name FROM users WHERE id = ? AND disabled = 0',
      [friendId],
    )
    if (!friend) {
      return reply.status(404).send({ message: '用户不存在' })
    }

    if (friendId === request.user.userId) {
      return reply.status(400).send({ message: '不能与自己聊天' })
    }

    const uid = request.user.userId
    const beforeId = before ? parseInt(before, 10) : null

    const rows = queryAll(
      `SELECT id, user_id, target_id, sender, content, created_at
       FROM messages
       WHERE type = 'chat'
         AND ((user_id = ? AND target_id = ?) OR (user_id = ? AND target_id = ?))
         AND (? IS NULL OR id < ?)
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      [uid, friendId, friendId, uid, beforeId, beforeId, limit + 1],
    )

    const hasMore = rows.length > limit
    if (hasMore) rows.pop()

    // 标记对方发给我的未读消息为已读
    execute(
      `UPDATE messages SET unread = 0
       WHERE type = 'chat' AND user_id = ? AND target_id = ? AND unread = 1`,
      [uid, friendId],
    )

    // 按时间正序排列
    const list = rows.reverse().map(r => ({
      id: r.id,
      fromMe: r.target_id === uid,
      content: r.content,
      time: formatTime(r.created_at),
      date: r.created_at,
    }))

    return { list, hasMore }
  })

  /**
   * POST /chat/:friendId
   * Body: { content: string }
   * 发送一条私聊消息
   */
  fastify.post('/chat/:friendId', { preHandler: authGuard }, async (request, reply) => {
    const friendId = parseInt(request.params.friendId, 10)
    const { content } = request.body || {}

    if (!content || !content.trim()) {
      return reply.status(400).send({ message: '消息内容不能为空' })
    }

    if (friendId === request.user.userId) {
      return reply.status(400).send({ message: '不能给自己发私信' })
    }

    const target = queryOne(
      'SELECT id, name FROM users WHERE id = ? AND disabled = 0',
      [friendId],
    )
    if (!target) {
      return reply.status(404).send({ message: '用户不存在' })
    }

    execute(
      `INSERT INTO messages (user_id, type, sender, action, content, target_id)
       VALUES (?, 'chat', ?, '发来一条私信', ?, ?)`,
      [friendId, request.user.name, content.trim(), request.user.userId],
    )

    // 获取实际插入的消息 ID
    const { id: msgId } = queryOne('SELECT last_insert_rowid() AS id') || {}

    // 更新最后活跃时间
    execute(
      "UPDATE users SET last_active = datetime('now','localtime') WHERE id = ?",
      [request.user.userId],
    )

    return { ok: true, id: msgId, time: formatTime(new Date().toISOString()) }
  })
}

/** 将 ISO 时间格式化为 HH:mm */
function formatTime(dateStr) {
  try {
    const d = new Date(dateStr)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${hh}:${mm}`
  } catch {
    return dateStr || ''
  }
}
