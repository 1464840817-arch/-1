// server/middleware/auth.js
// Fastify JWT 鉴权插件

import jwt from 'jsonwebtoken'
import config from '../config.js'

// 预加载 db.execute — 启动时即触发 import，避免首次鉴权时竞态
let _execute = null
import('../db.js').then(m => { _execute = m.execute }).catch(() => {})

function getExecute() {
  return _execute
}

/**
 * 验证 access token 的 Fastify preHandler
 * 解码后的用户信息会挂载到 request.user
 */
export async function authGuard(request, reply) {
  const header = request.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return reply.status(401).send({ message: '请先登录' })
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, config.JWT_SECRET)
    request.user = payload

    // 更新最后活跃时间（异步，不阻塞请求）
    const exec = getExecute()
    if (exec) {
      try {
        exec(
          "UPDATE users SET last_active = datetime('now','localtime') WHERE id = ?",
          [payload.userId],
        )
      } catch { /* 静默 */ }
    }
  } catch {
    return reply.status(401).send({ message: '登录已过期，请重新登录' })
  }
}

/**
 * 可选鉴权：token 有效则挂载 user，无效也不报错
 */
export async function optionalAuth(request, _reply) {
  const header = request.headers.authorization
  if (!header || !header.startsWith('Bearer ')) return

  const token = header.slice(7)
  try {
    request.user = jwt.verify(token, config.JWT_SECRET)
  } catch {
    // 静默忽略
  }
}
