// server/routes/article.js
// 文章 CRUD + 评论

import { queryAll, queryOne, execute } from '../db.js'
import { authGuard, optionalAuth } from '../middleware/auth.js'

export default async function articleRoutes(fastify) {
  // ==================== 文章 CRUD ====================

  /**
   * GET /articles/search?q=&tag=&sortBy=&page=&pageSize=
   * 全文搜索（公开）
   */
  fastify.get('/articles/search', { preHandler: optionalAuth }, async (request) => {
    const { q, tag, sortBy, page = '1', pageSize = '20' } = request.query
    const limit = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100)
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit

    let sql = "SELECT * FROM articles WHERE status = 'published'"
    const params = []

    if (q && q.trim()) {
      sql += ` AND (title LIKE ? OR "desc" LIKE ? OR type LIKE ?)`
      const kw = `%${q.trim()}%`
      params.push(kw, kw, kw)
    }

    if (tag && tag.trim() && tag.trim() !== '全部') {
      sql += ` AND tags LIKE ?`
      params.push(`%"${tag.trim()}"%`)
    }

    // 排序
    if (sortBy === 'likes') {
      sql += ' ORDER BY likes DESC'
    } else if (sortBy === 'collections') {
      sql += ' ORDER BY (SELECT COUNT(*) FROM user_collections WHERE article_id = articles.id) DESC'
    } else {
      sql += ' ORDER BY date DESC'
    }

    // 总数
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total')
    const { total } = queryOne(countSql, params) || { total: 0 }

    sql += ' LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const rows = queryAll(sql, params)

    // 如果已登录，批量查询当前用户点赞过的文章 ID
    let likedIds = new Set()
    if (request.user) {
      const likedRows = queryAll(
        "SELECT target_id FROM user_likes WHERE user_id = ? AND target_type = 'article'",
        [request.user.userId],
      )
      likedIds = new Set(likedRows.map(r => r.target_id))
    }

    return {
      list: rows.map(r => formatArticle(r, likedIds)),
      total,
      page: parseInt(page, 10) || 1,
      pageSize: limit,
    }
  })

  /**
   * GET /articles/:id
   * 获取单篇文章详情（含作者信息）
   */
  fastify.get('/articles/:id', { preHandler: optionalAuth }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const row = queryOne(
      `SELECT a.*, u.id AS author_id, u.department, u.desc AS author_desc
       FROM articles a
       LEFT JOIN users u ON a.author = u.name
       WHERE a.id = ?`,
      [id],
    )
    if (!row) {
      return reply.status(404).send({ message: '文章不存在' })
    }

    const likedIds = request.user
      ? new Set(
          queryAll(
            "SELECT target_id FROM user_likes WHERE user_id = ? AND target_type = 'article' AND target_id = ?",
            [request.user.userId, id],
          ).map(r => r.target_id),
        )
      : new Set()

    return formatArticle(row, likedIds)
  })

  /**
   * POST /articles/:id/view
   * 浏览计数 +1（无需登录）
   */
  fastify.post('/articles/:id/view', async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const exists = queryOne('SELECT id FROM articles WHERE id = ?', [id])
    if (!exists) {
      return reply.status(404).send({ message: '文章不存在' })
    }
    execute('UPDATE articles SET views = views + 1 WHERE id = ?', [id])
    return { ok: true }
  })

  /**
   * POST /articles/:id/like
   * 点赞/取消点赞文章（需登录，toggle 模式，含通知去重）
   */
  fastify.post('/articles/:id/like', { preHandler: authGuard }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const article = queryOne('SELECT id, author, title FROM articles WHERE id = ?', [id])
    if (!article) {
      return reply.status(404).send({ message: '文章不存在' })
    }

    const userId = request.user.userId

    // 检查是否已点赞 → toggle
    const existing = queryOne(
      "SELECT user_id FROM user_likes WHERE user_id = ? AND target_type = 'article' AND target_id = ?",
      [userId, id],
    )

    if (existing) {
      // 取消点赞
      execute(
        "DELETE FROM user_likes WHERE user_id = ? AND target_type = 'article' AND target_id = ?",
        [userId, id],
      )
      execute('UPDATE articles SET likes = MAX(0, likes - 1) WHERE id = ?', [id])
      const row = queryOne('SELECT likes FROM articles WHERE id = ?', [id])
      return { liked: false, likes: row.likes }
    }

    // 点赞
    execute(
      "INSERT INTO user_likes (user_id, target_type, target_id) VALUES (?, 'article', ?)",
      [userId, id],
    )
    execute('UPDATE articles SET likes = likes + 1 WHERE id = ?', [id])
    const row = queryOne('SELECT likes FROM articles WHERE id = ?', [id])

    // 通知文章作者（非自己，且去重）
    if (article.author !== request.user.name && article.author !== request.user.account) {
      const authorUser = queryOne('SELECT id FROM users WHERE name = ?', [article.author])
      if (authorUser) {
        const dupNotify = queryOne(
          "SELECT id FROM messages WHERE user_id = ? AND type = 'like' AND sender = ? AND target_id = ?",
          [authorUser.id, request.user.name, id],
        )
        if (!dupNotify) {
          execute(
            `INSERT INTO messages (user_id, type, sender, action, content, target_id)
             VALUES (?, 'like', ?, '赞了你的文章', ?, ?)`,
            [authorUser.id, request.user.name, article.title, id],
          )
        }
      }
    }

    return { liked: true, likes: row.likes }
  })

  /**
   * POST /articles/:id/share
   * 分享文章给好友（需登录，向好友发送消息通知）
   */
  fastify.post('/articles/:id/share', { preHandler: authGuard }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const article = queryOne('SELECT id, title FROM articles WHERE id = ?', [id])
    if (!article) {
      return reply.status(404).send({ message: '文章不存在' })
    }

    const { friendId } = request.body || {}
    if (!friendId || !Number.isInteger(friendId) || friendId <= 0) {
      return reply.status(400).send({ message: '请提供好友 ID' })
    }

    // 不能分享给自己
    if (friendId === request.user.userId) {
      return reply.status(400).send({ message: '不能分享给自己' })
    }

    const friend = queryOne('SELECT id FROM users WHERE id = ?', [friendId])
    if (!friend) {
      return reply.status(404).send({ message: '好友不存在' })
    }

    execute(
      `INSERT INTO messages (user_id, type, sender, action, content, target_id)
       VALUES (?, 'share', ?, '分享了一篇文章给你', ?, ?)`,
      [friendId, request.user.name, article.title, id],
    )

    return { ok: true }
  })

  /**
   * POST /articles
   * 创建文章（需登录）
   */
  fastify.post('/articles', { preHandler: authGuard }, async (request, reply) => {
    const { type, title, desc, steps, tags } = request.body || {}
    if (!title || !title.trim()) {
      return reply.status(400).send({ message: '标题不能为空' })
    }

    const safeType = type || ''
    const safeDesc = desc || ''
    const safeAuthor = request.user.name || ''
    const safeTags = JSON.stringify(Array.isArray(tags) ? tags : [])
    const safeSteps = JSON.stringify(Array.isArray(steps) ? steps : [])

    execute(
      `INSERT INTO articles (type, title, "desc", author, date, likes, comments, views, tags, steps)
       VALUES (?, ?, ?, ?, datetime('now','localtime'), 0, 0, 0, ?, ?)`,
      [safeType, title.trim(), safeDesc, safeAuthor, safeTags, safeSteps],
    )

    const row = queryOne('SELECT * FROM articles ORDER BY id DESC LIMIT 1')
    return formatArticle(row)
  })

  /**
   * PUT /articles/:id
   * 更新文章（需登录，作者本人或管理员及以上可编辑）
   */
  fastify.put('/articles/:id', { preHandler: authGuard }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const existing = queryOne('SELECT * FROM articles WHERE id = ?', [id])
    if (!existing) {
      return reply.status(404).send({ message: '文章不存在' })
    }
    // 作者本人 或 管理员及以上可编辑
    const isOwner = existing.author === request.user.name || existing.author === request.user.account
    const isAdminUser = request.user.role === '管理员' || request.user.role === '系统部署人员'
    if (!isOwner && !isAdminUser) {
      return reply.status(403).send({ message: '无权编辑此文章' })
    }

    const { type, title, desc, steps, tags } = request.body || {}
    execute(
      `UPDATE articles SET type = ?, title = ?, "desc" = ?, steps = ?, tags = ?, updated_at = datetime('now','localtime')
       WHERE id = ?`,
      [
        type ?? existing.type,
        title ?? existing.title,
        desc ?? existing.desc,
        JSON.stringify(steps ?? JSON.parse(existing.steps || '[]')),
        JSON.stringify(tags ?? JSON.parse(existing.tags || '[]')),
        id,
      ],
    )

    // 管理员修改他人文章时通知作者
    if (!isOwner) {
      const authorUser = queryOne('SELECT id FROM users WHERE name = ?', [existing.author])
      if (authorUser) {
        execute(
          `INSERT INTO messages (user_id, type, sender, action, content, target_id)
           VALUES (?, 'system', ?, '修改了你的文章', ?, ?)`,
          [authorUser.id, request.user.name, existing.title, id],
        )
      }
      // 操作日志
      execute(
        'INSERT INTO operation_logs (operator, operator_role, action, detail) VALUES (?, ?, ?, ?)',
        [request.user.name, request.user.role, '编辑文章', `编辑了用户「${existing.author}」的文章「${existing.title}」`],
      )
    }

    const row = queryOne('SELECT * FROM articles WHERE id = ?', [id])
    return formatArticle(row)
  })

  /**
   * DELETE /articles/:id
   * 下架文章（软删除，需登录，仅作者本人或管理员）
   * 将 status 设为 'delisted' 而非物理删除
   */
  fastify.delete('/articles/:id', { preHandler: authGuard }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const existing = queryOne('SELECT * FROM articles WHERE id = ?', [id])
    if (!existing) {
      return reply.status(404).send({ message: '文章不存在' })
    }
    // 作者本人 或 管理员及以上可下架
    const isOwner = existing.author === request.user.name || existing.author === request.user.account
    const isAdminUser = request.user.role === '管理员' || request.user.role === '系统部署人员'
    if (!isOwner && !isAdminUser) {
      return reply.status(403).send({ message: '无权操作此文章' })
    }

    execute("UPDATE articles SET status = 'delisted', updated_at = datetime('now','localtime') WHERE id = ?", [id])

    // 管理员下架他人文章时通知作者
    if (!isOwner) {
      const authorUser = queryOne('SELECT id FROM users WHERE name = ?', [existing.author])
      if (authorUser) {
        execute(
          `INSERT INTO messages (user_id, type, sender, action, content, target_id)
           VALUES (?, 'system', ?, '下架了你的文章', ?, ?)`,
          [authorUser.id, request.user.name, existing.title, id],
        )
      }
      // 操作日志
      execute(
        'INSERT INTO operation_logs (operator, operator_role, action, detail) VALUES (?, ?, ?, ?)',
        [request.user.name, request.user.role, '下架文章', `下架了用户「${existing.author}」的文章「${existing.title}」`],
      )
    }

    return { ok: true }
  })

  /**
   * PUT /articles/:id/restore
   * 恢复已下架文章（需登录，仅作者本人或管理员）
   */
  fastify.put('/articles/:id/restore', { preHandler: authGuard }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const existing = queryOne('SELECT * FROM articles WHERE id = ?', [id])
    if (!existing) {
      return reply.status(404).send({ message: '文章不存在' })
    }
    if (existing.status !== 'delisted') {
      return reply.status(400).send({ message: '该文章未处于下架状态' })
    }
    const isOwner = existing.author === request.user.name || existing.author === request.user.account
    const isAdminUser = request.user.role === '管理员' || request.user.role === '系统部署人员'
    if (!isOwner && !isAdminUser) {
      return reply.status(403).send({ message: '无权操作此文章' })
    }

    execute("UPDATE articles SET status = 'published', updated_at = datetime('now','localtime') WHERE id = ?", [id])
    return { ok: true }
  })

  /**
   * GET /user/posts?page=&pageSize=&status=
   * 获取当前用户发布的文章列表（支持分页和状态下架筛选）
   * status 可选值: 'published'（默认）, 'delisted', 'all'
   */
  fastify.get('/user/posts', { preHandler: authGuard }, async (request) => {
    const { page = '1', pageSize = '20', status } = request.query
    const limit = Math.min(Math.max(parseInt(pageSize, 10) || 20, 1), 100)
    const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit

    let statusFilter = ''
    if (status === 'delisted') {
      statusFilter = " AND status = 'delisted'"
    } else if (status === 'all') {
      statusFilter = ''
    } else {
      statusFilter = " AND status = 'published'"
    }

    const { total } = queryOne(
      `SELECT COUNT(*) as total FROM articles WHERE author = ?${statusFilter}`,
      [request.user.name],
    ) || { total: 0 }

    const rows = queryAll(
      `SELECT * FROM articles WHERE author = ?${statusFilter} ORDER BY date DESC LIMIT ? OFFSET ?`,
      [request.user.name, limit, offset],
    )

    const likedRows = queryAll(
      "SELECT target_id FROM user_likes WHERE user_id = ? AND target_type = 'article'",
      [request.user.userId],
    )
    const likedIds = new Set(likedRows.map(r => r.target_id))

    return {
      list: rows.map(r => formatArticle(r, likedIds)),
      total,
      page: parseInt(page, 10) || 1,
      pageSize: limit,
    }
  })

  // ==================== 评论 ====================

  /**
   * GET /articles/:id/comments
   * 获取文章评论（含嵌套回复）
   */
  fastify.get('/articles/:id/comments', { preHandler: optionalAuth }, async (request) => {
    const articleId = parseInt(request.params.id, 10)
    const rows = queryAll(
      'SELECT * FROM comments WHERE article_id = ? ORDER BY created_at ASC',
      [articleId],
    )

    // 如果已登录，批量查询当前用户点赞过的评论 ID
    let likedCommentIds = new Set()
    if (request.user) {
      const likedRows = queryAll(
        "SELECT target_id FROM user_likes WHERE user_id = ? AND target_type = 'comment'",
        [request.user.userId],
      )
      likedCommentIds = new Set(likedRows.map(r => r.target_id))
    }

    // 构建嵌套结构：顶级评论 + replies
    const topLevel = rows.filter(r => !r.reply_to)
    const replies = rows.filter(r => r.reply_to)

    return topLevel.map(c => ({
      id: c.id,
      articleId: c.article_id,
      author: c.author,
      content: c.content,
      time: c.created_at,
      likes: c.likes,
      isLiked: likedCommentIds.has(c.id),
      replies: replies
        .filter(r => r.reply_to === c.id)
        .map(r => ({
          id: r.id,
          articleId: r.article_id,
          author: r.author,
          content: r.content,
          time: r.created_at,
          likes: r.likes,
          isLiked: likedCommentIds.has(r.id),
        })),
    }))
  })

  /**
   * POST /articles/:id/comments
   * 发表评论（需登录）
   */
  fastify.post('/articles/:id/comments', { preHandler: authGuard }, async (request, reply) => {
    const articleId = parseInt(request.params.id, 10)
    const article = queryOne('SELECT id, author, title FROM articles WHERE id = ?', [articleId])
    if (!article) {
      return reply.status(404).send({ message: '文章不存在' })
    }

    const { content, replyTo } = request.body || {}
    if (!content || !content.trim()) {
      return reply.status(400).send({ message: '评论内容不能为空' })
    }

    execute(
      'INSERT INTO comments (article_id, author, content, reply_to) VALUES (?, ?, ?, ?)',
      [articleId, request.user.name, content.trim(), replyTo || null],
    )

    // 更新文章评论数
    execute('UPDATE articles SET comments = comments + 1 WHERE id = ?', [articleId])

    // 评论时通知文章作者（非自己评论自己）
    if (article.author !== request.user.name && article.author !== request.user.account) {
      const authorUser = queryOne('SELECT id FROM users WHERE name = ?', [article.author])
      if (authorUser) {
        execute(
          `INSERT INTO messages (user_id, type, sender, action, content, target_id)
           VALUES (?, 'comment', ?, '评论了你的文章', ?, ?)`,
          [authorUser.id, request.user.name, content.trim().slice(0, 100), articleId],
        )
      }
    }

    // 回复时通知被回复的评论作者（非自己回复自己）
    if (replyTo) {
      const parentComment = queryOne('SELECT author FROM comments WHERE id = ?', [replyTo])
      if (parentComment && parentComment.author !== request.user.name && parentComment.author !== request.user.account) {
        const replyTargetUser = queryOne('SELECT id FROM users WHERE name = ?', [parentComment.author])
        if (replyTargetUser) {
          execute(
            `INSERT INTO messages (user_id, type, sender, action, content, target_id)
             VALUES (?, 'comment', ?, '回复了你的评论', ?, ?)`,
            [replyTargetUser.id, request.user.name, content.trim().slice(0, 100), articleId],
          )
        }
      }
    }

    const row = queryOne('SELECT * FROM comments ORDER BY id DESC LIMIT 1')
    return {
      id: row.id,
      articleId: row.article_id,
      author: row.author,
      content: row.content,
      time: row.created_at,
      likes: row.likes,
      isLiked: false,
      replies: [],
    }
  })

  /**
   * POST /comments/:id/like
   * 点赞/取消点赞评论（需登录，toggle 模式）
   */
  fastify.post('/comments/:id/like', { preHandler: authGuard }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const comment = queryOne('SELECT * FROM comments WHERE id = ?', [id])
    if (!comment) {
      return reply.status(404).send({ message: '评论不存在' })
    }

    const userId = request.user.userId

    // 检查是否已点赞 → toggle
    const existing = queryOne(
      "SELECT user_id FROM user_likes WHERE user_id = ? AND target_type = 'comment' AND target_id = ?",
      [userId, id],
    )

    if (existing) {
      // 取消点赞
      execute(
        "DELETE FROM user_likes WHERE user_id = ? AND target_type = 'comment' AND target_id = ?",
        [userId, id],
      )
      execute('UPDATE comments SET likes = MAX(0, likes - 1) WHERE id = ?', [id])
      const row = queryOne('SELECT likes FROM comments WHERE id = ?', [id])
      return { liked: false, likes: row.likes }
    }

    // 点赞
    execute(
      "INSERT INTO user_likes (user_id, target_type, target_id) VALUES (?, 'comment', ?)",
      [userId, id],
    )
    execute('UPDATE comments SET likes = likes + 1 WHERE id = ?', [id])
    const row = queryOne('SELECT likes FROM comments WHERE id = ?', [id])
    return { liked: true, likes: row.likes }
  })

  /**
   * DELETE /comments/:id
   * 删除评论（需登录，仅评论作者本人 或 管理员及以上可删除）
   */
  fastify.delete('/comments/:id', { preHandler: authGuard }, async (request, reply) => {
    const id = parseInt(request.params.id, 10)
    const comment = queryOne('SELECT * FROM comments WHERE id = ?', [id])
    if (!comment) {
      return reply.status(404).send({ message: '评论不存在' })
    }

    const isOwner = comment.author === request.user.name || comment.author === request.user.account
    const isAdminUser = request.user.role === '管理员' || request.user.role === '系统部署人员'
    if (!isOwner && !isAdminUser) {
      return reply.status(403).send({ message: '无权删除此评论' })
    }

    execute('DELETE FROM comments WHERE id = ?', [id])
    execute('UPDATE articles SET comments = MAX(0, comments - 1) WHERE id = ?', [comment.article_id])
    return { ok: true }
  })
}

/** 格式化文章行 → 前端期望的字段 */
function formatArticle(row, likedIds) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    desc: row.desc,
    author: row.author,
    authorId: row.author_id || null,
    department: row.department || '',
    authorDesc: row.author_desc || '',
    date: row.date,
    likes: row.likes,
    isLiked: likedIds ? likedIds.has(row.id) : false,
    comments: row.comments,
    isCollected: false,
    views: row.views,
    steps: safeParse(row.steps, []),
    tags: safeParse(row.tags, []),
  }
}

function safeParse(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}
