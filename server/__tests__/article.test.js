// server/__tests__/article.test.js
// 文章路由测试 — CRUD + 评论 + 点赞

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  setupTestDb, createTestServer, teardownTest,
  SUPER_ADMIN, ENGINEER, ENGINEER_LI,
  makeToken, authedRequest, json,
} from './helpers.js'
import { execute, queryOne } from '../db.js'

let fastify
let adminToken
let engToken

beforeEach(async () => {
  await setupTestDb()
  fastify = await createTestServer(['article'])
  adminToken = makeToken(SUPER_ADMIN)
  engToken = makeToken(ENGINEER)
})

afterEach(async () => {
  await teardownTest(fastify)
})

// ==================== 文章 CRUD ====================

describe('POST /articles — 创建文章', () => {
  it('应该成功创建文章', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/articles',
      payload: {
        type: '西门子 S7-1200',
        title: '测试文章标题',
        desc: '这是一篇测试文章',
        tags: ['PLC类', '测试'],
        steps: ['步骤1', '步骤2'],
      },
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.title).toBe('测试文章标题')
    expect(body.author).toBe(ENGINEER.name)
    expect(body.id).toBeGreaterThan(0)
  })

  it('标题为空应返回 400', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/articles',
      payload: { title: '' },
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(400)
  })

  it('未登录创建应返回 401', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/articles',
      payload: { title: 'test' },
    })

    expect(res.statusCode).toBe(401)
  })
})

describe('GET /articles/:id — 获取文章详情', () => {
  let articleId

  beforeEach(() => {
    execute(
      `INSERT INTO articles (id, type, title, "desc", author, tags, steps)
       VALUES (1, 'PLC', '测试标题', '测试描述', '张工', '[]', '[]')`,
    )
    articleId = 1
  })

  it('应该返回文章详情', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: `/articles/${articleId}`,
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.title).toBe('测试标题')
    expect(body.author).toBe('张工')
  })

  it('不存在的文章应返回 404', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/articles/99999',
    })

    expect(res.statusCode).toBe(404)
  })
})

describe('PUT /articles/:id — 更新文章', () => {
  beforeEach(() => {
    execute(
      `INSERT INTO articles (id, type, title, "desc", author, tags, steps)
       VALUES (1, 'PLC', '原标题', '原描述', '张工', '[]', '[]')`,
    )
  })

  it('作者本人应该能更新文章', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: '/articles/1',
      payload: { title: '修改后的标题' },
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(200)
    expect(json(res).title).toBe('修改后的标题')
  })

  it('非作者应该不能更新', async () => {
    const liToken = makeToken(ENGINEER_LI)
    const res = await fastify.inject({
      method: 'PUT',
      url: '/articles/1',
      payload: { title: 'hack' },
      headers: { authorization: liToken },
    })

    expect(res.statusCode).toBe(403)
  })

  it('管理员应该能编辑他人文章', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: '/articles/1',
      payload: { title: '管理员修改的标题' },
      headers: { authorization: adminToken },
    })

    expect(res.statusCode).toBe(200)
    expect(json(res).title).toBe('管理员修改的标题')
  })

  it('管理员编辑他人文章后应通知作者', async () => {
    const res = await fastify.inject({
      method: 'PUT',
      url: '/articles/1',
      payload: { title: '再次修改' },
      headers: { authorization: adminToken },
    })

    expect(res.statusCode).toBe(200)

    // 检查数据库中的通知消息
    const msg = queryOne(
      "SELECT * FROM messages WHERE user_id = ? AND type = 'system' AND action = '修改了你的文章' AND target_id = 1",
      [ENGINEER.id],
    )
    expect(msg).toBeTruthy()
  })
})

describe('DELETE /articles/:id — 删除文章', () => {
  beforeEach(() => {
    execute(
      `INSERT INTO articles (id, type, title, "desc", author, tags, steps)
       VALUES (1, 'PLC', '待删文章', '...', '张工', '[]', '[]')`,
    )
  })

  it('作者本人应该能删除', async () => {
    const res = await fastify.inject({
      method: 'DELETE',
      url: '/articles/1',
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(200)
    expect(json(res).ok).toBe(true)
  })

  it('管理员应该能删除他人的文章', async () => {
    const res = await fastify.inject({
      method: 'DELETE',
      url: '/articles/1',
      headers: { authorization: adminToken },
    })

    expect(res.statusCode).toBe(200)
  })

  it('普通用户不能删除他人文章', async () => {
    const liToken = makeToken(ENGINEER_LI)
    const res = await fastify.inject({
      method: 'DELETE',
      url: '/articles/1',
      headers: { authorization: liToken },
    })

    expect(res.statusCode).toBe(403)
  })

  it('管理员下架他人文章后应通知作者', async () => {
    const res = await fastify.inject({
      method: 'DELETE',
      url: '/articles/1',
      headers: { authorization: adminToken },
    })

    expect(res.statusCode).toBe(200)

    // 检查数据库中的通知消息
    const msg = queryOne(
      "SELECT * FROM messages WHERE user_id = ? AND type = 'system' AND action = '下架了你的文章' AND target_id = 1",
      [ENGINEER.id],
    )
    expect(msg).toBeTruthy()
  })

  it('作者本人下架文章不应给自己发通知', async () => {
    const res = await fastify.inject({
      method: 'DELETE',
      url: '/articles/1',
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(200)

    // 作者本人删除，不应该有通知
    const msg = queryOne(
      "SELECT * FROM messages WHERE user_id = ? AND type = 'system' AND action = '下架了你的文章' AND target_id = 1",
      [ENGINEER.id],
    )
    expect(msg).toBeNull()
  })
})

describe('GET /articles/search — 搜索文章', () => {
  beforeEach(() => {
    execute(
      `INSERT INTO articles (id, type, title, "desc", author, tags, steps)
       VALUES (1, '西门子', 'PLC故障排查', 'S7-1200', '张工', '["PLC类"]', '[]')`,
    )
    execute(
      `INSERT INTO articles (id, type, title, "desc", author, tags, steps)
       VALUES (2, '汇川', '变频器过压', 'MD380', '李工', '["变频器"]', '[]')`,
    )
  })

  it('全文搜索应该返回匹配结果', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/articles/search?q=PLC',
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.list).toHaveLength(1)
    expect(body.list[0].title).toBe('PLC故障排查')
  })

  it('标签筛选应该生效', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/articles/search?tag=变频器',
    })

    const body = json(res)
    expect(body.list).toHaveLength(1)
    expect(body.list[0].title).toBe('变频器过压')
  })

  it('无匹配应返回空列表', async () => {
    const res = await fastify.inject({
      method: 'GET',
      url: '/articles/search?q=nonexistent',
    })

    const body = json(res)
    expect(body.list).toHaveLength(0)
    expect(body.total).toBe(0)
  })
})

