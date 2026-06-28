<!-- src/views/ChatView.vue -->
<!-- 私聊页面 — 与好友一对一聊天 -->
<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getUserProfile } from '../api/user.js'
import { getChatHistory, sendChatMessage } from '../api/chat.js'
import { userStore } from '../store/user.js'

const router = useRouter()
const route = useRoute()
const friendId = computed(() => Number(route.params.friendId))

// ==================== 好友信息 ====================
const friend = ref(null)
const friendLoading = ref(true)
const friendError = ref('')

const loadFriend = async () => {
  friendLoading.value = true
  friendError.value = ''
  try {
    friend.value = await getUserProfile(friendId.value)
  } catch (err) {
    friend.value = null
    friendError.value = err.status === 404 ? '用户不存在' : (err.message || '加载失败')
  } finally {
    friendLoading.value = false
  }
}

// ==================== 聊天消息 ====================
const messages = ref([])
const messagesLoading = ref(false)
const hasMore = ref(false)
const oldestId = ref(null)

const loadMessages = async () => {
  if (messagesLoading.value) return
  messagesLoading.value = true
  try {
    const data = await getChatHistory(friendId.value, oldestId.value)
    const fetched = data.list || []
    hasMore.value = data.hasMore

    // 插入到现有消息之前（加载更早的消息）
    if (fetched.length > 0) {
      // 合并去重
      const existingIds = new Set(messages.value.map(m => m._key))
      const fresh = fetched
        .map(m => ({ ...m, _key: m.id }))
        .filter(m => !existingIds.has(m._key))
      messages.value = [...fresh, ...messages.value]
      oldestId.value = fetched[0]?.id || oldestId.value
    }
  } catch {
    // 静默处理
  } finally {
    messagesLoading.value = false
  }
}

// ==================== 发送消息 ====================
const inputText = ref('')
const sending = ref(false)
const messagesContainer = ref(null)

const handleSend = async () => {
  const text = inputText.value.trim()
  if (!text || sending.value) return

  inputText.value = ''
  sending.value = true

  // 乐观更新
  const tempId = -Date.now()
  messages.value.push({
    _key: tempId,
    id: tempId,
    fromMe: true,
    content: text,
    time: formatCurrentTime(),
  })
  await scrollToBottom()

  try {
    const res = await sendChatMessage(friendId.value, text)
    // 用服务端返回的真实 ID 替换临时 ID
    const idx = messages.value.findIndex(m => m._key === tempId)
    if (idx >= 0) {
      messages.value[idx].id = res.id
      messages.value[idx]._key = res.id
      messages.value[idx].time = res.time
    }
  } catch {
    // 发送失败：标记消息
    const idx = messages.value.findIndex(m => m._key === tempId)
    if (idx >= 0) {
      messages.value[idx].failed = true
    }
    showToast('发送失败，请重试')
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

// ==================== 重试发送 ====================
const handleRetry = (idx) => {
  const msg = messages.value[idx]
  if (!msg || !msg.failed) return
  // 移除失败标记，重新发送
  messages.value.splice(idx, 1)
  inputText.value = msg.content
  handleSend()
}

// ==================== 滚动 ====================
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 上拉加载更多
const handleScroll = () => {
  const el = messagesContainer.value
  if (!el || messagesLoading.value || !hasMore.value) return
  if (el.scrollTop < 50) {
    const prevHeight = el.scrollHeight
    loadMessages().then(() => {
      nextTick(() => {
        el.scrollTop = el.scrollHeight - prevHeight
      })
    })
  }
}

// ==================== 导航 ====================
const goBack = () => { router.back() }

const goToUserDetail = () => {
  if (!friend.value) return
  router.push(`/user/${friendId.value}?from=chat`)
}

// ==================== Toast ====================
const toastText = ref('')
let toastTimer = null
const showToast = (text) => {
  toastText.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastText.value = '' }, 2000)
}

// ==================== 格式化 ====================
const formatCurrentTime = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 判断是否需要在两条消息之间插入时间分隔 */
const showTimeSeparator = (msg, index) => {
  if (index === 0) return true
  const prev = messages.value[index - 1]
  if (!prev || !prev.date || !msg.date) return false
  const diff = Math.abs(new Date(msg.date) - new Date(prev.date))
  return diff > 5 * 60 * 1000 // 间隔 > 5 分钟
}

