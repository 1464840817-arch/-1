// server/routes/admin.js
// 管理员用户管理：创建/禁用/删除/列表/密码重置

import bcrypt from 'bcryptjs'
import { queryAll, queryOne, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'
import { adminGuard, superAdminGuard } from '../middleware/admin.js'

export default async function adminRoutes(fastify) {
  /**
   * GET /admin/users?page=&size=&role=&keyword=
   * 获取用户列表（管理员及以上）
   */
  fastify.get('/admin/users', { preHandler: [authGuard, adminGuard] }, async (request) => {
    const { page = '1', size = '50', role, keyword } = request.query
    const limit = Math.min(Math.max(parseInt(size, 10) || 50, 1), 200)
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit

    let sql = 'SELECT id, account, name, role, department, disabled, created_at FROM users WHERE 1=1'
    let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1'
    const params = []
    const countParams = []

    if (role && role !== 'all') {
      const clause = ' AND role = ?'
      sql += clause
      countSql += clause
      params.push(role)
      countParams.push(role)
    }

    if (keyword && keyword.trim()) {
      const clause = ' AND (name LIKE ? OR account LIKE ?)'
      const kw = `%${keyword.trim()}%`
      sql += clause
      countSql += clause
      params.push(kw, kw)
      countParams.push(kw, kw)
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const { total } = queryOne(countSql, countParams) || { total: 0 }
    const rows = queryAll(sql, params)

    return {
      list: rows.map(u => ({
        id: u.id,
        name: u.name,
        account: u.account,
        role: u.role,
        department: u.department || '',
        disabled: !!u.disabled,
        createdAt: u.created_at ? u.created_at.slice(0, 10) : '',
      })),
      total,
    }
  })

  /**
   * POST /admin/users
   * 创建用户（管理员及以上）
   */
  fastify.post('/admin/users', { preHandler: [authGuard, adminGuard] }, async (request, reply) => {
    const { account, password, name, role, department } = request.body || {}

    if (!account || !account.trim()) {
      return reply.status(400).send({ message: '工号不能为空' })
    }
    if (!password || password.length < 6) {
      return reply.status(400).send({ message: '密码至少 6 位' })
    }
    if (!name || !name.trim()) {
      return reply.status(400).send({ message: '姓名不能为空' })
    }

    // 检查工号是否已存在
    const existing = queryOne('SELECT id FROM users WHERE account = ?', [account.trim()])
    if (existing) {
      return reply.status(409).send({ message: '该工号已存在' })
    }

    // 权限检查：管理员只能创建工程师，超管可创建管理员
    const targetRole = role || '一线工程师'
    if (targetRole !== '一线工程师' && request.user.role !== '系统部署人员') {
      return reply.status(403).send({ message: '权限不足，仅超级管理员可创建管理员账号' })
    }

    const hashed = await bcrypt.hash(password, 10)
    execute(
      'INSERT INTO users (account, password, name, role, department) VALUES (?, ?, ?, ?, ?)',
      [account.trim(), hashed, name.trim(), targetRole, (department || '').trim()],
    )

    const row = queryOne('SELECT id, account, name, role, department, disabled, created_at FROM users ORDER BY id DESC LIMIT 1')
    return {
      id: row.id,
      name: row.name,
      account: row.account,
      role: row.role,
      department: row.department || '',
      disabled: !!row.disabled,
      createdAt: row.created_at ? row.created_at.slice(0, 10) : '',
    }
  })

  /**
   * PUT /admin/users/:id
   * 更新用户信息（角色、部门）
   */
  fastify.put('/admin/users/:id', { preHandler: [authGuard, adminGuard] }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const user = queryOne('SELECT * FROM users WHERE id = ?', [id])
    if (!user) {
      return reply.status(404).send({ message: '用户不存在' })
    }

    const { role, department, name } = request.body || {}

    // 权限检查
    if (role && role !== user.role && request.user.role !== '系统部署人员') {
      return reply.status(403).send({ message: '仅超级管理员可修改用户角色' })
    }

    if (name !== undefined) {
      execute('UPDATE users SET name = ? WHERE id = ?', [name.trim(), id])
    }
    if (role !== undefined) {
      execute('UPDATE users SET role = ? WHERE id = ?', [role, id])
    }
    if (department !== undefined) {
      execute('UPDATE users SET department = ? WHERE id = ?', [department.trim(), id])
    }

    return { ok: true }
  })

  /**
   * DELETE /admin/users/:id
   * 删除用户（超级管理员）
   */
  fastify.delete('/admin/users/:id', { preHandler: [authGuard, superAdminGuard] }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const user = queryOne('SELECT * FROM users WHERE id = ?', [id])
    if (!user) {
      return reply.status(404).send({ message: '用户不存在' })
    }
    if (user.id === request.user.userId) {
      return reply.status(400).send({ message: '不能删除自己的账号' })
    }

    execute('DELETE FROM users WHERE id = ?', [id])
    return { ok: true }
  })

  /**
   * PUT /admin/users/:id/status
   * Body: { disabled: boolean }
   * 禁用/启用用户（管理员及以上）
   */
  fastify.put('/admin/users/:id/status', { preHandler: [authGuard, adminGuard] }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const user = queryOne('SELECT * FROM users WHERE id = ?', [id])
    if (!user) {
      return reply.status(404).send({ message: '用户不存在' })
    }
    if (user.id === request.user.userId) {
      return reply.status(400).send({ message: '不能操作自己的账号' })
    }

    const { disabled } = request.body || {}
    execute('UPDATE users SET disabled = ? WHERE id = ?', [disabled ? 1 : 0, id])
    return { ok: true }
  })

  /**
   * PUT /admin/users/:id/password
   * Body: { password: string }
   * 重置用户密码（超级管理员）
   */
  fastify.put('/admin/users/:id/password', { preHandler: [authGuard, superAdminGuard] }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const user = queryOne('SELECT * FROM users WHERE id = ?', [id])
    if (!user) {
      return reply.status(404).send({ message: '用户不存在' })
    }

    const { password } = request.body || {}
    if (!password || password.length < 6) {
      return reply.status(400).send({ message: '密码至少 6 位' })
    }

    const hashed = await bcrypt.hash(password, 10)
    execute('UPDATE users SET password = ? WHERE id = ?', [hashed, id])
    return { ok: true }
  })
}
