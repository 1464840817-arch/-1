// server/sse.js
// SSE 事件总线 — 按 userId 订阅/发布

import { EventEmitter } from 'events'

const emitter = new EventEmitter()
emitter.setMaxListeners(0)

/**
 * 订阅某个用户的 SSE 事件
 * @param {number} userId
 * @param {(data: object) => void} callback
 * @returns {() => void} 取消订阅函数
 */
export function subscribe(userId, callback) {
  const channel = `user:${userId}`
  emitter.on(channel, callback)
  return () => emitter.off(channel, callback)
}

/**
 * 向指定用户推送 SSE 事件
 * @param {number} userId
 * @param {object} data
 */
export function publish(userId, data) {
  emitter.emit(`user:${userId}`, data)
}
