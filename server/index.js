// server/index.js
// 工控技术库 · 后端服务入口
// 启动方式：node server/index.js

import { existsSync, mkdirSync, readFileSync } from 'fs'
import { join, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import Fastify from 'fastify'

// Node <21.2 兼容：import.meta.dirname 不可用时回退到 fileURLToPath
const __dirname = import.meta.dirname || dirname(fileURLToPath(import.meta.url))
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import config from './config.js'
import { initDb, getDb } from './db.js'
import authRoutes from './routes/auth.js'
import searchRoutes from './routes/search.js'
import collectionRoutes from './routes/collection.js'
import historyRoutes from './routes/history.js'
import tenantRoutes from './routes/tenant.js'
import articleRoutes from './routes/article.js'
import messageRoutes from './routes/message.js'
import friendRoutes from './routes/friend.js'
import chatRoutes from './routes/chat.js'
import profileRoutes from './routes/profile.js'
import adminRoutes from './routes/admin.js'
import operationLogRoutes from './routes/operationLogs.js'
import uploadRoutes from './routes/upload.js'
import seed from './seed.js'

const fastify = Fastify({
  logger: true,
})

// ==================== 插件注册 ====================

// CORS — 允许前端跨域访问（生产环境可收紧 origin）
await fastify.register(cors, {
  origin: true,
  credentials: true,
})

// Multipart — 文件上传支持（头像等）
await fastify.register(multipart, {
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
})

// 头像存储目录
const AVATAR_DIR = join(__dirname, '..', 'data', 'avatars')
if (!existsSync(AVATAR_DIR)) {
  mkdirSync(AVATAR_DIR, { recursive: true })
}

// 文章图片存储目录
const UPLOADS_DIR = join(__dirname, '..', 'data', 'article-images')
if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true })
}

// ==================== 错误处理 ====================

// 全局错误处理器 — 统一 API 错误响应格式
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error)
  const statusCode = error.statusCode || 500
  reply.status(statusCode).send({
    message: statusCode === 500 ? '服务器内部错误' : (error.message || '请求失败'),
    statusCode,
  })
})

// ==================== 启动流程 ====================

try {
  // 1. 初始化数据库
  await initDb()
  fastify.log.info('数据库已就绪')

  // 2. 写入种子数据
  await seed()

  // 3. 注册路由
  await fastify.register(authRoutes)
  await fastify.register(searchRoutes)
  await fastify.register(collectionRoutes)
  await fastify.register(historyRoutes)
  await fastify.register(tenantRoutes)
  await fastify.register(articleRoutes)
  await fastify.register(messageRoutes)
  await fastify.register(friendRoutes)
  await fastify.register(chatRoutes)
  await fastify.register(profileRoutes)
  await fastify.register(adminRoutes)
  await fastify.register(operationLogRoutes)
  await fastify.register(uploadRoutes)
  fastify.log.info('14 组路由已注册')

  // 4. 头像静态文件服务
  const MIME_MAP = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' }
  fastify.get('/avatars/:filename', async (request, reply) => {
    const filename = basename(request.params.filename)
    const filepath = join(AVATAR_DIR, filename)
    if (!existsSync(filepath)) {
      return reply.status(404).send({ message: '头像不存在' })
    }
    const buf = readFileSync(filepath)
    reply.type(MIME_MAP[extname(filename).toLowerCase()] || 'application/octet-stream')
    return reply.send(buf)
  })

  // 4b. 文章图片静态文件服务
  fastify.get('/uploads/:filename', async (request, reply) => {
    const filename = basename(request.params.filename)
    const filepath = join(UPLOADS_DIR, filename)
    if (!existsSync(filepath)) {
      return reply.status(404).send({ message: '图片不存在' })
    }
    const buf = readFileSync(filepath)
    reply.type(MIME_MAP[extname(filename).toLowerCase()] || 'application/octet-stream')
    return reply.send(buf)
  })

  // 5. 健康检查
  fastify.get('/api/health', async () => ({
    ok: true,
    db: getDb() ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  }))

  // 6. 启动服务
  await fastify.listen({ port: config.PORT, host: config.HOST })
  fastify.log.info(`服务已启动 → http://localhost:${config.PORT}`)
  fastify.log.info(`健康检查 → http://localhost:${config.PORT}/api/health`)
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}

export default fastify
