// src/api/chat.js
// 私聊相关 API
import { request } from './client.js'

/**
 * 获取与指定好友的聊天记录
 * @param {number} friendId
 * @param {number} [before] - 分页游标（消息 ID）
 * @param {number} [limit=30]
 * @returns {Promise<{list:Array<{id:number,fromMe:boolean,content:string,time:string}>,hasMore:boolean}>}
 */
export function getChatHistory(friendId, before, limit = 30) {
  const params = new URLSearchParams({ limit: String(limit) })
  if (before) params.set('before', String(before))
  return request(`/chat/${friendId}?${params.toString()}`)
}

/**
 * 发送私聊消息
 * @param {number} friendId
 * @param {string} content
 * @returns {Promise<{ok:boolean, id:number, time:string}>}
 */
export function sendChatMessage(friendId, content) {
  return request(`/chat/${friendId}`, {
    method: 'POST',
    body: { content },
  })
}
