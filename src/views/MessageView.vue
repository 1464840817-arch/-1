<!-- src/views/MessageView.vue -->
<!-- 私聊列表 — 按联系人分组展示私信会话 + 顶部通知入口 -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { PhBell, PhChatCircle } from '@phosphor-icons/vue'
import { useRouter } from 'vue-router'
import { getChatMessages, getNotificationCount, markAllAsRead, markAsRead, deleteMessage } from '../api/message.js'
import { decrementUnread } from '../store/messages.js'

const router = useRouter()

// ==================== 通知未读数 ====================
const notiUnread = ref(0)

const fetchNotiCount = async () => {
  try {
    const res = await getNotificationCount()
    notiUnread.value = res?.count || 0
  } catch { /* 静默 */ }
}

// ==================== 私聊消息数据 ====================
const chatMessages = ref([])

// 按联系人分组后的会话列表
const conversations = computed(() => {
  const map = new Map()
  chatMessages.value.forEach(msg => {
    const key = msg.targetId || msg.sender
    if (!map.has(key)) {
      map.set(key, {
        targetId: msg.targetId,
        sender: msg.sender,
        avatar: msg.senderAvatar || '',
        account: msg.senderAccount || '',
        department: msg.senderDepartment || '',
        lastMessage: msg.content,
        lastTime: msg.time,
        lastDate: msg.date,
        unreadCount: 0,
        allIds: [],
      })
    }
    const conv = map.get(key)
    conv.allIds.push(msg.id)
    if (msg.unread) conv.unreadCount++
  })
  // 按最新消息时间排序
  return [...map.values()].sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate))
})

// ==================== 管理模式 ====================
const isManageMode = ref(false)
const selectedKeys = ref(new Set())

const enterManageMode = () => {
  isManageMode.value = true
  selectedKeys.value = new Set()
  swipedKey.value = null
}

const exitManageMode = () => {
  isManageMode.value = false
  selectedKeys.value = new Set()
}

const getConvKey = (c) => c.targetId || c.sender

const toggleSelect = (conv) => {
  const key = getConvKey(conv)
  const next = new Set(selectedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selectedKeys.value = next
}

const toggleSelectAll = () => {
  if (selectedKeys.value.size === conversations.value.length) {
    selectedKeys.value = new Set()
  } else {
    selectedKeys.value = new Set(conversations.value.map(c => getConvKey(c)))
  }
}

const isAllSelected = computed(() =>
  conversations.value.length > 0 && selectedKeys.value.size === conversations.value.length
)
const selectedCount = computed(() => selectedKeys.value.size)

// ==================== 左滑删除 ====================
const swipedKey = ref(null)
const swipeStartX = ref(0)
const swipeStartY = ref(0)
const suppressNextClick = ref(false)

const onCardTouchStart = (conv, event) => {
  swipeStartX.value = event.touches[0].clientX
  swipeStartY.value = event.touches[0].clientY
}

const onCardTouchMove = (conv, event) => {
  if (isManageMode.value) return
  const deltaX = event.touches[0].clientX - swipeStartX.value
  const deltaY = event.touches[0].clientY - swipeStartY.value
  if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
    const key = getConvKey(conv)
    if (deltaX < -50) { swipedKey.value = key; suppressNextClick.value = true }
    else if (deltaX > 50) { swipedKey.value = null }
  }
}

const dismissSwipe = () => { swipedKey.value = null }

// ==================== 数据加载 ====================
const loadChats = async () => {
  try {
    const data = await getChatMessages({ pageSize: 200 })
    if (data && Array.isArray(data.list)) {
      chatMessages.value = data.list
    } else if (Array.isArray(data)) {
      chatMessages.value = data
    } else {
      chatMessages.value = []
    }
  } catch {
    chatMessages.value = []
  }
}

// ==================== 操作 ====================
const handleConvClick = (conv) => {
  if (suppressNextClick.value) { suppressNextClick.value = false; return }
  const key = getConvKey(conv)
  if (swipedKey.value !== null && swipedKey.value !== key) { dismissSwipe(); return }
  if (swipedKey.value === key) { dismissSwipe(); return }
  if (isManageMode.value) { toggleSelect(conv); return }
  // 标记该会话所有未读消息为已读
  const unreadIds = conv.allIds.filter((_id, i) => {
    const msg = chatMessages.value.find(m => m.id === conv.allIds[i] || m.id === _id)
    return msg && msg.unread
  })
  // Actually find the unread message IDs from the original messages
  const unreadMsgIds = chatMessages.value
    .filter(m => (m.targetId || m.sender) === key && m.unread)
    .map(m => m.id)
  if (unreadMsgIds.length > 0) {
    chatMessages.value.forEach(m => {
      if ((m.targetId || m.sender) === key) m.unread = false
    })
    markAsRead(unreadMsgIds).catch(() => {})
    // 乐观扣减底部导航栏消息红点数
    decrementUnread(unreadMsgIds.length)
  }
  // 导航到私聊页面
  if (conv.targetId) router.push(`/chat/${conv.targetId}`)
}

