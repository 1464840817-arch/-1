// server/routes/auth.js
// 认证路由 — 登录、登出、刷新 token

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'crypto'
import config from '../config.js'
import { queryOne, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'

/**
 * 生成 JWT access + refresh token 对
 */
function generateTokens(userId, role, name, account) {
  const accessToken = jwt.sign(
    { userId, role, name, account },
    config.JWT_SECRET,
    { expiresIn: config.ACCESS_TOKEN_TTL },
  )

  // refresh token 持久化到数据库
  const refreshToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL * 1000).toISOString()

  execute(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
    [userId, refreshToken, expiresAt],
  )

  return { accessToken, refreshToken }
}

// ==================== 注册路由 ====================

export default async function authRoutes(fastify) {
  /**
   * POST /auth/login
   * Body: { account, password }
   */
  fastify.post('/auth/login', async (request, reply) => {
    const { account, password } = request.body || {}

    if (!account || !password) {
      return reply.status(400).send({ message: '请输入账号和密码' })
    }

    const user = queryOne(
      'SELECT id, account, password, name, role, disabled FROM users WHERE account = ?',
      [account],
    )

    if (!user) {
      return reply.status(404).send({ message: '账号不存在，请检查工号或手机号' })
    }

    if (user.disabled) {
      return reply.status(403).send({ message: '账号已被禁用，请联系管理员' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      return reply.status(401).send({ message: '密码错误，请检查后重试' })
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.role, user.name, user.account)

    return {
      token: accessToken,
      refreshToken,
      name: user.name,
      role: user.role,
    }
  })

  /**
   * POST /auth/refresh
   * Body: { refreshToken }  或  Header: Authorization: Bearer <refreshToken>
   * 用 refresh token 换取新的 access token
   */
  fastify.post('/auth/refresh', async (request, reply) => {
    const { refreshToken: bodyToken } = request.body || {}
    const headerToken = request.headers.authorization?.startsWith('Bearer ')
      ? request.headers.authorization.slice(7)
      : null
    const token = bodyToken || headerToken

    if (!token) {
      return reply.status(400).send({ message: '缺少 refresh token' })
    }

    const record = queryOne(
      `SELECT rt.id, rt.user_id, rt.expires_at, u.role, u.name, u.account
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       WHERE rt.token = ? AND u.disabled = 0`,
      [token],
    )

    if (!record) {
      return reply.status(401).send({ message: 'refresh token 无效' })
    }

    if (new Date(record.expires_at) < new Date()) {
      execute('DELETE FROM refresh_tokens WHERE id = ?', [record.id])
      return reply.status(401).send({ message: 'refresh token 已过期，请重新登录' })
    }

    // 删除旧的 refresh token，生成新的（轮换策略）
    execute('DELETE FROM refresh_tokens WHERE id = ?', [record.id])

    const { accessToken, refreshToken } = generateTokens(record.user_id, record.role, record.name, record.account)

    return {
      token: accessToken,
      refreshToken,
    }
  })

  /**
   * POST /auth/logout
   * 需要登录态，删除所有 refresh token
   */
  fastify.post('/auth/logout', { preHandler: authGuard }, async (request, reply) => {
    execute('DELETE FROM refresh_tokens WHERE user_id = ?', [request.user.userId])
    return { ok: true }
  })
}
