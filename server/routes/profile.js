// server/routes/profile.js
// 用户个人资料

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import { queryOne, queryAll, execute } from '../db.js'

// Node <21.2 兼容：import.meta.dirname 不可用时回退到 fileURLToPath
const __dirname = import.meta.dirname || dirname(fileURLToPath(import.meta.url))
import { authGuard } from '../middleware/auth.js'
import { adminGuard } from '../middleware/admin.js'
import bcrypt from 'bcryptjs'

export default async function profileRoutes(fastify) {
  /**
   * GET /user/profile
   * 获取当前登录用户的资料
   */
  fastify.get('/user/profile', { preHandler: authGuard }, async (request) => {
    const row = queryOne(
      'SELECT id, account, name, avatar, role, department, desc FROM users WHERE id = ?',
      [request.user.userId],
    )
    if (!row) {
      return { account: request.user.account, name: request.user.name, avatar: '', desc: '' }
    }
    return {
      avatar: row.avatar || '',
      account: row.account,
      name: row.name,
      role: row.role,
      department: row.department || '',
      desc: row.desc || '',
    }
  })

  /**
   * PUT /user/profile
   * 更新当前用户资料（支持 JSON 或 multipart/form-data 头像上传）
   */
  fastify.put('/user/profile', { preHandler: authGuard }, async (request, reply) => {
    const contentType = request.headers['content-type'] || ''
    let name, desc, avatarUrl = ''

    if (contentType.includes('multipart/form-data')) {
      // 解析 multipart：头像文件 + 文本字段
      try {
        const parts = request.parts()
        for await (const part of parts) {
          if (part.file) {
            // 头像文件
            const ext = extname(part.filename).toLowerCase() || '.png'
            const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
            if (!allowedExts.includes(ext)) {
              return reply.status(400).send({ message: '头像仅支持 PNG/JPG/GIF/WebP 格式' })
            }
            const AVATAR_DIR = join(__dirname, '..', '..', 'data', 'avatars')
            if (!existsSync(AVATAR_DIR)) {
              mkdirSync(AVATAR_DIR, { recursive: true })
            }
            const filename = `avatar_${request.user.userId}_${Date.now()}${ext}`
            const filepath = join(AVATAR_DIR, filename)
            const buf = await part.toBuffer()
            writeFileSync(filepath, buf)
            avatarUrl = `/avatars/${filename}`
          } else if (part.fieldname === 'name') {
            name = part.value
          } else if (part.fieldname === 'desc') {
            desc = part.value
          }
        }
      } catch (err) {
        return reply.status(400).send({ message: '文件上传失败: ' + (err.message || '未知错误') })
      }
    } else {
      // JSON 模式
      const body = request.body || {}
      name = body.name
      desc = body.desc
    }

    // 更新数据库
    if (name !== undefined) {
      const trimmedName = name.trim()
      if (!trimmedName) {
        return reply.status(400).send({ message: '姓名不能为空' })
      }
      execute('UPDATE users SET name = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [
        trimmedName,
        request.user.userId,
      ])
    }
    if (desc !== undefined) {
      execute('UPDATE users SET desc = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [
        desc.trim(),
        request.user.userId,
      ])
    }
    if (avatarUrl) {
      execute('UPDATE users SET avatar = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [
        avatarUrl,
        request.user.userId,
      ])
    }

    // 返回更新后的数据
    const row = queryOne(
      'SELECT id, account, name, avatar, role, department, desc FROM users WHERE id = ?',
      [request.user.userId],
    )
    return {
      avatar: row.avatar || '',
      account: row.account,
      name: row.name,
      role: row.role,
      department: row.department || '',
      desc: row.desc || '',
    }
  })

  /**
   * PUT /user/password
   * 修改当前用户密码（需验证旧密码）
   */
  fastify.put('/user/password', { preHandler: [authGuard, adminGuard] }, async (request, reply) => {
    const { oldPassword, newPassword } = request.body || {}

    if (!oldPassword || !newPassword) {
      return reply.status(400).send({ message: '请填写旧密码和新密码' })
    }

    if (newPassword.length < 6) {
      return reply.status(400).send({ message: '新密码至少需要 6 位' })
    }

    if (newPassword.length > 32) {
      return reply.status(400).send({ message: '新密码不能超过 32 位' })
    }

    // 验证旧密码
    const user = queryOne('SELECT password FROM users WHERE id = ?', [request.user.userId])
    if (!user) {
      return reply.status(404).send({ message: '用户不存在' })
    }

    const valid = await bcrypt.compare(oldPassword, user.password)
    if (!valid) {
      return reply.status(400).send({ message: '旧密码不正确' })
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    execute('UPDATE users SET password = ? WHERE id = ?', [hashed, request.user.userId])

    return { ok: true }
  })

  /**
   * GET /user/stats
   * 当前用户的文章聚合统计
   */
  fastify.get('/user/stats', { preHandler: authGuard }, async (request) => {
    const row = queryOne(
      `SELECT
         COALESCE(SUM(likes), 0)     AS total_likes,
         COALESCE(SUM(views), 0)     AS total_views,
         COALESCE(SUM(comments), 0)  AS total_comments,
         COUNT(*)                    AS total_posts
       FROM articles WHERE author = ?`,
      [request.user.name],
    )
    return row || { total_likes: 0, total_views: 0, total_comments: 0, total_posts: 0 }
  })
}
