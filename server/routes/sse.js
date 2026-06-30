// server/routes/sse.js
// SSE 端点 — GET /sse/connect

import { authGuard } from '../middleware/auth.js'
import { subscribe } from '../sse.js'

export default async function sseRoutes(fastify) {
  fastify.get('/sse/connect', { preHandler: authGuard }, (request, reply) => {
    const userId = request.user.userId

    // 必须先 hijack，再操作 raw response
    reply.hijack()

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // 初始连接确认
    reply.raw.write('event: connected\ndata: {}\n\n')

    // 心跳：每 30 秒一次，防止代理断开空闲连接
    const heartbeat = setInterval(() => {
      reply.raw.write(':heartbeat\n\n')
    }, 30000)

    // 订阅用户事件
    const unsubscribe = subscribe(userId, (data) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
      } catch {
        // 写入失败（客户端可能已断开），忽略
      }
    })

    // 客户端断开时清理
    request.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })
}