const formatSeparatorTime = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')

    if (isToday) return `今天 ${hh}:${mm}`
    if (isYesterday) return `昨天 ${hh}:${mm}`
    return `${d.getMonth() + 1}月${d.getDate()}日 ${hh}:${mm}`
  } catch {
    return ''
  }
}

// ==================== 时间格式化（消息气泡用） ====================
const formatMsgTime = (dateStr) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

// ==================== 生命周期 ====================
onMounted(async () => {
  await loadFriend()
  if (friend.value) {
    await loadMessages()
    await scrollToBottom()
  }
})

onUnmounted(() => {
  clearTimeout(toastTimer)
})
</script>

<template>
  <main class="chat-page" aria-label="私聊">

    <!-- ==================== 顶部导航 ==================== -->
    <header class="page-header">
      <span
        class="back-btn"
        role="button"
        tabindex="0"
        aria-label="返回"
        @click="goBack"
        @keydown.enter.prevent="goBack"
        @keydown.space.prevent="goBack"
      >&larr; 返回</span>

      <div
        v-if="friend"
        class="header-friend"
        role="button"
        tabindex="0"
        aria-label="查看用户详情"
        @click="goToUserDetail"
        @keydown.enter.prevent="goToUserDetail"
        @keydown.space.prevent="goToUserDetail"
      >
        <div class="header-avatar">{{ friend.name[0] }}</div>
        <div class="header-info">
          <span class="header-name">{{ friend.name }}</span>
          <span class="header-meta">{{ friend.department || '未分配部门' }}</span>
        </div>
      </div>

      <div v-else-if="friendLoading" class="header-loading">
        <span class="header-spinner"></span>
      </div>

      <span class="header-spacer"></span>
    </header>

    <!-- ==================== 错误 / 加载态 ==================== -->
    <div v-if="friendLoading" class="loading-state">
      <span class="loading-spinner"></span>
      <p class="loading-text">加载中...</p>
    </div>

    <div v-else-if="friendError" class="error-state">
      <span class="error-icon">😕</span>
      <p class="error-text">{{ friendError }}</p>
      <button class="retry-btn" @click="goBack">返回</button>
    </div>

    <!-- ==================== 消息区域 ==================== -->
    <div
      v-else
      ref="messagesContainer"
      class="messages-area"
      @scroll="handleScroll"
    >
      <!-- 加载更多指示器 -->
      <div v-if="messagesLoading" class="load-more">
        <span class="loading-spinner small"></span>
      </div>
      <div v-else-if="hasMore" class="load-more">
        <span class="load-more-text">上拉加载更多</span>
      </div>

      <!-- 空消息 -->
      <div v-if="messages.length === 0 && !messagesLoading" class="empty-chat">
        <span class="empty-icon">💬</span>
        <p class="empty-text">暂无消息</p>
        <p class="empty-hint">发送第一条消息开始对话</p>
      </div>

      <!-- 消息列表 -->
      <div
        v-for="(msg, idx) in messages"
        :key="msg._key"
        class="message-group"
      >
        <!-- 时间分隔 -->
        <div
          v-if="showTimeSeparator(msg, idx)"
          class="time-separator"
        >{{ formatSeparatorTime(msg.date) }}</div>

        <!-- 对方消息 -->
        <div v-if="!msg.fromMe" class="msg-row msg-other">
          <div class="msg-bubble other">
            <span class="msg-text">{{ msg.content }}</span>
            <span v-if="msg.failed" class="msg-failed-hint">发送失败</span>
          </div>
        </div>

        <!-- 我的消息 -->
        <div v-else class="msg-row msg-mine">
          <div class="msg-bubble mine" :class="{ failed: msg.failed }">
            <span class="msg-text">{{ msg.content }}</span>
          </div>
          <span v-if="msg.failed" class="msg-retry" role="button" @click="handleRetry(idx)">重试</span>
        </div>
      </div>
    </div>

    <!-- ==================== 输入栏 ==================== -->
    <div v-if="friend && !friendError" class="input-bar">
      <textarea
        v-model="inputText"
        class="input-field"
        placeholder="输入消息..."
        rows="1"
        maxlength="2000"
        aria-label="消息输入"
        @keydown.enter.exact.prevent="handleSend"
      ></textarea>
      <button
        class="send-btn"
        :disabled="!inputText.trim() || sending"
        @click="handleSend"
        aria-label="发送消息"
      >
        {{ sending ? '…' : '发送' }}
      </button>
    </div>

    <!-- ==================== Toast ==================== -->
    <div v-if="toastText" class="toast-bar" role="alert">{{ toastText }}</div>

  </main>
