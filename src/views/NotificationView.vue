<!-- src/views/NotificationView.vue -->
<!-- 通知中心 — 展示评论/回复/点赞/收藏/分享/系统通知，点击跳转关联文章 -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getNotifications, markAllAsRead, markAsRead, deleteMessage } from '../api/message.js'

const router = useRouter()

// ==================== 消息数据 ====================
const messages = ref([])
const unreadCount = computed(() => messages.value.filter(m => m.unread).length)

// ==================== 类型筛选 ====================
const filterType = ref('all')

const FILTER_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'comment', label: '评论' },
  { key: 'reply', label: '回复' },
  { key: 'like', label: '点赞' },
  { key: 'collect', label: '收藏' },
  { key: 'share', label: '分享' },
  { key: 'friend', label: '好友' },
  { key: 'system', label: '系统' },
]

const filteredMessages = computed(() => {
  if (filterType.value === 'all') return messages.value
  return messages.value.filter(m => m.type === filterType.value)
})

// ==================== 管理模式 ====================
const isManageMode = ref(false)
const selectedIds = ref(new Set())

const enterManageMode = (preselectId = null) => {
  isManageMode.value = true
  selectedIds.value = new Set()
  if (preselectId != null) selectedIds.value.add(preselectId)
  swipedId.value = null
}

const exitManageMode = () => {
  isManageMode.value = false
  selectedIds.value = new Set()
}

const toggleSelect = (id) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

const toggleSelectAll = () => {
  if (selectedIds.value.size === filteredMessages.value.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(filteredMessages.value.map(m => m.id))
  }
}

const isAllSelected = computed(() =>
  filteredMessages.value.length > 0 && selectedIds.value.size === filteredMessages.value.length
)
const selectedCount = computed(() => selectedIds.value.size)

// ==================== 长按检测 ====================
const longPressTimer = ref(null)
const longPressTarget = ref(null)
const LONG_PRESS_DURATION = 500

const startLongPress = (id) => {
  if (isManageMode.value) return
  longPressTarget.value = id
  longPressTimer.value = setTimeout(() => {
    if (longPressTarget.value === id) enterManageMode(id)
    longPressTimer.value = null
    longPressTarget.value = null
  }, LONG_PRESS_DURATION)
}

const cancelLongPress = () => {
  if (longPressTimer.value) { clearTimeout(longPressTimer.value); longPressTimer.value = null }
  longPressTarget.value = null
}

// ==================== 左滑删除 ====================
const swipedId = ref(null)
const swipeStartX = ref(0)
const swipeStartY = ref(0)
const suppressNextClick = ref(false)

const onCardTouchStart = (id, event) => {
  startLongPress(id)
  swipeStartX.value = event.touches[0].clientX
  swipeStartY.value = event.touches[0].clientY
}

const onCardTouchMove = (id, event) => {
  cancelLongPress()
  if (isManageMode.value) return
  const deltaX = event.touches[0].clientX - swipeStartX.value
  const deltaY = event.touches[0].clientY - swipeStartY.value
  if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
    if (deltaX < -50) { swipedId.value = id; suppressNextClick.value = true }
    else if (deltaX > 50) { swipedId.value = null }
  }
}

const onCardTouchEnd = () => { cancelLongPress() }
const dismissSwipe = () => { swipedId.value = null }

// ==================== 类型配置 ====================
const typeConfig = {
  comment: { icon: '💬', color: 'var(--color-primary)', bg: 'var(--color-primary-light)', label: '评论' },
  reply:   { icon: '↩️', color: 'var(--color-msg-reply)', bg: 'var(--color-msg-reply-bg)', label: '回复' },
  like:    { icon: '❤️', color: 'var(--color-error)', bg: 'var(--color-error-bg)', label: '点赞' },
  collect: { icon: '⭐', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', label: '收藏' },
  share:   { icon: '📤', color: '#059669', bg: '#ECFDF5', label: '分享' },
  friend:  { icon: '👥', color: '#7C3AED', bg: '#F5F3FF', label: '好友' },
  system:  { icon: '📢', color: 'var(--color-msg-system)', bg: 'var(--color-msg-system-bg)', label: '系统' },
}

const getTypeMeta = (type) => typeConfig[type] || typeConfig.system

// ==================== 消息分组 ====================
const messageGroups = computed(() => {
  const groups = []
  const today = []; const yesterday = []; const earlier = []
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart.getTime() - 86400000)

  filteredMessages.value.forEach(msg => {
    const d = new Date(msg.date)
    if (d >= todayStart) today.push(msg)
    else if (d >= yesterdayStart) yesterday.push(msg)
    else earlier.push(msg)
  })

  if (today.length) groups.push({ label: '今天', items: today })
  if (yesterday.length) groups.push({ label: '昨天', items: yesterday })
  if (earlier.length) groups.push({ label: '更早', items: earlier })
  return groups
})

