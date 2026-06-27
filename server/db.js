// server/db.js
// SQLite 数据库层 — 使用 sql.js (WebAssembly, 零原生依赖)
// 数据持久化到 ./data/database.db 文件

import initSqlJs from 'sql.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = resolve(__dirname, '..', 'data', 'database.db')

let db = null

// ==================== 建表 SQL ====================
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '一线工程师',
  avatar TEXT DEFAULT '',
  department TEXT DEFAULT '',
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  term TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  "desc" TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT (datetime('now')),
  likes INTEGER NOT NULL DEFAULT 0,
  comments INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  steps TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_collections (
  user_id INTEGER NOT NULL,
  article_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, article_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_history (
  user_id INTEGER NOT NULL,
  article_id INTEGER NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, article_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS category_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tenant_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '工控技术库',
  org_type TEXT NOT NULL DEFAULT '企业',
  logo_url TEXT NOT NULL DEFAULT '',
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  reply_to INTEGER DEFAULT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  sender TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  target_id INTEGER DEFAULT NULL,
  unread INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_friends (
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, friend_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_likes (
  user_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, target_type, target_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
`

// ==================== 初始化 ====================
let initPromise = null

export async function initDb() {
  if (initPromise) return initPromise

  initPromise = (async () => {
    const SQL = await initSqlJs()

    // 确保 data 目录存在
    const dir = dirname(DB_PATH)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    // 尝试从文件加载已有数据库
    if (existsSync(DB_PATH)) {
      try {
        const buffer = readFileSync(DB_PATH)
        db = new SQL.Database(buffer)
      } catch {
        db = new SQL.Database()
      }
    } else {
      db = new SQL.Database()
    }

    // 执行建表
    db.run(SCHEMA)

    // 兼容性迁移：旧表可能缺少 desc 列
    try { db.run('ALTER TABLE users ADD COLUMN desc TEXT NOT NULL DEFAULT \'\'') } catch { /* 列已存在 */ }
    try { db.run('ALTER TABLE users ADD COLUMN department TEXT NOT NULL DEFAULT \'\'') } catch { /* 列已存在 */ }
    try { db.run('ALTER TABLE users ADD COLUMN last_active TEXT NOT NULL DEFAULT \'\'') } catch { /* 列已存在 */ }
    try { db.run('CREATE TABLE IF NOT EXISTS user_likes (user_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), PRIMARY KEY (user_id, target_type, target_id), FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)') } catch { /* 表已存在 */ }

    persist()

    return db
  })()

  return initPromise
}

/** 获取当前数据库实例（必须在 initDb 之后调用） */
export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.')
  return db
}

/** 持久化到磁盘 */
export function persist() {
  if (!db) return
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(DB_PATH, buffer)
}

// ==================== 辅助查询工具 ====================

/** 执行查询，返回数组 */
export function queryAll(sql, params = []) {
  const stmt = getDb().prepare(sql)
  if (params.length > 0) stmt.bind(params)
  const rows = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()
  return rows
}

/** 执行查询，返回单行或 null */
export function queryOne(sql, params = []) {
  const stmt = getDb().prepare(sql)
  if (params.length > 0) stmt.bind(params)
  let row = null
  if (stmt.step()) {
    row = stmt.getAsObject()
  }
  stmt.free()
  return row
}

/** 执行写操作（INSERT/UPDATE/DELETE），返回 lastInsertRowid */
export function execute(sql, params = []) {
  getDb().run(sql, params)
  persist()
  return getDb().getRowsModified()
}

// ==================== 测试工具 ====================

/** 注入外部数据库实例（仅测试用） */
export function __setDbForTest(testDb) {
  db = testDb
  initPromise = Promise.resolve(testDb)
}

/** 重置测试状态 */
export function __resetForTest() {
  db = null
  initPromise = null
}

export { SCHEMA }