/** 删除整个会话的所有消息 */
const handleDeleteConv = async (conv) => {
  const key = getConvKey(conv)
  // 删除该会话所有消息
  const idsToDelete = chatMessages.value
    .filter(m => (m.targetId || m.sender) === key)
    .map(m => m.id)
  // 乐观移除
  chatMessages.value = chatMessages.value.filter(m => !idsToDelete.includes(m.id))
  // 异步删除
  for (const id of idsToDelete) {
    try { await deleteMessage(id) } catch { /* 静默 */ }
  }
  dismissSwipe()
}

/** 批量删除选中的会话 */
const deleteSelected = async () => {
  if (selectedKeys.value.size === 0) return
  const keysToDelete = [...selectedKeys.value]
  for (const key of keysToDelete) {
    const idsToDelete = chatMessages.value
      .filter(m => (m.targetId || m.sender) === key)
      .map(m => m.id)
    chatMessages.value = chatMessages.value.filter(m => !idsToDelete.includes(m.id))
    for (const id of idsToDelete) {
      try { await deleteMessage(id) } catch { /* 静默 */ }
    }
  }
  exitManageMode()
}

// ==================== 通知入口点击 ====================
const goToNotifications = () => {
  router.push('/notifications')
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadChats()
  fetchNotiCount()
})

// 每次页面可见时刷新通知未读数
let visibilityHandler = null
onMounted(() => {
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') fetchNotiCount()
  }
  document.addEventListener('visibilitychange', visibilityHandler)
})

onUnmounted(() => {
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
})
</script>

