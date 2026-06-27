// server/routes/friend.js
// 好友管理 + 管理员列表 + 用户搜索

import { queryAll, queryOne, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'

// 在线判定阈值（分钟）
const ONLINE_THRESHOLD_MINUTES = 5
// 用户搜索最大条数
const USER_SEARCH_LIMIT = 20

export default async function friendRoutes(fastify) {
  /**
   * GET /user/friends
   * 获取当前用户的好友列表
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
   * POST /user/friends
   * Body: { userId }
   * 添加好友
   */
  fastify.post('/user/friends', { preHandler: authGuard }, async (request, reply) => {
    const { userId } = request.body || {}
    if (!userId) {
      return reply.status(400).send({ message: '缺少用户 ID' })
    }

    const target = queryOne('SELECT id FROM users WHERE id = ?', [userId])
    if (!target) {
      return reply.status(404).send({ message: '用户不存在' })
    }

    if (userId === request.user.userId) {
      return reply.status(400).send({ message: '不能添加自己为好友' })
    }

    // 幂等插入 + 双向好友
    execute(
      'INSERT OR IGNORE INTO user_friends (user_id, friend_id) VALUES (?, ?)',
      [request.user.userId, userId],
    )
    execute(
      'INSERT OR IGNORE INTO user_friends (user_id, friend_id) VALUES (?, ?)',
      [userId, request.user.userId],
    )

    return { ok: true }
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
      `SELECT id, name, account, role, department,
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
      isOnline: !!u.online,
    }))
  })

  /**
   * GET /tenant/admins
   * 获取管理员列表（所有管理员及以上角色的用户）
   */
  fastify.get('/tenant/admins', { preHandler: authGuard }, async () => {
    const rows = queryAll(
      `SELECT id, name, account, role, department,
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
      isOnline: !!u.online,
    }))
  })
}