// ==================== 点赞 ====================

describe('POST /articles/:id/like — 点赞/取消', () => {
  beforeEach(() => {
    execute(
      `INSERT INTO articles (id, type, title, "desc", author, tags, steps, likes)
       VALUES (1, 'PLC', '测试', '...', '张工', '[]', '[]', 5)`,
    )
  })

  it('首次点赞应 +1', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/articles/1/like',
      headers: { authorization: makeToken(ENGINEER_LI) },
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.liked).toBe(true)
    expect(body.likes).toBe(6)
  })

  it('再次点赞应取消（toggle）', async () => {
    const liToken = makeToken(ENGINEER_LI)
    // 点赞
    await fastify.inject({ method: 'POST', url: '/articles/1/like', headers: { authorization: liToken } })
    // 取消
    const res = await fastify.inject({ method: 'POST', url: '/articles/1/like', headers: { authorization: liToken } })

    const body = json(res)
    expect(body.liked).toBe(false)
    expect(body.likes).toBe(5)
  })
})

// ==================== 评论 ====================

describe('文章评论功能', () => {
  beforeEach(() => {
    execute(
      `INSERT INTO articles (id, type, title, "desc", author, tags, steps, comments)
       VALUES (1, 'PLC', '测试', '...', '张工', '[]', '[]', 0)`,
    )
  })

  it('应该能发表顶级评论', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/articles/1/comments',
      payload: { content: '这篇文章很好' },
      headers: { authorization: makeToken(ENGINEER_LI) },
    })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body.content).toBe('这篇文章很好')
    expect(body.author).toBe(ENGINEER_LI.name)
    expect(body.replies).toEqual([])
  })

  it('应该能回复评论', async () => {
    // 先发顶级评论
    await fastify.inject({
      method: 'POST',
      url: '/articles/1/comments',
      payload: { content: '顶级评论' },
      headers: { authorization: makeToken(ENGINEER_LI) },
    })

    // 回复
    const res = await fastify.inject({
      method: 'POST',
      url: '/articles/1/comments',
      payload: { content: '回复内容', replyTo: 1 },
      headers: { authorization: engToken },
    })

    expect(res.statusCode).toBe(200)
  })

  it('应该能获取评论（含嵌套结构）', async () => {
    // 发顶级评论 + 回复
    await fastify.inject({
      method: 'POST',
      url: '/articles/1/comments',
      payload: { content: '顶级' },
      headers: { authorization: engToken },
    })
    await fastify.inject({
      method: 'POST',
      url: '/articles/1/comments',
      payload: { content: '回复', replyTo: 1 },
      headers: { authorization: makeToken(ENGINEER_LI) },
    })

    const res = await fastify.inject({ method: 'GET', url: '/articles/1/comments' })

    expect(res.statusCode).toBe(200)
    const body = json(res)
    expect(body).toHaveLength(1) // 1 条顶级
    expect(body[0].replies).toHaveLength(1) // 1 条回复
  })

  it('评论作者可以删除自己的评论', async () => {
    await fastify.inject({
      method: 'POST',
      url: '/articles/1/comments',
      payload: { content: '待删' },
      headers: { authorization: engToken },
    })

    const delRes = await fastify.inject({
      method: 'DELETE',
      url: '/comments/1',
      headers: { authorization: engToken },
    })

    expect(delRes.statusCode).toBe(200)
    expect(json(delRes).ok).toBe(true)
  })

  it('非作者不能删除他人评论', async () => {
    await fastify.inject({
      method: 'POST',
      url: '/articles/1/comments',
      payload: { content: '不可删' },
      headers: { authorization: engToken },
    })

    const delRes = await fastify.inject({
      method: 'DELETE',
      url: '/comments/1',
      headers: { authorization: makeToken(ENGINEER_LI) },
    })

    expect(delRes.statusCode).toBe(403)
  })
})
