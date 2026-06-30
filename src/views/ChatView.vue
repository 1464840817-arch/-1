<!-- src/views/ChatView.vue -->
<!-- 私聊页面 — 与好友一对一聊天 -->
<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { PhArrowLeft, PhPaperPlaneTilt, PhChatCircle, PhSmileySad, PhPlus, PhImage, PhCamera, PhX } from '@phosphor-icons/vue'
import { getUserProfile } from '../api/user.js'
import { getChatHistory, sendChatMessage } from '../api/chat.js'
import { userStore } from '../store/user.js'
import { request } from '../api/client.js'

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

// ==================== 附件面板 ====================
const showAttachSheet = ref(false)
const uploading = ref(false)
const imageInputRef = ref(null)
const cameraInputRef = ref(null)

const toggleAttachSheet = () => {
  showAttachSheet.value = !showAttachSheet.value
}

const closeAttachSheet = () => {
  showAttachSheet.value = false
}

const pickImage = () => {
  closeAttachSheet()
  imageInputRef.value?.click()
}

const takePhoto = () => {
  closeAttachSheet()
  cameraInputRef.value?.click()
}

const handleImageUpload = async (event) => {
  const file = event.target?.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const result = await request('/api/upload', { method: 'POST', body: formData })
    const imageUrl = result?.images?.[0]?.url
    if (imageUrl) {
      // 将图片作为消息发送
      const tempId = -Date.now()
      messages.value.push({
        _key: tempId,
        id: tempId,
        fromMe: true,
        content: imageUrl,
        imageUrl,
        time: formatCurrentTime(),
      })
      await scrollToBottom()

      try {
        const res = await sendChatMessage(friendId.value, `[image:${imageUrl}]`)
        const idx = messages.value.findIndex(m => m._key === tempId)
        if (idx >= 0) {
          messages.value[idx].id = res.id
          messages.value[idx]._key = res.id
          messages.value[idx].time = res.time
        }
      } catch {
        const idx = messages.value.findIndex(m => m._key === tempId)
        if (idx >= 0) {
          messages.value[idx].failed = true
        }
        showToast('图片发送失败，请重试')
      }
    }
  } catch (err) {
    showToast('图片上传失败: ' + (err.message || '未知错误'))
  } finally {
    uploading.value = false
    // 重置 file input，允许重复选择同一文件
    event.target.value = ''
  }
}

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

/** 解析消息内容：图片 / 文章名片 / 纯文本 */
const parseMsgContent = (msg) => {
  // 文章名片（服务端已解析 cardData）
  if (msg.cardData && msg.cardData.cardType === 'article') {
    const { type: articleType, ...rest } = msg.cardData
    return { type: 'article_card', articleType, ...rest }
  }
  // 降级：尝试从 content 解析 JSON
  try {
    const parsed = JSON.parse(msg.content || '')
    if (parsed.cardType === 'article') {
      const { type: articleType, ...rest } = parsed
      return { type: 'article_card', articleType, ...rest }
    }
  } catch {}
  // 图片标记
  const content = msg.content || ''
  const imgMatch = content.match(/^\[image:(.+)\]$/)
  if (imgMatch) {
    return { type: 'image', url: imgMatch[1] }
  }
  // 从 imageUrl 字段来的图片
  if (msg.imageUrl) {
    return { type: 'image', url: msg.imageUrl }
  }
  return { type: 'text', text: content }
}

/** 点击文章名片 → 跳转文章详情 */
const goToArticle = (articleId) => {
  if (articleId) {
    router.push(`/article/${articleId}`)
  }
}
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

// ==================== SSE 实时接收消息 ====================
let unlistenSSE = null
const sseOn = inject('sseOn', null)