// ==================== 数据加载 ====================
const loadMessages = async () => {
  try {
    const data = await getNotifications()
    if (data && Array.isArray(data.list)) {
      messages.value = data.list
    } else if (Array.isArray(data)) {
      messages.value = data
    } else {
      messages.value = []
    }
  } catch {
    messages.value = []
  }
}

// ==================== 操作 ====================
const handleCardClick = (msg) => {
  if (suppressNextClick.value) { suppressNextClick.value = false; return }
  if (swipedId.value !== null && swipedId.value !== msg.id) { dismissSwipe(); return }
  if (swipedId.value === msg.id) { dismissSwipe(); return }
  if (isManageMode.value) { toggleSelect(msg.id); return }
  if (msg.unread) { msg.unread = false; markAsRead(msg.id).catch(() => {}) }
  if (msg.targetId) {
    if (msg.type === 'friend') {
      router.push('/friend')
    } else {
      router.push(`/article/${msg.targetId}`)
    }
  }
}

const handleDelete = async (msg) => {
  const idx = messages.value.findIndex(m => m.id === msg.id)
  if (idx >= 0) messages.value.splice(idx, 1)
  try { await deleteMessage(msg.id) } catch { /* 静默 */ }
}

const deleteSelected = async () => {
  if (selectedIds.value.size === 0) return
  const idsToDelete = [...selectedIds.value]
  for (const id of idsToDelete) {
    const idx = messages.value.findIndex(m => m.id === id)
    if (idx >= 0) messages.value.splice(idx, 1)
  }
  for (const id of idsToDelete) {
    try { await deleteMessage(id) } catch { /* 静默 */ }
  }
  exitManageMode()
}

const handleMarkAllRead = async () => {
  messages.value.forEach(m => { m.unread = false })
  try { await markAllAsRead() } catch { /* 静默 */ }
}

// ==================== 导航 ====================
const goBack = () => { router.back() }

onMounted(() => { loadMessages() })
onUnmounted(() => { cancelLongPress() })
</script>

