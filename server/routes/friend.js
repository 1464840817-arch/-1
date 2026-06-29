// server/routes/friend.js
// 好友管理 + 管理员列表 + 用户搜索 + 好友请求

import { queryAll, queryOne, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'

// 在线判定阈值（分钟）
const ONLINE_THRESHOLD_MINUTES = 5
// 用户搜索最大条数
const USER_SEARCH_LIMIT = 20

export default async function friendRoutes(fastify) {
  /**
   * GET /user/friends
   * 获取当前用户的好友列表（已建立双向关系的）
   */
  fastify.get('/user/friends', { preHandler: authGuard }, async (request) => {
    const rows = queryAll(
      `SELECT u.id, u.name, u.account, u.role, u.department, u.avatar, u.last_active,
              (u.last_active > datetime('now','localtime','-${ONLINE_THRESHOLD_MINUTES} minutes')) AS online
       FROM user_friends f
       JOIN users u ON u.id = f.friend_id
       WHERE f.user_id = ?
       ORDER BY online DESC, f.created_at DESC`,
      [request.user.userId],
    )
    return rows.map(u => ({
      id: u.id,
      name: u.name,
      account: u.account,
      role: u.role,
      department: u.department || '',
      avatar: u.avatar || '',
      isOnline: !!u.online,
    }))
  })

  /**
   * GET /user/friends/requests
   * 获取待处理的好友请求（别人发给我的）
   */
  fastify.get('/user/friends/requests', { preHandler: authGuard }, async (request) => {
    const rows = queryAll(
      `SELECT m.id, m.sender, m.content, m.target_id AS senderId, m.created_at,
              u.account, u.role, u.department, u.avatar,
              (u.last_active > datetime('now','localtime','-${ONLINE_THRESHOLD_MINUTES} minutes')) AS online
       FROM messages m
       JOIN users u ON u.id = m.target_id
       WHERE m.user_id = ? AND m.type = 'friend' AND m.action = '请求添加你为好友' AND m.unread = 1
       ORDER BY m.created_at DESC`,
      [request.user.userId],
    )
    return rows.map(r => ({
      id: r.id,
      messageId: r.id,
      senderId: r.senderId,
      sender: r.sender,
      content: r.content,
      account: r.account,
      role: r.role,
      department: r.department || '',
      avatar: r.avatar || '',
      isOnline: !!r.online,
      createdAt: r.created_at,
    }))
  })

  /**
   * POST /user/friends
   * Body: { userId }
   * 发送好友请求（若对方也在请求我则自动成为好友）
   */
  fastify.post('/user/friends', { preHandler: authGuard }, async (request, reply) => {
    const { userId } = request.body || {}
    if (!userId) {
      return reply.status(400).send({ message: '缺少用户 ID' })
    }

    const target = queryOne('SELECT id, name FROM users WHERE id = ?', [userId])
    if (!target) {
      return reply.status(404).send({ message: '用户不存在' })
    }

    if (userId === request.user.userId) {
      return reply.status(400).send({ message: '不能添加自己为好友' })
    }

    // 检查是否已经是好友
    const alreadyFriend = queryOne(
      'SELECT 1 FROM user_friends WHERE user_id = ? AND friend_id = ?',
      [request.user.userId, userId],
    )
    if (alreadyFriend) {
      return reply.status(400).send({ message: '已经是好友' })
    }

    // 检查我是否已经给对方发过请求（仅匹配未处理的活跃请求）
    const myPending = queryOne(
      "SELECT id FROM messages WHERE user_id = ? AND target_id = ? AND type = 'friend' AND action = '请求添加你为好友' AND unread = 1",
      [userId, request.user.userId],
    )
    if (myPending) {
      return { ok: true, status: 'already_requested' }
    }

    // 检查对方是否已经给我发过请求 → 自动成为好友（仅匹配未处理的活跃请求）
    const theirRequest = queryOne(
      "SELECT id FROM messages WHERE user_id = ? AND target_id = ? AND type = 'friend' AND action = '请求添加你为好友' AND unread = 1",
      [request.user.userId, userId],
    )
    if (theirRequest) {
      // 标记对方请求为已处理
      execute("UPDATE messages SET unread = 0 WHERE id = ?", [theirRequest.id])

      // 创建双向好友关系
      execute(
        'INSERT OR IGNORE INTO user_friends (user_id, friend_id) VALUES (?, ?)',
        [request.user.userId, userId],
      )
      execute(
        'INSERT OR IGNORE INTO user_friends (user_id, friend_id) VALUES (?, ?)',
        [userId, request.user.userId],
      )

      // 通知对方：请求已自动通过（双向请求）
      execute(
        "INSERT INTO messages (user_id, type, sender, action, content, target_id) VALUES (?, 'friend', ?, '已接受你的好友请求', ?, ?)",
        [userId, request.user.name, `你和 ${request.user.name} 已成为好友`, request.user.userId],
      )

      return { ok: true, status: 'accepted' }
    }

    // 发送好友请求通知
    execute(
      "INSERT INTO messages (user_id, type, sender, action, content, target_id) VALUES (?, 'friend', ?, '请求添加你为好友', ?, ?)",
      [userId, request.user.name, `你好，我是 ${request.user.name}`, request.user.userId],
    )

    return { ok: true, status: 'requested' }
  })

  /**
   * POST /user/friends/handle
   * Body: { userId, action: 'accept' | 'decline' }
   * 处理好友请求
   */
  fastify.post('/user/friends/handle', { preHandler: authGuard }, async (request, reply) => {
    const { userId, action } = request.body || {}
    if (!userId || !['accept', 'decline'].includes(action)) {
      return reply.status(400).send({ message: '参数不完整' })
    }

    // 找到待处理的请求消息
    const pendingReq = queryOne(
      "SELECT id FROM messages WHERE user_id = ? AND target_id = ? AND type = 'friend' AND unread = 1",
      [request.user.userId, userId],
    )
    if (!pendingReq) {
      return reply.status(404).send({ message: '未找到待处理的好友请求' })
    }

    // 标记请求为已处理
    execute("UPDATE messages SET unread = 0 WHERE id = ?", [pendingReq.id])

    if (action === 'accept') {
      // 创建双向好友关系
      execute(
        'INSERT OR IGNORE INTO user_friends (user_id, friend_id) VALUES (?, ?)',
        [request.user.userId, userId],
      )
      execute(
        'INSERT OR IGNORE INTO user_friends (user_id, friend_id) VALUES (?, ?)',
        [userId, request.user.userId],
      )

      // 通知对方已接受
      execute(
        "INSERT INTO messages (user_id, type, sender, action, content, target_id) VALUES (?, 'friend', ?, '已接受你的好友请求', ?, ?)",
        [userId, request.user.name, `你和 ${request.user.name} 已成为好友`, request.user.userId],
      )
    }
    // decline：请求已标记为已读，无需额外操作（静默拒绝）

    return { ok: true, action }
  })

  /**
   * DELETE /user/friends/:friendId
   * 删除好友
   */
  fastify.delete('/user/friends/:friendId', { preHandler: authGuard }, async (request) => {
    const friendId = parseInt(request.params.friendId, 10)
    execute(
      'DELETE FROM user_friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)',
      [request.user.userId, friendId, friendId, request.user.userId],
    )
    return { ok: true }
  })

  /**
   * GET /user/search?q=
   * 搜索用户（按工号、姓名、部门）
   */
  fastify.get('/user/search', { preHandler: authGuard }, async (request, reply) => {
    const { q } = request.query
    if (!q || !q.trim()) {
      return reply.status(400).send({ message: '请输入搜索关键词' })
    }

    const kw = `%${q.trim()}%`
    const rows = queryAll(
      `SELECT id, name, account, role, department, avatar,
              (last_active > datetime('now','localtime','-${ONLINE_THRESHOLD_MINUTES} minutes')) AS online
       FROM users
       WHERE (name LIKE ? OR account LIKE ? OR department LIKE ?)
         AND id != ?
         AND disabled = 0
       LIMIT ${USER_SEARCH_LIMIT}`,
      [kw, kw, kw, request.user.userId],
    )
    return rows.map(u => ({
      id: u.id,
      name: u.name,
      account: u.account,
      role: u.role,
      department: u.department || '',
      avatar: u.avatar || '',
      isOnline: !!u.online,
    }))
  })

  /**
   * GET /tenant/admins
   * 获取管理员列表（所有管理员及以上角色的用户）
   */
  fastify.get('/tenant/admins', { preHandler: authGuard }, async () => {
    const rows = queryAll(
      `SELECT id, name, account, role, department, avatar,
              (last_active > datetime('now','localtime','-${ONLINE_THRESHOLD_MINUTES} minutes')) AS online
       FROM users
       WHERE role IN ('管理员', '系统部署人员') AND disabled = 0
       ORDER BY online DESC, role DESC, name ASC`,
    )
    return rows.map(u => ({
      id: u.id,
      name: u.name,
      account: u.account,
      role: u.role,
      department: u.department || '',
      avatar: u.avatar || '',
      isOnline: !!u.online,
    }))
  })
}
