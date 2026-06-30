// server/routes/tenant.js
// 租户配置 + 分类标签管理

import { queryAll, queryOne, execute } from '../db.js'
import { authGuard } from '../middleware/auth.js'
import { adminGuard } from '../middleware/admin.js'

// ==================== 工具函数 ====================

/** 检测字符串是否包含 emoji 表情符号 */
function hasEmoji(str) {
  // 使用 Unicode 属性转义匹配 Emoji
  return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{FE0F}\u{238C}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/u.test(str)
}

/** 个人页面模块默认可见性（全部可见） */
const DEFAULT_PROFILE_VISIBILITY = {
  myPosts: true,
  totalLikes: true,
  totalViews: true,
  collections: true,
  history: true,
  delisted: true,
}

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
        subtitle: '经验沉淀 · 故障智搜',
        orgType: '企业',
        categoryTags: tags,
        departments: [],
      }
    }

    const tags = queryAll('SELECT id, name, active FROM category_tags ORDER BY id')
    return {
      id: config.id,
      name: config.name,
      subtitle: config.subtitle || '经验沉淀 · 故障智搜',
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
    const { name, subtitle, logoUrl } = request.body || {}

    execute('INSERT OR REPLACE INTO tenant_config (id, name, subtitle, logo_url) VALUES (1, ?, ?, ?)', [
      name || '工控技术库',
      subtitle || '经验沉淀 · 故障智搜',
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
    if (hasEmoji(name)) {
      return reply.status(400).send({ message: '标签名称不允许包含表情符号' })
    }

    // 去重
    const existing = queryOne('SELECT id FROM category_tags WHERE name = ?', [name.trim()])
    if (existing) {
      // 已存在则激活
      execute('UPDATE category_tags SET active = 1 WHERE id = ?', [existing.id])
      // 操作日志
      execute(
        'INSERT INTO operation_logs (operator, operator_role, action, detail) VALUES (?, ?, ?, ?)',
        [request.user.name, request.user.role, '创建标签', `重新激活了标签「${name.trim()}」`],
      )
      return { id: existing.id, name: name.trim() }
    }

    execute('INSERT INTO category_tags (name) VALUES (?)', [name.trim()])
    // 操作日志
    execute(
      'INSERT INTO operation_logs (operator, operator_role, action, detail) VALUES (?, ?, ?, ?)',
      [request.user.name, request.user.role, '创建标签', `创建了标签「${name.trim()}」`],
    )
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
    const row = queryOne('SELECT id, name FROM category_tags WHERE id = ?', [id])
    if (!row) {
      return reply.status(404).send({ message: '标签不存在' })
    }

    execute('UPDATE category_tags SET active = 0 WHERE id = ?', [id])
    // 操作日志
    execute(
      'INSERT INTO operation_logs (operator, operator_role, action, detail) VALUES (?, ?, ?, ?)',
      [request.user.name, request.user.role, '删除标签', `删除了标签「${row.name}」`],
    )
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

    const row = queryOne('SELECT id, name FROM category_tags WHERE id = ?', [id])
    if (!row) {
      return reply.status(404).send({ message: '标签不存在' })
    }

    if (name !== undefined) {
      if (hasEmoji(name)) {
        return reply.status(400).send({ message: '标签名称不允许包含表情符号' })
      }
      execute('UPDATE category_tags SET name = ? WHERE id = ?', [name.trim(), id])
    }
    if (active !== undefined) {
      execute('UPDATE category_tags SET active = ? WHERE id = ?', [active ? 1 : 0, id])
    }

    // 操作日志
    const changes = []
    if (name !== undefined) changes.push(`名称→「${name.trim()}」`)
    if (active !== undefined) changes.push(active ? '启用' : '禁用')
    execute(
      'INSERT INTO operation_logs (operator, operator_role, action, detail) VALUES (?, ?, ?, ?)',
      [request.user.name, request.user.role, '修改标签', `修改了标签「${row.name}」${changes.length ? '（' + changes.join('、') + '）' : ''}`],
    )

    return { ok: true }
  })

  // ==================== 个人页面可见性配置 ====================

  /**
   * GET /tenant/profile-visibility
   * 获取一线工程师个人页面模块可见性（所有用户可读）
   */
  fastify.get('/tenant/profile-visibility', async () => {
    const config = queryOne('SELECT config_json FROM tenant_config WHERE id = 1')
    let visibility = null
    if (config && config.config_json) {
      try { visibility = JSON.parse(config.config_json).profileVisibility } catch { /* ignore */ }
    }
    return visibility || DEFAULT_PROFILE_VISIBILITY
  })

  /**
   * PUT /tenant/profile-visibility
   * Body: { myPosts?, totalLikes?, totalViews?, collections?, history?, delisted? }
   * 管理员设置一线工程师个人页面的模块可见性
   */
  fastify.put('/tenant/profile-visibility', { preHandler: [authGuard, adminGuard] }, async (request, reply) => {
    const body = request.body || {}
    const allowedKeys = ['myPosts', 'totalLikes', 'totalViews', 'collections', 'history', 'delisted']

    const config = queryOne('SELECT config_json FROM tenant_config WHERE id = 1')
    let fullConfig = {}
    if (config && config.config_json) {
      try { fullConfig = JSON.parse(config.config_json) } catch { /* ignore */ }
    }

    const existing = fullConfig.profileVisibility || { ...DEFAULT_PROFILE_VISIBILITY }
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        existing[key] = Boolean(body[key])
      }
    }
    fullConfig.profileVisibility = existing

    execute(
      "INSERT OR REPLACE INTO tenant_config (id, name, subtitle, org_type, logo_url, config_json, updated_at) VALUES (1, (SELECT COALESCE(name,'工控技术库') FROM tenant_config WHERE id=1), (SELECT COALESCE(subtitle,'经验沉淀 · 故障智搜') FROM tenant_config WHERE id=1), (SELECT COALESCE(org_type,'企业') FROM tenant_config WHERE id=1), (SELECT COALESCE(logo_url,'') FROM tenant_config WHERE id=1), ?, datetime('now','localtime'))",
      [JSON.stringify(fullConfig)],
    )

    return { ok: true, profileVisibility: existing }
  })
}