if (sseOn) {
  unlistenSSE = sseOn('new_message', (data) => {
    // 只处理来自当前聊天对象的消息
    if (data.senderId !== friendId.value) return
    // 去重：避免与已存在的消息重复
    const dup = messages.value.some(m => m.id === data.msgId)
    if (dup) return
    messages.value.push({
      _key: data.msgId ? `msg-${data.msgId}` : `sse-${Date.now()}`,
      id: data.msgId || null,
      fromMe: false,
      content: data.content,
      time: data.time,
      date: data.date,
    })
    scrollToBottom()
  })
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
  if (unlistenSSE) unlistenSSE()
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
      ><PhArrowLeft :size="18" class="back-icon" /> 返回</span>

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
        <img v-if="friend.avatar" :src="friend.avatar" class="header-avatar-img" alt="" />
        <div v-else class="header-avatar">{{ friend.name[0] }}</div>
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
      <PhSmileySad :size="48" class="error-icon" />
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
        <PhChatCircle :size="48" class="empty-icon" />
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
          <div class="msg-bubble other" :class="{ 'card-bubble': parseMsgContent(msg).type === 'article_card' }">
            <!-- 文章名片 -->
            <div v-if="parseMsgContent(msg).type === 'article_card'" class="msg-card article-card" role="button" tabindex="0" @click="goToArticle(parseMsgContent(msg).articleId)" @keydown.enter.prevent="goToArticle(parseMsgContent(msg).articleId)" @keydown.space.prevent="goToArticle(parseMsgContent(msg).articleId)">
              <div class="card-header">
                <span class="card-type-tag">{{ parseMsgContent(msg).articleType || '文章' }}</span>
                <span class="card-hint">点击查看详情 ›</span>
              </div>
              <span class="card-title">{{ parseMsgContent(msg).title }}</span>
              <span class="card-meta">{{ parseMsgContent(msg).author }} · {{ parseMsgContent(msg).desc }}</span>
            </div>
            <!-- 图片消息 -->
            <img v-else-if="parseMsgContent(msg).type === 'image'" :src="parseMsgContent(msg).url" class="msg-image" alt="图片消息" loading="lazy" />
            <!-- 文本消息 -->
            <span v-else class="msg-text">{{ parseMsgContent(msg).text }}</span>
            <span v-if="msg.failed" class="msg-failed-hint">发送失败</span>
          </div>
        </div>

        <!-- 我的消息 -->
        <div v-else class="msg-row msg-mine">
          <div class="msg-bubble mine" :class="{ failed: msg.failed, 'card-bubble': parseMsgContent(msg).type === 'article_card' }">
            <!-- 文章名片 -->
            <div v-if="parseMsgContent(msg).type === 'article_card'" class="msg-card article-card" role="button" tabindex="0" @click="goToArticle(parseMsgContent(msg).articleId)" @keydown.enter.prevent="goToArticle(parseMsgContent(msg).articleId)" @keydown.space.prevent="goToArticle(parseMsgContent(msg).articleId)">
              <div class="card-header">
                <span class="card-type-tag">{{ parseMsgContent(msg).articleType || '文章' }}</span>
                <span class="card-hint">点击查看详情 ›</span>
              </div>
              <span class="card-title">{{ parseMsgContent(msg).title }}</span>
              <span class="card-meta">{{ parseMsgContent(msg).author }} · {{ parseMsgContent(msg).desc }}</span>
            </div>
            <!-- 图片消息 -->
            <img v-else-if="parseMsgContent(msg).type === 'image'" :src="parseMsgContent(msg).url" class="msg-image" alt="图片消息" loading="lazy" />
            <!-- 文本消息 -->
            <span v-else class="msg-text">{{ parseMsgContent(msg).text }}</span>
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
        class="attach-btn"
        :class="{ active: showAttachSheet }"
        @click="toggleAttachSheet"
        aria-label="添加附件"
      >
        <PhPlus :size="20" />
      </button>

      <button
        class="send-btn"
        :disabled="!inputText.trim() || sending"
        @click="handleSend"
        aria-label="发送消息"
      >
        <PhPaperPlaneTilt v-if="!sending" :size="18" />
        <span v-else class="btn-spinner"></span>
      </button>
    </div>

    <!-- ==================== 附件选择面板 ==================== -->
    <teleport to="body">
      <transition name="sheet">
        <div v-if="showAttachSheet" class="attach-overlay" role="dialog" aria-modal="true" aria-label="选择附件类型" @click.self="closeAttachSheet">
          <div class="attach-sheet">
            <button class="attach-sheet-item" @click="pickImage">
              <span class="attach-sheet-icon"><PhImage :size="28" /></span>
              <span class="attach-sheet-label">图片</span>
              <span class="attach-sheet-desc">从相册中选择</span>
            </button>
            <button class="attach-sheet-item" @click="takePhoto">
              <span class="attach-sheet-icon"><PhCamera :size="28" /></span>
              <span class="attach-sheet-label">拍摄</span>
              <span class="attach-sheet-desc">使用相机拍照</span>
            </button>
            <button class="attach-cancel-btn" @click="closeAttachSheet">取消</button>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- 隐藏的文件选择器 -->
    <input
      ref="imageInputRef"
      type="file"
      accept="image/*"
      class="hidden-file-input"
      @change="handleImageUpload"
    />
    <input
      ref="cameraInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden-file-input"
      @change="handleImageUpload"
    />

    <!-- ==================== Toast ==================== -->
    <div v-if="toastText" class="toast-bar" role="alert">{{ toastText }}</div>

  </main>
</template>

<style scoped>
/* ==================== 页面容器 ==================== */
.chat-page {
  min-height: var(--app-height, 100dvh);
  height: var(--app-height, 100dvh);
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
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.back-icon { display: block; flex-shrink: 0; }

/* 头部好友信息 */
.header-friend {
  display: flex;
  align-items: center;
  gap: 12px;
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
  background: var(--color-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.header-avatar-img {
  width: 36px; height: 36px;
  border-radius: 50%;
  object-fit: cover;
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
.error-icon { color: var(--color-text-tertiary); margin-bottom: 12px; }
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
.empty-icon { color: var(--color-text-tertiary); margin-bottom: 12px; }
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
  gap: 4px;
}

/* 时间分隔 */
.time-separator {
  text-align: center;
  font-size: 12px;
  color: var(--color-text-tertiary);
  padding: 16px 0 10px;
}

/* 气泡 */
.msg-bubble {
  max-width: 72%;
  padding: 10px 15px;
  border-radius: var(--radius-card);
  word-break: break-word;
  position: relative;
}
.msg-bubble.other {
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-divider);
}
.msg-bubble.mine {
  background: var(--color-primary);
  color: #fff;
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
  gap: 12px;
  flex-shrink: 0;
}

.input-field {
  flex: 1;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  padding: 10px 16px;
  font-size: 15px;
  font-family: inherit;
  color: var(--color-text-primary);
  outline: none;
  resize: none;
  min-height: 20px;
  max-height: 100px;
  line-height: 1.4;
  transition: border-color 0.2s;
}
.input-field:focus {
  border-color: var(--color-primary);
}
.input-field::placeholder {
  color: var(--color-text-tertiary);
}

.send-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-btn);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 0;
  height: 44px;
  width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}
.send-btn:active:not(:disabled) {
  opacity: 0.9;
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-spinner {
  width: 16px; height: 16px;
  border: 2px solid rgba(255,255,255,0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  display: inline-block;
}

/* "+" 附件按钮 */
.attach-btn {
  background: transparent;
  color: var(--color-text-tertiary);
  border: none;
  border-radius: var(--radius-btn);
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
  flex-shrink: 0;
  height: 44px;
  width: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: color 0.15s, background 0.15s;
}
.attach-btn:active,
.attach-btn.active {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

/* 消息中的图片 */
.msg-image {
  display: block;
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  object-fit: cover;
  cursor: pointer;
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
  border-radius: var(--radius-btn);
  z-index: 500;
  pointer-events: none;
  white-space: nowrap;
  animation: toast-in 0.25s ease;
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* ==================== 附件选择面板 ==================== */
.attach-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(15,23,42,0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.attach-sheet {
  width: 100%;
  max-width: 500px;
  background: var(--color-bg-card);
  border-radius: 16px 16px 0 0;
  padding: 20px 16px 28px;
  animation: sheet-up 0.25s ease;
}
@keyframes sheet-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.attach-sheet-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  border-radius: var(--radius-card);
  transition: background 0.15s;
}
.attach-sheet-item:hover,
.attach-sheet-item:active {
  background: var(--color-bg-page);
}
.attach-sheet-item + .attach-sheet-item {
  border-top: 1px solid var(--color-divider);
}
.attach-sheet-icon {
  display: flex;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  width: 44px;
  justify-content: center;
}
.attach-sheet-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  flex-shrink: 0;
}
.attach-sheet-desc {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-left: auto;
}
.attach-cancel-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 14px;
  border: none;
  border-radius: var(--radius-card);
  background: var(--color-divider);
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}
.attach-cancel-btn:hover {
  background: var(--color-border);
}

.hidden-file-input {
  display: none;
}

/* 面板动画 */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-enter-active .attach-sheet,
.sheet-leave-active .attach-sheet {
  transition: transform 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .attach-sheet {
  transform: translateY(100%);
}
.sheet-leave-to .attach-sheet {
  transform: translateY(100%);
}

/* ==================== 文章名片消息 ==================== */
.card-bubble {
  padding: 0 !important;
  overflow: hidden;
  background: var(--color-bg-card) !important;
}
.msg-bubble.mine.card-bubble {
  background: var(--color-bg-card) !important;
  border: 1px solid var(--color-primary);
}

.msg-card.article-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  cursor: pointer;
  min-width: 200px;
  max-width: 260px;
  transition: background 0.15s;
}
.msg-card.article-card:active {
  background: var(--color-bg-page);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-type-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: var(--radius-tag);
}
.card-hint {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-meta {
  font-size: 12px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
