// server/__tests__/helpers.js
// 测试工具库 — 内存数据库 + Fastify 测试实例

import { existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import initSqlJs from 'sql.js'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { __setDbForTest, __resetForTest, SCHEMA, execute } from '../db.js'
import config from '../config.js'

// 确保 data/ 目录存在（persist() 需要写入 — 否则写操作在磁盘不可写时会抛异常）
const __testDir = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__testDir, '..', '..', 'data')
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

// ==================== 测试用户预设 ====================

export const SUPER_ADMIN = {
  id: 1,
  account: 'admin',
  password: 'admin123',
  name: '系统部署员',
  role: '系统部署人员',
  department: '信息技术部',
}

export const ENGINEER = {
  id: 2,
  account: 'ENG_20240601',
  password: '123456',
  name: '张工',
  role: '一线工程师',
  department: '自动化部',
}

export const ENGINEER_LI = {
  id: 3,
  account: 'ENG_20230512',
  password: '123456',
  name: '李工',
  role: '一线工程师',
  department: '自动化部',
}

// ==================== 内存数据库 ====================

let SQL = null

/**
 * 创建内存数据库并注入到 db.js
 * 每个测试用例调用一次，保证隔离
 */
export async function setupTestDb() {
  // 只初始化一次 sql.js WASM
  if (!SQL) {
    SQL = await initSqlJs()
  }

  // 重置 db.js 的内部状态
  __resetForTest()
  const db = new SQL.Database()

  // 执行建表 + 兼容性迁移（与 initDb 一致）
  db.run(SCHEMA)
  db.run('PRAGMA foreign_keys = ON')
  try { db.run("ALTER TABLE users ADD COLUMN desc TEXT NOT NULL DEFAULT ''") } catch { /* 已存在 */ }
  try { db.run('ALTER TABLE users ADD COLUMN department TEXT NOT NULL DEFAULT \'\'') } catch { /* 已存在 */ }
  try { db.run('ALTER TABLE users ADD COLUMN last_active TEXT NOT NULL DEFAULT \'\'') } catch { /* 已存在 */ }
  try { db.run("CREATE TABLE IF NOT EXISTS user_likes (user_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, target_type, target_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)") } catch { /* 已存在 */ }
  try { db.run("ALTER TABLE articles ADD COLUMN status TEXT NOT NULL DEFAULT 'published'") } catch { /* 已存在 */ }
  try { db.run('CREATE TABLE IF NOT EXISTS operation_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, operator TEXT NOT NULL, operator_role TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT \'\', created_at TEXT NOT NULL DEFAULT (datetime(\'now\')))') } catch { /* 已存在 */ }
  __setDbForTest(db)

  // 写入种子用户
  const users = [SUPER_ADMIN, ENGINEER, ENGINEER_LI]
  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10)
    db.run(
      'INSERT INTO users (id, account, password, name, role, department) VALUES (?, ?, ?, ?, ?, ?)',
      [u.id, u.account, hashed, u.name, u.role, u.department],
    )
  }

  return db
}

// ==================== Fastify 测试实例 ====================

/**
 * 创建带路由的 Fastify 测试实例
 * @param {string[]} routeModules - 要注册的路由模块名，如 ['auth', 'article']
 *   传 'all' 注册全部路由
 */
export async function createTestServer(routeModules = 'all') {
  const fastify = Fastify({ logger: false })

  await fastify.register(cors, { origin: true, credentials: true })

  // 全局错误处理（与生产一致）
  fastify.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode || 500
    reply.status(statusCode).send({
      message: statusCode === 500 ? '服务器内部错误' : (error.message || '请求失败'),
      statusCode,
    })
  })

  // 注册路由
  const allModules = routeModules === 'all'
    ? ['auth', 'article', 'search', 'collection', 'history', 'message', 'friend', 'profile', 'tenant', 'admin', 'operationLogs']
    : routeModules

  for (const name of allModules) {
    const mod = await import(`../routes/${name}.js`)
    await fastify.register(mod.default)
  }

  await fastify.ready()
  return fastify
}

// ==================== 鉴权辅助 ====================

/**
 * 生成 Bearer token
 */
export function makeToken(user) {
  const payload = { userId: user.id, role: user.role, name: user.name, account: user.account }
  return 'Bearer ' + jwt.sign(payload, config.JWT_SECRET, { expiresIn: '2h' })
}

/**
 * 发送带 auth 的请求
 */
export function authedRequest(fastify, token) {
  return {
    get: (url, query) => fastify.inject({ method: 'GET', url, query, headers: { authorization: token } }),
    post: (url, body) => fastify.inject({ method: 'POST', url, payload: body, headers: { authorization: token } }),
    put: (url, body) => fastify.inject({ method: 'PUT', url, payload: body, headers: { authorization: token } }),
    delete: (url) => fastify.inject({ method: 'DELETE', url, headers: { authorization: token } }),
  }
}

/**
 * 解析 JSON 响应体
 */
export function json(res) {
  return JSON.parse(res.body)
}

// ==================== 生命周期 ====================

/**
 * 每个测试后清理
 */
export async function teardownTest(fastify) {
  if (fastify) {
    await fastify.close()
  }
  __resetForTest()
}
