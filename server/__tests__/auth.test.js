// server/__tests__/auth.test.js
// 认证路由测试 — 登录 / Token 刷新 / 登出

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  setupTestDb, createTestServer, teardownTest,
  SUPER_ADMIN, ENGINEER,
  makeToken, authedRequest, json,
} from './helpers.js'

let fastify

beforeEach(async () => {
  await setupTestDb()
  fastify = await createTestServer(['auth'])
})

afterEach(async () => {
  await teardownTest(fastify)
})

describe('POST /auth/login', () => {
  it('应该用正确凭据登录并返回 token', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { account: SUPER_ADMIN.account, password: SUPER_ADMIN.password },
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.token).toBeTruthy()
    expect(body.name).toBe(SUPER_ADMIN.name)
    expect(body.role).toBe(SUPER_ADMIN.role)
    // refresh token 也应该返回
    expect(body.refreshToken).toBeTruthy()
  })

  it('密码错误应返回 401', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { account: SUPER_ADMIN.account, password: 'wrong_password' },
    })

    expect(res.statusCode).toBe(401)
    expect(json(res).message).toContain('密码')
  })

  it('账号不存在应返回 404', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { account: 'nobody', password: '123456' },
    })

    expect(res.statusCode).toBe(404)
    expect(json(res).message).toContain('不存在')
  })

  it('缺少参数应返回 400', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {},
    })

    expect(res.statusCode).toBe(400)
  })

  it('应该能登录普通工程师', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { account: ENGINEER.account, password: ENGINEER.password },
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.role).toBe('一线工程师')
  })
})

describe('POST /auth/refresh', () => {
  it('应该用 refresh token 换取新的 access token', async () => {
    // 先登录获取 refresh token
    const loginRes = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { account: ENGINEER.account, password: ENGINEER.password },
    })
    const { refreshToken } = json(loginRes)

    // 用 refresh token 刷新
    const refreshRes = await fastify.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    })

    expect(refreshRes.statusCode).toBe(200)
    const body = json(refreshRes)
    expect(body.token).toBeTruthy()
    expect(body.refreshToken).toBeTruthy()
    // 应该是新的 refresh token（轮换策略）
    expect(body.refreshToken).not.toBe(refreshToken)
  })

  it('无效 refresh token 应返回 401', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken: 'invalid_token' },
    })

    expect(res.statusCode).toBe(401)
  })

  it('Header Bearer 方式也应支持', async () => {
    const loginRes = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { account: ENGINEER.account, password: ENGINEER.password },
    })
    const { refreshToken } = json(loginRes)

    const res = await fastify.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { authorization: `Bearer ${refreshToken}` },
    })

    expect(res.statusCode).toBe(200)
  })
})

describe('POST /auth/logout', () => {
  it('登录后登出，refresh token 应被清除', async () => {
    // 登录
    const loginRes = await fastify.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { account: ENGINEER.account, password: ENGINEER.password },
    })
    const { token, refreshToken } = json(loginRes)

    // 登出
    const logoutRes = await fastify.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(logoutRes.statusCode).toBe(200)
    expect(json(logoutRes).ok).toBe(true)

    // 旧的 refresh token 应该已失效
    const refreshRes = await fastify.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    })
    expect(refreshRes.statusCode).toBe(401)
  })

  it('未登录登出应返回 401', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/auth/logout',
    })
    expect(res.statusCode).toBe(401)
  })
})
