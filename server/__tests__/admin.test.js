// server/__tests__/admin.test.js
// 管理员操作日志测试 — 查询权限 + 日志自动写入

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  setupTestDb, createTestServer, teardownTest,
  SUPER_ADMIN, ENGINEER,
  makeToken, json,
} from './helpers.js'
import { queryOne, queryAll } from '../db.js'

let fastify
let adminToken
let engToken

beforeEach(async () => {
  await setupTestDb()
  fastify = await createTestServer(['admin', 'operationLogs'])
  adminToken = makeToken(SUPER_ADMIN)
  engToken = makeToken(ENGINEER)
})

afterEach(async () => {
  await teardownTest(fastify)
})

// ==================== 日志查询权限 ====================

describe('GET /admin/operation-logs — 查询操作日志', () => {
  it('超级管理员应该能获取日志列表', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/admin/operation-logs',
      headers: { authorization: adminToken },
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body).toHaveProperty('list')
    expect(body).toHaveProperty('total')
    expect(Array.isArray(body.list)).toBe(true)
  })

  it('一线工程师访问应返回 403', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/admin/operation-logs',
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(403)
  })

  it('未登录访问应返回 401', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/admin/operation-logs',
    })

    expect(res.statusCode).toBe(401)
  })

  it('POST /admin/operation-logs 不应存在（日志不可外部写入）', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/admin/operation-logs',
      headers: { authorization: adminToken },
      payload: { action: 'hack' },
    })

    // Fastify 对未注册方法返回 404
    expect(res.statusCode).toBe(404)
  })

  it('DELETE /admin/operation-logs 不应存在（日志不可删除）', async () => {
    const res = await fastify.inject({
      method: 'DELETE',
      url: '/admin/operation-logs',
      headers: { authorization: adminToken },
    })

    expect(res.statusCode).toBe(404)
  })
})

// ==================== 日志自动写入 ====================

describe('管理操作自动记录到 operation_logs', () => {
  it('创建用户应自动写入日志', async () => {
    await fastify.inject({
      method: 'POST',
      url: '/admin/users',
      payload: {
        account: 'NEW_USER_001',
        password: '123456',
        name: '测试员',
        role: '一线工程师',
        department: '测试部',
      },
      headers: { authorization: adminToken },
    })

    const log = queryOne(
      "SELECT * FROM operation_logs WHERE action = '创建用户' AND detail LIKE ?",
      ['%测试员%'],
    )
    expect(log).toBeTruthy()
    expect(log.operator).toBe(SUPER_ADMIN.name)
    expect(log.operator_role).toBe(SUPER_ADMIN.role)
    expect(log.action).toBe('创建用户')
  })

  it('修改用户状态应自动写入日志', async () => {
    await fastify.inject({
      method: 'PUT',
      url: `/admin/users/${ENGINEER.id}/status`,
      payload: { disabled: true },
      headers: { authorization: adminToken },
    })

    const log = queryOne(
      "SELECT * FROM operation_logs WHERE action = '修改用户状态' AND detail LIKE ?",
      ['%张工%'],
    )
    expect(log).toBeTruthy()
    expect(log.action).toBe('修改用户状态')
  })

  it('日志应按时间倒序排列', async () => {
    // 创建两个用户
    await fastify.inject({
      method: 'POST',
      url: '/admin/users',
      payload: { account: 'LOG_USER_A', password: '123456', name: '用户A', role: '一线工程师' },
      headers: { authorization: adminToken },
    })
    await fastify.inject({
      method: 'POST',
      url: '/admin/users',
      payload: { account: 'LOG_USER_B', password: '123456', name: '用户B', role: '一线工程师' },
      headers: { authorization: adminToken },
    })

    const logs = queryAll("SELECT * FROM operation_logs WHERE action = '创建用户' ORDER BY id DESC")
    // 后创建的在前面（倒序）
    expect(logs.length).toBeGreaterThanOrEqual(2)
    expect(logs[0].detail).toContain('用户B')
  })

  it('每条日志都应有 operator/operator_role/action/detail/created_at 字段', async () => {
    await fastify.inject({
      method: 'PUT',
      url: `/admin/users/${ENGINEER.id}/status`,
      payload: { disabled: false },
      headers: { authorization: adminToken },
    })

    const log = queryOne("SELECT * FROM operation_logs WHERE action = '修改用户状态' ORDER BY id DESC LIMIT 1")
    expect(log.operator).toBeTruthy()
    expect(log.operator_role).toBeTruthy()
    expect(log.action).toBeTruthy()
    expect(log.detail).toBeTruthy()
    expect(log.created_at).toBeTruthy()
  })
})
