// server/routes/upload.js
// 文章图片上传接口

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, extname, basename, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { authGuard } from '../middleware/auth.js'

const __dirname = import.meta.dirname || dirname(fileURLToPath(import.meta.url))
const IMAGE_DIR = join(__dirname, '..', '..', 'data', 'article-images')

export default async function uploadRoutes(fastify) {
  // 确保图片存储目录存在
  if (!existsSync(IMAGE_DIR)) {
    mkdirSync(IMAGE_DIR, { recursive: true })
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
    const { readdirSync, unlinkSync } = await import('fs')
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
}