<template>
  <main class="chat-page" aria-label="私聊">

    <!-- ==================== 顶部导航 ==================== -->
    <header class="page-header">
      <div class="header-left">
        <span v-if="isManageMode" class="cancel-btn" role="button" tabindex="0" @click="exitManageMode" @keydown.enter.prevent="exitManageMode" @keydown.space.prevent="exitManageMode">取消</span>
      </div>
      <div class="header-center">
        <h1 v-if="!isManageMode" class="header-title">消息</h1>
        <span v-else class="title">已选 {{ selectedCount }} 项</span>
      </div>
      <div class="header-right">
        <button v-if="isManageMode" class="batch-delete-btn" :disabled="selectedCount === 0" @click="deleteSelected">
          删除{{ selectedCount > 0 ? `(${selectedCount})` : '' }}
        </button>
        <span
          v-else-if="conversations.length > 0"
          class="manage-btn"
          role="button"
          tabindex="0"
          @click="enterManageMode()"
          @keydown.enter.prevent="enterManageMode()"
          @keydown.space.prevent="enterManageMode()"
        >管理</span>
      </div>
    </header>

    <!-- ==================== 通知入口卡片 ==================== -->
    <div
      class="noti-entry"
      role="button"
      tabindex="0"
      aria-label="查看通知"
      @click="goToNotifications"
      @keydown.enter.prevent="goToNotifications"
      @keydown.space.prevent="goToNotifications"
    >
      <div class="noti-entry-left">
        <div class="noti-icon-box">
          <PhBell :size="18" />
        </div>
        <div class="noti-info">
          <span class="noti-label">通知</span>
          <span class="noti-sub">评论、点赞等互动消息</span>
        </div>
      </div>
      <div class="noti-entry-right">
        <span v-if="notiUnread > 0" class="noti-dot" aria-label="有未读通知"></span>
        <span class="noti-arrow">›</span>
      </div>
    </div>

    <!-- ==================== 管理模式全选工具栏 ==================== -->
    <div v-if="isManageMode && conversations.length > 0" class="manage-toolbar">
      <label class="select-all-label" @click="toggleSelectAll">
        <span class="checkbox-box" :class="{ checked: isAllSelected, indeterminate: selectedCount > 0 && !isAllSelected }" role="checkbox" :aria-checked="isAllSelected ? 'true' : selectedCount > 0 ? 'mixed' : 'false'" tabindex="0"></span>
        <span class="select-all-text">{{ isAllSelected ? '取消全选' : '全选' }}</span>
      </label>
    </div>

    <!-- ==================== 空状态 ==================== -->
    <div v-if="conversations.length === 0" class="empty-state">
      <PhChatCircle :size="56" />
      <p class="empty-text">暂无私聊</p>
      <p class="empty-hint">当有人向你发送私信时，会话将显示在这里</p>
    </div>

    <!-- ==================== 私聊会话列表 ==================== -->
    <div v-else class="conv-list">
      <div
        v-for="conv in conversations"
        :key="getConvKey(conv)"
        class="conv-card-wrapper"
        :class="{ swiped: swipedKey === getConvKey(conv) }"
      >
        <!-- 左滑删除按钮 -->
        <span
          v-if="!isManageMode"
          class="swipe-delete-btn"
          role="button"
          tabindex="0"
          aria-label="删除会话"
          @click.stop="handleDeleteConv(conv)"
          @keydown.enter.prevent.stop="handleDeleteConv(conv)"
          @keydown.space.prevent.stop="handleDeleteConv(conv)"
        >删除</span>

        <!-- 会话卡片 -->
        <div
          class="conv-card"
          :class="{
            'manage-mode': isManageMode,
            'selected': isManageMode && selectedKeys.has(getConvKey(conv)),
            'swiped': swipedKey === getConvKey(conv),
            'has-unread': conv.unreadCount > 0,
          }"
          role="button"
          tabindex="0"
          @click="handleConvClick(conv)"
          @keydown.enter.prevent="handleConvClick(conv)"
          @keydown.space.prevent="handleConvClick(conv)"
          @touchstart.passive="onCardTouchStart(conv, $event)"
          @touchmove="onCardTouchMove(conv, $event)"
        >
          <!-- 管理模式勾选框 -->
          <span
            v-if="isManageMode"
            class="select-checkbox"
            :class="{ checked: selectedKeys.has(getConvKey(conv)) }"
            role="checkbox"
            :aria-checked="selectedKeys.has(getConvKey(conv)) ? 'true' : 'false'"
            tabindex="0"
            @click.stop="toggleSelect(conv)"
            @keydown.enter.prevent.stop="toggleSelect(conv)"
            @keydown.space.prevent.stop="toggleSelect(conv)"
          >
            <span v-if="selectedKeys.has(getConvKey(conv))" class="check-icon">✓</span>
          </span>

          <!-- 头像 -->
          <img v-if="conv.avatar" :src="conv.avatar" class="conv-avatar-img" alt="" />
          <div v-else class="conv-avatar">{{ conv.sender[0] }}</div>

          <!-- 中间内容 -->
          <div class="conv-body">
            <div class="conv-top-row">
              <span class="conv-name">{{ conv.sender }}</span>
              <span v-if="conv.department" class="conv-dept">{{ conv.department }}</span>
              <span class="conv-time">{{ conv.lastTime }}</span>
            </div>
            <div class="conv-bottom-row">
              <p class="conv-preview">{{ conv.lastMessage }}</p>
              <span v-if="conv.unreadCount > 0" class="conv-unread-badge">{{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </main>
</template>

<style scoped>
/* ==================== 整体 ==================== */
.chat-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding-bottom: 20px;
}

/* ==================== 顶部导航 ==================== */
.page-header {
  background: var(--color-bg-card);
  padding: 16px 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-divider);
  position: sticky;
  top: 0;
  z-index: 10;
}
.header-left   { flex: 1; display: flex; align-items: center; }
.header-center { flex: 1; display: flex; align-items: center; justify-content: center; text-align: center; }
.header-right  { flex: 1; display: flex; align-items: center; justify-content: flex-end; }
.header-title { font-size: 18px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
.manage-btn {
  font-size: 14px; color: var(--color-primary); font-weight: 500;
  cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.15s;
}
.manage-btn:active { background: var(--color-primary-light); }

/* 管理模式 Header */
.cancel-btn { font-size: 15px; color: var(--color-primary); font-weight: 500; cursor: pointer; padding: 4px 0; }
.title { font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
.batch-delete-btn {
  font-size: 14px; font-weight: 500;
  color: var(--color-error);
  background: none;
  border: 1px solid var(--color-error);
  border-radius: var(--radius-btn);
  padding: 4px 14px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.batch-delete-btn:active:not(:disabled) { background: var(--color-error-bg); transform: scale(0.96); }
.batch-delete-btn:disabled { opacity: 0.35; cursor: not-allowed; }

/* ==================== 通知入口卡片 ==================== */
.noti-entry {
  margin: 12px 16px 0;
  padding: 16px;
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background 0.15s;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: calc(100% - 32px);
  box-sizing: border-box;
  box-shadow: var(--shadow-card);
}
.noti-entry:active { background: var(--color-bg-page); }
.noti-entry-left { display: flex; align-items: center; gap: 12px; }
.noti-icon-box {
  width: 40px; height: 40px;
  background: var(--color-primary-light);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  flex-shrink: 0;
}
.noti-info { display: flex; flex-direction: column; gap: 2px; }
.noti-label { font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
.noti-sub { font-size: 12px; color: var(--color-text-tertiary); }
.noti-entry-right { display: flex; align-items: center; gap: 8px; }
.noti-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-error);
  flex-shrink: 0;
}
.noti-arrow { font-size: 20px; color: var(--color-text-tertiary); font-weight: 300; }

/* ==================== 空状态 ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 20px;
  text-align: center;
}
.empty-icon { display: flex; color: var(--color-text-tertiary); margin-bottom: 16px; }
.empty-text { font-size: 16px; font-weight: 600; color: var(--color-text-body); margin: 0 0 6px 0; }
.empty-hint { font-size: 14px; color: var(--color-text-tertiary); margin: 0; max-width: 260px; line-height: 1.6; }

/* ==================== 全选工具栏 ==================== */
.manage-toolbar {
  display: flex; align-items: center; padding: 10px 16px;
  background: var(--color-bg-card); border-bottom: 1px solid var(--color-divider);
  max-width: 720px; margin-left: auto; margin-right: auto; width: 100%; box-sizing: border-box;
}
.select-all-label { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; }
.checkbox-box {
  width: 20px; height: 20px; border-radius: 4px;
  border: 2px solid var(--color-border);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; flex-shrink: 0;
}
.checkbox-box.checked { background: var(--color-primary); border-color: var(--color-primary); }
.checkbox-box.checked::after { content: '✓'; color: #fff; font-size: 12px; font-weight: 700; }
.checkbox-box.indeterminate { background: var(--color-primary); border-color: var(--color-primary); }
.checkbox-box.indeterminate::after { content: '−'; color: #fff; font-size: 14px; font-weight: 700; line-height: 1; }
.select-all-text { font-size: 14px; color: var(--color-text-secondary); }

/* ==================== 会话列表 ==================== */
.conv-list {
  margin-top: 12px;
  padding: 0 16px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--color-bg-card);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-card);
}

/* ==================== 会话卡片外层（左滑容器） ==================== */
.conv-card-wrapper {
  position: relative;
  overflow: hidden;
  background: var(--color-bg-card);
}
.conv-card-wrapper + .conv-card-wrapper {
  border-top: 1px solid var(--color-bg-page);
}

.swipe-delete-btn {
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 70px;
  background: var(--color-error);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  letter-spacing: 1px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}
.conv-card-wrapper.swiped .swipe-delete-btn {
  opacity: 1;
  pointer-events: auto;
}
.swipe-delete-btn:active { opacity: 0.85; }

/* ==================== 会话卡片 ==================== */
.conv-card {
  display: flex;
  align-items: center;
  padding: 16px 16px;
  gap: 12px;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1.2);
  position: relative;
  z-index: 1;
  background: var(--color-bg-card);
}
.conv-card:active { background: var(--color-bg-page); }
.conv-card.swiped { transform: translateX(-70px); }

/* 未读会话左侧蓝色竖线 */
.conv-card.has-unread {
  background: var(--color-primary-light);
}
.conv-card.has-unread::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: var(--color-primary);
  border-radius: 0 2px 2px 0;
}

/* 头像 */
.conv-avatar {
  width: 48px; height: 48px;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}
.conv-avatar-img {
  width: 48px; height: 48px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

/* 中间内容 */
.conv-body { flex: 1; min-width: 0; }
.conv-top-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.conv-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
}
.conv-dept {
  font-size: 11px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-page);
  padding: 1px 6px;
  border-radius: var(--radius-tag);
  white-space: nowrap;
  flex-shrink: 0;
}
.conv-time {
  font-size: 12px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}
.conv-bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.conv-preview {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.conv-unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: var(--radius-card);
  line-height: 1;
  flex-shrink: 0;
}

/* ==================== 管理模式卡片 ==================== */
.conv-card.manage-mode { padding-left: 44px; cursor: pointer; }
.conv-card.manage-mode:active { background: var(--color-bg-page); }
.conv-card.selected { background: var(--color-primary-light); }
.select-checkbox {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}
.select-checkbox.checked { background: var(--color-primary); border-color: var(--color-primary); }
.check-icon { color: #fff; font-size: 12px; font-weight: 700; line-height: 1; }
</style>
