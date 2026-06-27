// server/__tests__/db.test.js
// 数据库层单元测试 — 内存模式

import { existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import initSqlJs from 'sql.js'
import { __setDbForTest, __resetForTest, queryOne, queryAll, execute, SCHEMA } from '../db.js'

// 确保 data/ 目录存在
const __testDir = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__testDir, '..', '..', 'data')
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

let SQL = null
let db = null

beforeEach(async () => {
  if (!SQL) SQL = await initSqlJs()
  db = new SQL.Database()
  db.run(SCHEMA)
  db.run('PRAGMA foreign_keys = ON')
  // 执行兼容性迁移（last_active, department, desc 列）
  try { db.run("ALTER TABLE users ADD COLUMN desc TEXT NOT NULL DEFAULT ''") } catch { /* 已存在 */ }
  try { db.run('ALTER TABLE users ADD COLUMN department TEXT NOT NULL DEFAULT \'\'') } catch { /* 已存在 */ }
  try { db.run('ALTER TABLE users ADD COLUMN last_active TEXT NOT NULL DEFAULT \'\'') } catch { /* 已存在 */ }
  try { db.run("CREATE TABLE IF NOT EXISTS user_likes (user_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (user_id, target_type, target_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)") } catch { /* 已存在 */ }
  __setDbForTest(db)
})

afterEach(() => {
  __resetForTest()
  db = null
})

describe('数据库初始化和建表', () => {
  it('应该成功创建所有表', () => {
    const tables = queryAll("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    const names = tables.map(t => t.name).sort()
    expect(names).toContain('articles')
    expect(names).toContain('users')
    expect(names).toContain('comments')
    expect(names).toContain('messages')
    expect(names).toContain('user_friends')
    expect(names).toContain('user_likes')
    expect(names).toContain('user_collections')
    expect(names).toContain('user_history')
    expect(names).toContain('category_tags')
    expect(names).toContain('tenant_config')
    expect(names).toContain('refresh_tokens')
    expect(names).toContain('search_history')
  })

  it('应该包含 users 表的必要列', () => {
    const cols = queryAll("PRAGMA table_info('users')")
    const colNames = cols.map(c => c.name)
    expect(colNames).toContain('id')
    expect(colNames).toContain('account')
    expect(colNames).toContain('password')
    expect(colNames).toContain('name')
    expect(colNames).toContain('role')
    expect(colNames).toContain('disabled')
  })
})

describe('execute — 写操作', () => {
  it('INSERT + UPDATE 应该正确执行', () => {
    execute("INSERT INTO users (id, account, password, name, role) VALUES (10, 'test', 'pw', 'Test', '一线工程师')")
    let row = queryOne("SELECT name FROM users WHERE id = 10")
    expect(row.name).toBe('Test')

    execute("UPDATE users SET name = 'Updated' WHERE id = 10")
    row = queryOne("SELECT name FROM users WHERE id = 10")
    expect(row.name).toBe('Updated')
  })

  it('应该支持参数化查询防止 SQL 注入', () => {
    execute("INSERT INTO users (id, account, password, name, role) VALUES (11, 'safe_user', 'pw', 'Safe', '一线工程师')")
    const row = queryOne("SELECT name FROM users WHERE account = ?", ['safe_user'])
    expect(row.name).toBe('Safe')
  })
})

describe('queryOne — 单行查询', () => {
  beforeEach(() => {
    execute("INSERT INTO users (id, account, password, name, role) VALUES (1, 'a1', 'pw', 'Alice', '管理员')")
    execute("INSERT INTO users (id, account, password, name, role) VALUES (2, 'a2', 'pw', 'Bob', '一线工程师')")
  })

  it('应该返回匹配的单行', () => {
    const row = queryOne("SELECT * FROM users WHERE account = ?", ['a1'])
    expect(row.name).toBe('Alice')
    expect(row.role).toBe('管理员')
  })

  it('不匹配时应该返回 null', () => {
    const row = queryOne("SELECT * FROM users WHERE account = ?", ['nobody'])
    expect(row).toBeNull()
  })
})

describe('queryAll — 多行查询', () => {
  beforeEach(() => {
    execute("INSERT INTO users (id, account, password, name, role) VALUES (1, 'u1', 'pw', 'U1', '管理员')")
    execute("INSERT INTO users (id, account, password, name, role) VALUES (2, 'u2', 'pw', 'U2', '一线工程师')")
    execute("INSERT INTO users (id, account, password, name, role) VALUES (3, 'u3', 'pw', 'U3', '一线工程师')")
  })

  it('应该返回所有匹配行', () => {
    const rows = queryAll("SELECT * FROM users WHERE role = '一线工程师'")
    expect(rows).toHaveLength(2)
  })

  it('无匹配时应该返回空数组', () => {
    const rows = queryAll("SELECT * FROM users WHERE role = '不存在的角色'")
    expect(rows).toEqual([])
  })

  it('应该支持 LIMIT', () => {
    const rows = queryAll('SELECT * FROM users ORDER BY id LIMIT 1')
    expect(rows).toHaveLength(1)
  })
})

describe('约束和事务行为', () => {
  it('UNIQUE 约束应该阻止重复 account', () => {
    execute("INSERT INTO users (id, account, password, name) VALUES (1, 'dup', 'pw', 'First')")
    expect(() => {
      execute("INSERT INTO users (id, account, password, name) VALUES (2, 'dup', 'pw', 'Second')")
    }).toThrow()
  })

  it('DELETE 应该能正确清理关联数据', () => {
    execute("INSERT INTO users (id, account, password, name) VALUES (1, 'u', 'pw', 'U')")
    execute("INSERT INTO articles (id, title, author) VALUES (1, 'Test', 'U')")
    execute("INSERT INTO user_collections (user_id, article_id) VALUES (1, 1)")
    let rows = queryAll('SELECT * FROM user_collections')
    expect(rows).toHaveLength(1)

    // 先手动清理关联数据
    execute('DELETE FROM user_collections WHERE user_id = 1')
    execute('DELETE FROM articles WHERE id = 1')
    execute('DELETE FROM users WHERE id = 1')

    rows = queryAll('SELECT * FROM user_collections')
    expect(rows).toHaveLength(0)
    rows = queryAll('SELECT * FROM users WHERE id = 1')
    expect(rows).toHaveLength(0)
  })
})
