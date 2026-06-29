// src/store/messages.js
// 消息未读数 — reactive 单例，供底部导航栏"消息"红点使用
import { reactive } from 'vue'
import { getUnreadCount } from '../api/message.js'

export const messageStore = reactive({
  /** 全部未读消息总数（含私聊 + 系统通知 + 好友请求） */
  unread: 0,
})

/**
 * 从服务端拉取未读消息总数
 * 调用时机：应用启动、登录成功、页面可见性恢复
 */
export async function loadUnreadCount() {
  try {
    const res = await getUnreadCount()
    messageStore.unread = typeof res?.count === 'number' ? res.count : 0
  } catch {
    // API 不可用时保留上次读数
  }
}

/**
 * 本地扣减未读数（标记已读后立即反馈 UI，无需等下一轮拉取）
 * @param {number} delta - 要扣减的数量
 */
export function decrementUnread(delta = 1) {
  messageStore.unread = Math.max(0, messageStore.unread - delta)
}
