// server/routes/upload.js
// 文章图片上传接口 + 平台 Logo 上传

import { existsSync, mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { join, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { authGuard } from '../middleware/auth.js'
import { adminGuard } from '../middleware/admin.js'
import { queryOne, execute } from '../db.js'

const __dirname = import.meta.dirname || dirname(fileURLToPath(import.meta.url))
const IMAGE_DIR = join(__dirname, '..', '..', 'data', 'article-images')
const LOGO_DIR = join(__dirname, '..', '..', 'data', 'logo')

export default async function uploadRoutes(fastify) {
  // 确保图片存储目录存在
  if (!existsSync(IMAGE_DIR)) {
    mkdirSync(IMAGE_DIR, { recursive: true })
  }
  if (!existsSync(LOGO_DIR)) {
    mkdirSync(LOGO_DIR, { recursive: true })
  }

  /**
   * POST /api/upload
   * 上传文章图片（单张或多张）
   * 返回 { images: [{ id, url }] }
   */
  fastify.post('/api/upload', { preHandler: authGuard }, async (request, reply) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    const mimeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }

    const uploaded = []

    try {
      const parts = request.parts()
      for await (const part of parts) {
        if (!part.file) continue

        const ext = extname(part.filename).toLowerCase()
        if (!allowedExts.includes(ext)) {
          return reply.status(400).send({
            message: `图片仅支持 JPG/PNG/GIF/WebP 格式，不支持 ${ext}`,
          })
        }

        // 生成唯一文件名
        const id = randomUUID()
        const filename = `${id}${ext}`
        const filepath = join(IMAGE_DIR, filename)

        const buf = await part.toBuffer()

        // 文件大小校验（5MB）
        if (buf.length > 5 * 1024 * 1024) {
          return reply.status(400).send({
            message: `图片 "${part.filename}" 超过 5MB 限制`,
          })
        }

        writeFileSync(filepath, buf)
        uploaded.push({
          id,
          url: `/uploads/${filename}`,
        })
      }
    } catch (err) {
      return reply.status(500).send({
        message: '图片上传失败: ' + (err.message || '未知错误'),
      })
    }

    if (uploaded.length === 0) {
      return reply.status(400).send({ message: '未检测到图片文件' })
    }

    return { images: uploaded }
  })

  /**
   * DELETE /api/upload/:id
   * 删除已上传的图片
   */
  fastify.delete('/api/upload/:id', { preHandler: authGuard }, async (request, reply) => {
    const { id } = request.params
    // 查找匹配的文件（不确定扩展名）
    const files = readdirSync(IMAGE_DIR)
    const target = files.find(f => f.startsWith(id))
    if (!target) {
      return reply.status(404).send({ message: '图片不存在' })
    }
    try {
      unlinkSync(join(IMAGE_DIR, target))
      return { ok: true }
    } catch (err) {
      return reply.status(500).send({ message: '图片删除失败' })
    }
  })

  // ==================== 平台 Logo 上传 ====================

  const LOGO_ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.svg', '.webp']
  const LOGO_MIME_MAP = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.webp': 'image/webp',
  }

  /**
   * POST /api/upload/logo
   * 上传平台 Logo（管理员及以上）
   * 单文件，覆盖旧 Logo，最大 2MB
   */
  fastify.post('/api/upload/logo', { preHandler: [authGuard, adminGuard] }, async (request, reply) => {
    const parts = request.parts()
    for await (const part of parts) {
      if (!part.file) continue

      const ext = extname(part.filename).toLowerCase()
      if (!LOGO_ALLOWED_EXT.includes(ext)) {
        return reply.status(400).send({
          message: `Logo 仅支持 JPG/PNG/SVG/WebP 格式，不支持 ${ext}`,
        })
      }

      const buf = await part.toBuffer()

      // 文件大小校验（2MB）
      if (buf.length > 2 * 1024 * 1024) {
        return reply.status(400).send({ message: 'Logo 文件不能超过 2MB' })
      }

      // 清理旧 Logo 文件
      try {
        const oldFiles = readdirSync(LOGO_DIR)
        for (const f of oldFiles) unlinkSync(join(LOGO_DIR, f))
      } catch { /* 目录为空或不存在 */ }

      // 保存新 Logo
      const filename = `logo${ext}`
      writeFileSync(join(LOGO_DIR, filename), buf)

      // 更新租户配置中的 logo_url（保留已有 name/subtitle/org_type）
      const logoUrl = `/logo`
      execute(
        "INSERT OR REPLACE INTO tenant_config (id, name, subtitle, org_type, logo_url, updated_at) VALUES (1, (SELECT COALESCE(name,'工控技术库') FROM tenant_config WHERE id=1), (SELECT COALESCE(subtitle,'经验沉淀 · 故障智搜') FROM tenant_config WHERE id=1), (SELECT COALESCE(org_type,'企业') FROM tenant_config WHERE id=1), ?, datetime('now','localtime'))",
        [logoUrl],
      )

      return { ok: true, url: logoUrl }
    }

    return reply.status(400).send({ message: '未检测到图片文件' })
  })

  /**
   * DELETE /api/upload/logo
   * 删除平台 Logo，恢复默认图标（管理员及以上）
   */
  fastify.delete('/api/upload/logo', { preHandler: [authGuard, adminGuard] }, async (request, reply) => {
    // 清理 Logo 文件
    try {
      const files = readdirSync(LOGO_DIR)
      for (const f of files) unlinkSync(join(LOGO_DIR, f))
    } catch { /* 目录为空 */ }

    // 清空租户配置中的 logo_url（保留已有 name/subtitle/org_type）
    execute(
      "INSERT OR REPLACE INTO tenant_config (id, name, subtitle, org_type, logo_url, updated_at) VALUES (1, (SELECT COALESCE(name,'工控技术库') FROM tenant_config WHERE id=1), (SELECT COALESCE(subtitle,'经验沉淀 · 故障智搜') FROM tenant_config WHERE id=1), (SELECT COALESCE(org_type,'企业') FROM tenant_config WHERE id=1), '', datetime('now','localtime'))",
    )

    return { ok: true }
  })
}