</template>

<style scoped>
/* ==================== 页面容器 ==================== */
.chat-page {
  min-height: 100vh;
  height: 100vh;
  background: var(--color-bg-page);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ==================== 顶部导航 ==================== */
.page-header {
  background: var(--color-bg-card);
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-divider);
  flex-shrink: 0;
}
.back-btn {
  font-size: 15px;
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
}

/* 头部好友信息 */
.header-friend {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 8px;
  transition: background 0.15s;
  flex-shrink: 0;
}
.header-friend:active {
  background: var(--color-bg-page);
}
.header-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), #6366f1);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.header-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.header-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.2;
}
.header-meta {
  font-size: 11px;
  color: var(--color-text-tertiary);
  line-height: 1.2;
}

.header-loading {
  display: flex;
  align-items: center;
}
.header-spinner {
  width: 16px; height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.header-spacer {
  width: 48px;
  flex-shrink: 0;
}

/* ==================== 加载/错误态 ==================== */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 20px;
  flex: 1;
}
.loading-spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-bottom: 12px;
}
.loading-spinner.small {
  width: 18px; height: 18px;
  border-width: 2px;
  margin-bottom: 0;
}
.loading-text {
  font-size: 14px;
  color: var(--color-text-tertiary);
  margin: 0;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 20px;
  flex: 1;
}
.error-icon { font-size: 48px; margin-bottom: 12px; }
.error-text { font-size: 15px; color: var(--color-text-secondary); margin: 0 0 16px 0; }
.retry-btn {
  border: 1px solid var(--color-primary);
  background: transparent;
  color: var(--color-primary);
  padding: 8px 24px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
}

/* ==================== 消息区域 ==================== */
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}
.load-more-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* 空消息 */
.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 120px;
}
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-text { font-size: 16px; font-weight: 600; color: var(--color-text-body); margin: 0 0 6px 0; }
.empty-hint { font-size: 13px; color: var(--color-text-tertiary); margin: 0; }

/* 消息行 */
.message-group {
  display: flex;
  flex-direction: column;
}
.msg-row {
  display: flex;
  margin-bottom: 2px;
}
.msg-other {
  justify-content: flex-start;
}
.msg-mine {
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
}

/* 时间分隔 */
.time-separator {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-tertiary);
  padding: 14px 0 10px;
}

/* 气泡 */
.msg-bubble {
  max-width: 72%;
  padding: 10px 15px;
  border-radius: 14px;
  word-break: break-word;
  position: relative;
}
.msg-bubble.other {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border-radius: 4px 14px 14px 14px;
  border: 1px solid var(--color-divider);
}
.msg-bubble.mine {
  background: var(--color-primary);
  color: #fff;
  border-radius: 14px 4px 14px 14px;
}
.msg-bubble.mine.failed {
  opacity: 0.5;
}

.msg-text {
  font-size: 15px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.msg-failed-hint {
  font-size: 11px;
  color: var(--color-error);
  display: block;
  margin-top: 4px;
}

.msg-retry {
  font-size: 12px;
  color: var(--color-error);
  cursor: pointer;
  white-space: nowrap;
}

/* ==================== 输入栏 ==================== */
.input-bar {
  background: var(--color-bg-card);
  padding: 10px 14px max(10px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--color-divider);
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-shrink: 0;
}

.input-field {
  flex: 1;
  background: var(--color-bg-page);
  border: none;
  border-radius: 20px;
  padding: 10px 16px;
  font-size: 15px;
  font-family: inherit;
  color: var(--color-text-primary);
  outline: none;
  resize: none;
  min-height: 20px;
  max-height: 100px;
  line-height: 1.4;
  transition: box-shadow 0.2s;
}
.input-field:focus {
  box-shadow: 0 0 0 2px var(--color-primary-light);
}
.input-field::placeholder {
  color: var(--color-text-tertiary);
}

.send-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 20px;
  padding: 9px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
  flex-shrink: 0;
  height: 40px;
}
.send-btn:active:not(:disabled) {
  opacity: 0.8;
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ==================== Toast ==================== */
.toast-bar {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.78);
  color: #fff;
  font-size: 14px;
  padding: 10px 24px;
  border-radius: 24px;
  z-index: 500;
  pointer-events: none;
  white-space: nowrap;
  animation: toast-in 0.25s ease;
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
