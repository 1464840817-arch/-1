// server/__tests__/smoke.test.js
// 核心路由冒烟测试 — 覆盖所有非 auth/article 模块

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  setupTestDb, createTestServer, teardownTest,
  SUPER_ADMIN, ENGINEER, ENGINEER_LI,
  makeToken, json,
} from './helpers.js'
import { execute } from '../db.js'

let fastify
let adminToken
let engToken
let liToken

beforeEach(async () => {
  await setupTestDb()
  fastify = await createTestServer('all')
  adminToken = makeToken(SUPER_ADMIN)
  engToken = makeToken(ENGINEER)
  liToken = makeToken(ENGINEER_LI)
})

afterEach(async () => {
  await teardownTest(fastify)
})

// ==================== 搜索历史 ====================

describe('搜索历史 (search)', () => {
  it('GET 初始为空数组', async () => {
    const res = await fastify.inject({
      method: 'GET', url: '/user/search-history',
      headers: { authorization: engToken },
    })
    expect(res.statusCode).toBe(200)
    expect(json(res)).toEqual([])
  })

  it('POST → GET 循环', async () => {
    await fastify.inject({
      method: 'POST', url: '/user/search-history',
      payload: { term: '西门子' },
      headers: { authorization: engToken },
    })

    const res = await fastify.inject({
      method: 'GET', url: '/user/search-history',
      headers: { authorization: engToken },
    })
    expect(json(res)).toContain('西门子')
  })

  it('应该去重', async () => {
    await fastify.inject({
      method: 'POST', url: '/user/search-history',
      payload: { term: 'PLC' },
      headers: { authorization: engToken },
    })
    await fastify.inject({
      method: 'POST', url: '/user/search-history',
      payload: { term: 'PLC' },
      headers: { authorization: engToken },
    })

    const res = await fastify.inject({
      method: 'GET', url: '/user/search-history',
      headers: { authorization: engToken },
    })
    // 去重后应该只有一条
    expect(json(res).filter(t => t === 'PLC')).toHaveLength(1)
  })

  it('DELETE 清空', async () => {
    await fastify.inject({
      method: 'POST', url: '/user/search-history',
      payload: { term: 'test' },
      headers: { authorization: engToken },
    })

    const delRes = await fastify.inject({
      method: 'DELETE', url: '/user/search-history',
      headers: { authorization: engToken },
    })
    expect(delRes.statusCode).toBe(200)

    const getRes = await fastify.inject({
      method: 'GET', url: '/user/search-history',
      headers: { authorization: engToken },
    })
    expect(json(getRes)).toEqual([])
  })
})

// ==================== 收藏 ====================

describe('收藏 (collection)', () => {
  beforeEach(() => {
    execute(
      `INSERT INTO articles (id, type, title, "desc", author, tags, steps)
       VALUES (1, 'PLC', '测试文章', '...', '张工', '[]', '[]')`,
    )
  })

  it('GET 初始为空', async () => {
    const res = await fastify.inject({
      method: 'GET', url: '/user/collections',
      headers: { authorization: engToken },
    })
    expect(json(res)).toEqual([])
  })

  it('POST 收藏 → GET 有数据 → DELETE 取消', async () => {
    // 收藏
    const addRes = await fastify.inject({
      method: 'POST', url: '/user/collections',
      payload: { articleId: 1 },
      headers: { authorization: engToken },
    })
    expect(addRes.statusCode).toBe(200)

    // 确认
    const getRes = await fastify.inject({
      method: 'GET', url: '/user/collections',
      headers: { authorization: engToken },
    })
    expect(json(getRes)).toContain(1)

    // 取消
    const delRes = await fastify.inject({
      method: 'DELETE', url: '/user/collections/1',
      headers: { authorization: engToken },
    })
    expect(delRes.statusCode).toBe(200)

    // 确认空
    const getRes2 = await fastify.inject({
      method: 'GET', url: '/user/collections',
      headers: { authorization: engToken },
    })
    expect(json(getRes2)).toEqual([])
  })
})

