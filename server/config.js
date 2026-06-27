// server/config.js
// 集中管理配置 — 环境变量 > 持久化密钥文件 > 随机生成

import { randomBytes } from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = parseInt(process.env.PORT || '3000', 10)
const HOST = process.env.HOST || '0.0.0.0'

// JWT 密钥持久化路径
const SECRET_FILE = join(__dirname, '.secrets.json')

/**
 * 加载 JWT 密钥，优先级：
 * 1. 环境变量 JWT_SECRET / JWT_REFRESH_SECRET
 * 2. 本地持久化文件 server/.secrets.json
 * 3. 随机生成并自动持久化至 server/.secrets.json
 */
function loadSecrets() {
  if (process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET) {
    return {
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    }
  }

  if (existsSync(SECRET_FILE)) {
    try {
      const data = JSON.parse(readFileSync(SECRET_FILE, 'utf8'))
      if (data.JWT_SECRET && data.JWT_REFRESH_SECRET) {
        return data
      }
    } catch {
      // 文件损坏，重新生成
    }
  }

  // 生成新密钥并持久化
  const secrets = {
    JWT_SECRET: randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
  }
  try {
    writeFileSync(SECRET_FILE, JSON.stringify(secrets, null, 2), 'utf8')
  } catch {
    // 写入失败不影响启动，但下次重启会重新生成
  }
  return secrets
}

const { JWT_SECRET, JWT_REFRESH_SECRET } = loadSecrets()

/** access token 有效期 */
const ACCESS_TOKEN_TTL = 60 * 60 * 2 // 2 小时

/** refresh token 有效期 */
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 7 // 7 天

export default {
  PORT,
  HOST,
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
}