<template>
  <main class="notification-page" aria-label="通知中心">

    <!-- ==================== 顶部导航 ==================== -->
    <header class="page-header">
      <template v-if="isManageMode">
        <span class="cancel-btn" role="button" tabindex="0" @click="exitManageMode" @keydown.enter.prevent="exitManageMode" @keydown.space.prevent="exitManageMode">✕ 取消</span>
        <span class="title">已选 {{ selectedCount }} 项</span>
        <button class="batch-delete-btn" :disabled="selectedCount === 0" @click="deleteSelected">
          删除{{ selectedCount > 0 ? `(${selectedCount})` : '' }}
        </button>
      </template>
      <template v-else>
        <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack">&larr; 返回</span>
        <div class="header-center">
          <h1 class="header-title">通知中心</h1>
          <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
        </div>
        <div class="header-right">
          <button v-if="unreadCount > 0" class="mark-all-btn" @click="handleMarkAllRead">全部已读</button>
          <span v-if="messages.length > 0" class="manage-btn" role="button" tabindex="0" @click="enterManageMode()" @keydown.enter.prevent="enterManageMode()" @keydown.space.prevent="enterManageMode()">管理</span>
        </div>
      </template>
    </header>

    <!-- ==================== 空状态 ==================== -->
    <div v-if="messages.length === 0" class="empty-state">
      <span class="empty-icon">🔔</span>
      <p class="empty-text">暂无通知</p>
      <p class="empty-hint">当有人评论、点赞或收藏你的文章时，你会在这里收到通知</p>
    </div>

    <!-- ==================== 管理模式全选工具栏 ==================== -->
    <div v-if="isManageMode && messages.length > 0" class="manage-toolbar">
      <label class="select-all-label" @click="toggleSelectAll">
        <span class="checkbox-box" :class="{ checked: isAllSelected, indeterminate: selectedCount > 0 && !isAllSelected }" role="checkbox" :aria-checked="isAllSelected ? 'true' : selectedCount > 0 ? 'mixed' : 'false'" tabindex="0"></span>
        <span class="select-all-text">{{ isAllSelected ? '取消全选' : '全选' }}</span>
      </label>
    </div>

    <!-- ==================== 类型筛选标签 ==================== -->
    <div v-if="messages.length > 0" class="filter-tabs" role="tablist" aria-label="通知类型筛选">
      <span v-for="opt in FILTER_OPTIONS" :key="opt.key" class="filter-item" :class="{ active: filterType === opt.key }" role="tab" :aria-selected="filterType === opt.key ? 'true' : 'false'" tabindex="0" @click="filterType = opt.key" @keydown.enter.prevent="filterType = opt.key" @keydown.space.prevent="filterType = opt.key">{{ opt.label }}</span>
    </div>

    <!-- ==================== 通知列表 ==================== -->
    <div v-if="messages.length > 0" class="message-body">
      <div v-for="group in messageGroups" :key="group.label" class="message-group">
        <div class="group-label">{{ group.label }}</div>
        <div class="group-cards">
          <div v-for="msg in group.items" :key="msg.id" class="message-card-wrapper" :class="{ swiped: swipedId === msg.id }">
            <span v-if="!isManageMode" class="swipe-delete-btn" role="button" tabindex="0" aria-label="删除通知" @click.stop="handleDelete(msg)" @keydown.enter.prevent.stop="handleDelete(msg)" @keydown.space.prevent.stop="handleDelete(msg)">删除</span>
            <div
              class="message-card"
              :class="{ 'is-unread': msg.unread, 'manage-mode': isManageMode, 'selected': isManageMode && selectedIds.has(msg.id), 'swiped': swipedId === msg.id }"
              role="button" tabindex="0"
              @click="handleCardClick(msg)"
              @keydown.enter.prevent="handleCardClick(msg)"
              @keydown.space.prevent="handleCardClick(msg)"
              @touchstart.passive="onCardTouchStart(msg.id, $event)"
              @touchend="onCardTouchEnd"
              @touchmove="onCardTouchMove(msg.id, $event)"
              @mousedown="startLongPress(msg.id)"
              @mouseup="cancelLongPress"
              @mouseleave="cancelLongPress"
            >
              <span v-if="isManageMode" class="select-checkbox" :class="{ checked: selectedIds.has(msg.id) }" role="checkbox" :aria-checked="selectedIds.has(msg.id) ? 'true' : 'false'" tabindex="0" @click.stop="toggleSelect(msg.id)" @keydown.enter.prevent.stop="toggleSelect(msg.id)" @keydown.space.prevent.stop="toggleSelect(msg.id)">
                <span v-if="selectedIds.has(msg.id)" class="check-icon">✓</span>
              </span>
              <div class="card-avatar" :style="{ background: getTypeMeta(msg.type).bg, color: getTypeMeta(msg.type).color }">{{ getTypeMeta(msg.type).icon }}</div>
              <div class="card-body">
                <div class="card-title-row">
                  <span class="sender-name">{{ msg.sender }}</span>
                  <span v-if="msg.action" class="action-text">{{ msg.action }}</span>
                </div>
                <p class="card-content">{{ msg.content }}</p>
              </div>
              <div class="card-meta">
                <span class="time-text">{{ msg.time }}</span>
                <span v-if="msg.unread" class="unread-dot"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </main>
</template>

<style scoped>
/* ==================== 整体 ==================== */
.notification-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding-bottom: 20px;
}

/* ==================== 顶部导航 ==================== */
.page-header {
  background: var(--color-bg-card);
  padding: 15px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-divider);
  position: sticky;
  top: 0;
  z-index: 10;
}
.back-btn {
  font-size: 15px;
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
}
.header-center {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}
.unread-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: var(--color-error);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  border-radius: 10px;
  line-height: 1;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}
.mark-all-btn {
  font-size: 13px;
  color: var(--color-primary);
  background: none;
  border: none;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s;
  font-family: inherit;
}
.mark-all-btn:active { background: var(--color-primary-light); }
.manage-btn {
  font-size: 14px;
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}
.manage-btn:active { background: var(--color-primary-light); }

