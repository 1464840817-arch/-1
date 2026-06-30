// src/composables/useSSE.js
// SSE 客户端 — fetch + ReadableStream（支持自定义 Headers 携带 Bearer Token）
// 断线 3 秒自动重连

import { onMounted, onUnmounted, watch } from 'vue'
import { userStore } from '../store/user.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * @param {object} [handlers] — { eventType: callback(data) } 映射
 * @returns {{ on: (type, cb) => (() => void) }}
 */
export function useSSE(handlers = {}) {
  const listeners = new Map() // type → Set<callback>

  function on(type, callback) {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type).add(callback)
    return () => listeners.get(type)?.delete(callback)
  }

  function emit(type, data) {
    listeners.get(type)?.forEach(cb => {
      try { cb(data) } catch { /* 避免一个回调出错影响其他 */ }
    })
  }

  // 注册初始 handlers
  for (const [type, cb] of Object.entries(handlers)) {
    on(type, cb)
  }

  let abortController = null
  let reconnectTimer = null
  let active = false

  async function connect() {
    if (abortController) return // 已连接
    if (!userStore.token) return // 未登录

    active = true
    abortController = new AbortController()

    try {
      const response = await fetch(`${BASE_URL}/sse/connect`, {
        headers: { Authorization: `Bearer ${userStore.token}` },
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`SSE 连接失败 (${response.status})`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (active) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // 最后一行可能不完整，保留在 buffer 中
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type) {
                emit(data.type, data)
              }
            } catch { /* 解析失败，跳过 */ }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return // 主动断开
    } finally {
      abortController = null
    }

    // 断线重连（3 秒后，仅当仍活跃时）
    if (active) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        connect()
      }, 3000)
    }
  }

  function disconnect() {
    active = false
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  }

  // 登录后自动连接，退出登录时断开
  let unwatch = null
  onMounted(() => {
    if (userStore.token) connect()
    unwatch = watch(() => userStore.token, (token) => {
      if (token) connect()
      else disconnect()
    })
  })

  onUnmounted(() => {
    disconnect()
    if (unwatch) unwatch()
  })

  return { on }
}