// ==================== 浏览历史 ====================

describe('浏览历史 (history)', () => {
  beforeEach(() => {
    execute(
      `INSERT INTO articles (id, type, title, "desc", author, tags, steps)
       VALUES (1, 'PLC', '文章1', '...', '张工', '[]', '[]')`,
    )
  })

  it('POST → GET → DELETE 循环', async () => {
    // 添加
    const addRes = await fastify.inject({
      method: 'POST', url: '/user/history',
      payload: { articleId: 1 },
      headers: { authorization: engToken },
    })
    expect(addRes.statusCode).toBe(200)

    // 读取
    const getRes = await fastify.inject({
      method: 'GET', url: '/user/history',
      headers: { authorization: engToken },
    })
    expect(json(getRes)).toContain(1)

    // 清空
    await fastify.inject({
      method: 'DELETE', url: '/user/history',
      headers: { authorization: engToken },
    })
    const getRes2 = await fastify.inject({
      method: 'GET', url: '/user/history',
      headers: { authorization: engToken },
    })
    expect(json(getRes2)).toEqual([])
  })
})

// ==================== 消息 ====================

describe('消息 (message)', () => {
  beforeEach(() => {
    execute(
      `INSERT INTO messages (id, user_id, type, sender, action, content, unread)
       VALUES (1, ${ENGINEER.id}, 'system', '系统', '通知', '欢迎使用', 1)`,
    )
  })

  it('GET 应返回消息列表', async () => {
    const res = await fastify.inject({
      method: 'GET', url: '/user/messages',
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.data || body).toBeTruthy()
  })

  it('PUT /read 应批量标记已读', async () => {
    const res = await fastify.inject({
      method: 'PUT', url: '/user/messages/read',
      payload: { ids: [1] },
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(200)
    expect(json(res).ok).toBe(true)
  })
})

// ==================== 好友 ====================

describe('好友管理 (friend)', () => {
  it('GET 初始为空', async () => {
    const res = await fastify.inject({
      method: 'GET', url: '/user/friends',
      headers: { authorization: engToken },
    })
    expect(res.statusCode).toBe(200)
    expect(json(res)).toEqual([])
  })

  it('POST 发送请求 → 对方接受 → GET 有一人 → DELETE 移除', async () => {
    // 发送好友请求
    const addRes = await fastify.inject({
      method: 'POST', url: '/user/friends',
      payload: { userId: ENGINEER_LI.id },
      headers: { authorization: engToken },
    })
    expect(addRes.statusCode).toBe(200)
    expect(json(addRes).status).toBe('requested')

    // 李工接受请求
    const acceptRes = await fastify.inject({
      method: 'POST', url: '/user/friends/handle',
      payload: { userId: ENGINEER.id, action: 'accept' },
      headers: { authorization: liToken },
    })
    expect(acceptRes.statusCode).toBe(200)

    // 确认好友列表有一人
    const getRes = await fastify.inject({
      method: 'GET', url: '/user/friends',
      headers: { authorization: engToken },
    })
    const friends = json(getRes)
    expect(friends.length).toBeGreaterThanOrEqual(1)

    // 删除
    const delRes = await fastify.inject({
      method: 'DELETE', url: `/user/friends/${ENGINEER_LI.id}`,
      headers: { authorization: engToken },
    })
    expect(delRes.statusCode).toBe(200)
  })
})

describe('用户搜索 (friend)', () => {
  it('GET /user/search?q= 应返回匹配用户', async () => {
    const res = await fastify.inject({
      method: 'GET', url: '/user/search?q=李',
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(200)
    const users = json(res)
    expect(users.some(u => u.name === '李工')).toBe(true)
  })

  it('空关键词应返回 400', async () => {
    const res = await fastify.inject({
      method: 'GET', url: '/user/search?q=',
      headers: { authorization: engToken },
    })
    expect(res.statusCode).toBe(400)
  })
})

// ==================== 管理员列表 ====================

describe('GET /tenant/admins', () => {
  it('应返回管理员列表', async () => {
    const res = await fastify.inject({
      method: 'GET', url: '/tenant/admins',
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(200)
    const admins = json(res)
    expect(admins.length).toBeGreaterThanOrEqual(1)
    expect(admins.some(a => a.role === '系统部署人员')).toBe(true)
  })
})

// ==================== 个人资料 ====================

describe('个人资料 (profile)', () => {
  it('GET /user/profile 应返回当前用户信息', async () => {
    const res = await fastify.inject({
      method: 'GET', url: '/user/profile',
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.name).toBe(ENGINEER.name)
    expect(body.account).toBe(ENGINEER.account)
  })

  it('PUT /user/profile 应更新姓名', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: '/user/profile',
      payload: { name: '张工（已更名）', desc: '更新后的简介' },
      headers: { authorization: engToken, 'content-type': 'application/json' },
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.name).toBe('张工（已更名）')
    expect(body.desc).toBe('更新后的简介')
  })

  it('姓名为空应返回 400', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: '/user/profile',
      payload: { name: '   ' },
      headers: { authorization: engToken, 'content-type': 'application/json' },
    })

    expect(res.statusCode).toBe(400)
  })

  it('GET /user/stats 应返回统计', async () => {
    const res = await fastify.inject({
      method: 'GET', url: '/user/stats',
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body).toHaveProperty('total_posts')
    expect(body).toHaveProperty('total_likes')
    expect(body).toHaveProperty('total_views')
  })
})

// ==================== 租户配置 ====================

describe('租户配置 (tenant)', () => {
  it('GET /tenant/config 默认配置', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/tenant/config' })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.name).toBeTruthy()
  })

  it('管理员能 PUT 更新配置', async () => {
    const res = await fastify.inject({
      method: 'PUT', url: '/tenant/config',
      payload: { name: '自定义名称' },
      headers: { authorization: adminToken },
    })

    expect(res.statusCode).toBe(200)
    expect(json(res).ok).toBe(true)
  })

  it('普通用户不能 PUT', async () => {
    const res = await fastify.inject({
      method: 'PUT', url: '/tenant/config',
      payload: { name: 'hack' },
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(403)
  })

  it('分类标签 CRUD', async () => {
    // POST
    const postRes = await fastify.inject({
      method: 'POST', url: '/tenant/category-tags',
      payload: { name: '新标签' },
      headers: { authorization: adminToken },
    })
    expect(postRes.statusCode).toBe(200)
    const { id } = json(postRes)
    expect(id).toBeGreaterThan(0)

    // PUT
    const putRes = await fastify.inject({
      method: 'PUT', url: `/tenant/category-tags/${id}`,
      payload: { name: '已更新标签' },
      headers: { authorization: adminToken },
    })
    expect(putRes.statusCode).toBe(200)

    // DELETE（软删除）
    const delRes = await fastify.inject({
      method: 'DELETE', url: `/tenant/category-tags/${id}`,
      headers: { authorization: adminToken },
    })
    expect(delRes.statusCode).toBe(200)
  })
})

// ==================== 管理 ====================

describe('管理员用户管理 (admin)', () => {
  it('管理员能获取用户列表', async () => {
    const res = await fastify.inject({
      method: 'GET', url: '/admin/users',
      headers: { authorization: adminToken },
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.data || body).toBeTruthy()
  })

  it('普通用户不能访问管理接口', async () => {
    const res = await fastify.inject({
      method: 'GET', url: '/admin/users',
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(403)
  })

  it('管理员能禁用用户', async () => {
    const res = await fastify.inject({
      method: 'PUT', url: `/admin/users/${ENGINEER.id}/status`,
      payload: { disabled: true },
      headers: { authorization: adminToken },
    })

    expect(res.statusCode).toBe(200)
  })
})

// ==================== 健康检查 ====================
// 注：/api/health 定义在 index.js 中，非路由模块，此处跳过