/* ==================== 空状态 ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 20px;
  text-align: center;
}
.empty-icon { font-size: 56px; margin-bottom: 16px; }
.empty-text { font-size: 16px; font-weight: 600; color: var(--color-text-body); margin: 0 0 6px 0; }
.empty-hint { font-size: 14px; color: var(--color-text-tertiary); margin: 0; max-width: 260px; line-height: 1.6; }

/* ==================== 管理模式 Header ==================== */
.cancel-btn { font-size: 15px; color: var(--color-primary); font-weight: 500; cursor: pointer; }
.title { font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
.batch-delete-btn {
  font-size: 14px; font-weight: 500;
  color: var(--color-error);
  background: none;
  border: 1px solid var(--color-error);
  border-radius: 6px;
  padding: 5px 14px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.batch-delete-btn:active:not(:disabled) { background: var(--color-error-bg); transform: scale(0.96); }
.batch-delete-btn:disabled { opacity: 0.35; cursor: not-allowed; }

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

/* ==================== 筛选标签 ==================== */
.filter-tabs {
  display: flex; gap: 8px; margin: 0 16px; padding: 12px 0;
  overflow-x: auto; white-space: nowrap;
  -webkit-overflow-scrolling: touch;
  max-width: 720px; margin-left: auto; margin-right: auto; width: 100%; box-sizing: border-box;
}
.filter-tabs::-webkit-scrollbar { display: none; }
.filter-item {
  padding: 5px 14px; border-radius: 16px; font-size: 13px;
  background: var(--color-bg-card); color: var(--color-text-secondary);
  cursor: pointer; flex-shrink: 0; user-select: none;
  border: 1px solid var(--color-border); transition: all 0.2s;
}
.filter-item:active { transform: scale(0.95); }
.filter-item.active {
  background: var(--color-primary); color: #fff;
  border-color: var(--color-primary); font-weight: 500;
}

/* ==================== 消息分组 ==================== */
.message-body {
  padding: 0 16px; max-width: 720px; margin-left: auto; margin-right: auto; width: 100%; box-sizing: border-box;
}
.message-group { margin-top: 20px; }
.group-label { font-size: 13px; font-weight: 600; color: var(--color-text-tertiary); margin-bottom: 8px; padding-left: 2px; }
.group-cards {
  background: var(--color-bg-card); border-radius: 12px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03); overflow: hidden;
}

/* ==================== 左滑容器 ==================== */
.message-card-wrapper {
  position: relative; overflow: hidden; background: var(--color-bg-card);
}
.message-card-wrapper + .message-card-wrapper { border-top: 1px solid var(--color-bg-page); }
.swipe-delete-btn {
  position: absolute; right: 0; top: 0; bottom: 0; width: 70px;
  background: var(--color-error); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 600; cursor: pointer;
  user-select: none; letter-spacing: 1px;
  opacity: 0; pointer-events: none; transition: opacity 0.2s;
}
.message-card-wrapper.swiped .swipe-delete-btn { opacity: 1; pointer-events: auto; }
.swipe-delete-btn:active { opacity: 0.85; }

/* ==================== 消息卡片 ==================== */
.message-card {
  display: flex; align-items: flex-start; padding: 14px 16px; gap: 12px;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.25, 0.8, 0.25, 1.2);
  position: relative; z-index: 1; background: var(--color-bg-card);
}
.message-card:active { background: var(--color-bg-page); }
.message-card.swiped { transform: translateX(-70px); }
.message-card.is-unread { background: var(--color-primary-light); }
.message-card.is-unread::before {
  content: ''; position: absolute; left: 0; top: 8px; bottom: 8px;
  width: 3px; background: var(--color-primary); border-radius: 0 2px 2px 0;
}
.card-avatar {
  width: 40px; height: 40px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0; line-height: 1;
}
.card-body { flex: 1; min-width: 0; }
.card-title-row {
  display: flex; align-items: baseline; gap: 4px; margin-bottom: 4px; flex-wrap: wrap;
}
.sender-name { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.action-text { font-size: 13px; color: var(--color-text-secondary); font-weight: 400; }
.card-content {
  font-size: 13px; color: var(--color-text-secondary); line-height: 1.5; margin: 0;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.card-meta {
  display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
  flex-shrink: 0; margin-left: 4px;
}
.time-text { font-size: 11px; color: var(--color-text-tertiary); white-space: nowrap; }
.unread-dot { width: 8px; height: 8px; background: var(--color-primary); border-radius: 50%; }

/* ==================== 管理模式卡片 ==================== */
.message-card.manage-mode { padding-left: 44px; cursor: pointer; }
.message-card.manage-mode:active { background: var(--color-bg-page); }
.message-card.selected { border-color: var(--color-primary); background: var(--color-primary-light); }
.select-checkbox {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s; flex-shrink: 0;
}
.select-checkbox.checked { background: var(--color-primary); border-color: var(--color-primary); }
.check-icon { color: #fff; font-size: 12px; font-weight: 700; line-height: 1; }
</style>
