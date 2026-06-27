// server/routes/tenant.js
// 租户配置 + 分类标签管理

import { queryAll, queryOne, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'
import { adminGuard } from '../middleware/admin.js'

export default async function tenantRoutes(fastify) {
  // ==================== 租户配置 ====================

  /**
   * GET /tenant/config
   * 获取当前租户的完整配置
   */
  fastify.get('/tenant/config', async () => {
    const config = queryOne('SELECT * FROM tenant_config WHERE id = 1')
    if (!config) {
      // 首次访问，返回默认配置
      const tags = queryAll('SELECT id, name, active FROM category_tags ORDER BY id')
      return {
        id: 0,
        name: '工控技术库',
        orgType: '企业',
        categoryTags: tags,
        departments: [],
      }
    }

    const tags = queryAll('SELECT id, name, active FROM category_tags ORDER BY id')
    return {
      id: config.id,
      name: config.name,
      orgType: config.org_type,
      logoUrl: config.logo_url,
      categoryTags: tags,
      departments: [],
    }
  })

  /**
   * PUT /tenant/config
   * 更新租户全局配置（超管）
   */
  fastify.put('/tenant/config', { preHandler: [authGuard, adminGuard] }, async (request, reply) => {
    const { name, logoUrl } = request.body || {}

    execute('INSERT OR REPLACE INTO tenant_config (id, name, logo_url) VALUES (1, ?, ?)', [
      name || '工控技术库',
      logoUrl || '',
    ])

    return { ok: true }
  })

  // ==================== 分类标签 CRUD ====================

  /**
   * POST /tenant/category-tags
   * Body: { name }
   * 新增分类标签（管理员）
   */
  fastify.post('/tenant/category-tags', { preHandler: [authGuard, adminGuard] }, async (request, reply) => {
    const { name } = request.body || {}
    if (!name || !name.trim()) {
      return reply.status(400).send({ message: '标签名称不能为空' })
    }

    // 去重
    const existing = queryOne('SELECT id FROM category_tags WHERE name = ?', [name.trim()])
    if (existing) {
      // 已存在则激活
      execute('UPDATE category_tags SET active = 1 WHERE id = ?', [existing.id])
      return { id: existing.id, name: name.trim() }
    }

    execute('INSERT INTO category_tags (name) VALUES (?)', [name.trim()])
    const row = queryOne('SELECT id FROM category_tags WHERE name = ? ORDER BY id DESC LIMIT 1', [name.trim()])
    return { id: row.id, name: name.trim() }
  })

  /**
   * DELETE /tenant/category-tags/:id
   * 删除分类标签（管理员）
   */
  fastify.delete('/tenant/category-tags/:id', { preHandler: [authGuard, adminGuard] }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)

    // 软删除：设置 active = 0
    const row = queryOne('SELECT id FROM category_tags WHERE id = ?', [id])
    if (!row) {
      return reply.status(404).send({ message: '标签不存在' })
    }

    execute('UPDATE category_tags SET active = 0 WHERE id = ?', [id])
    return { ok: true }
  })

  /**
   * PUT /tenant/category-tags/:id
   * Body: { name?, active? }
   * 更新分类标签（管理员）
   */
  fastify.put('/tenant/category-tags/:id', { preHandler: [authGuard, adminGuard] }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const { name, active } = request.body || {}

    const row = queryOne('SELECT id FROM category_tags WHERE id = ?', [id])
    if (!row) {
      return reply.status(404).send({ message: '标签不存在' })
    }

    if (name !== undefined) {
      execute('UPDATE category_tags SET name = ? WHERE id = ?', [name.trim(), id])
    }
    if (active !== undefined) {
      execute('UPDATE category_tags SET active = ? WHERE id = ?', [active ? 1 : 0, id])
    }

    return { ok: true }
  })
}
