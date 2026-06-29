<!-- src/views/PostsView.vue -->
<!-- 我的发布 — 展示当前用户已发布的经验文章列表，支持管理（多选、删除、编辑） -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { PhArrowLeft, PhNotePencil, PhTrash, PhCaretUp, PhCaretDown, PhEye, PhX } from '@phosphor-icons/vue'
import { useRouter } from 'vue-router'
import { formatDateTime } from '../utils/date.js'
import { userStore } from '../store/user.js'
import { getMyPosts, deleteArticle } from '../api/article.js'

const router = useRouter()

// ==================== 文章列表 ====================
const posts = ref([])
const loading = ref(true)
const refreshing = ref(false)

const loadPosts = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const data = await getMyPosts()
    // 兼容新旧返回格式：新格式 { list, total, page, pageSize }
    if (data && Array.isArray(data.list)) {
      posts.value = data.list
    } else if (Array.isArray(data)) {
      posts.value = data  // 旧格式兜底
    } else {
      posts.value = []
    }
  } catch {
    if (!silent) posts.value = []
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

// ==================== 下拉刷新 ====================
const pullDistance = ref(0)
const pullStartY = ref(0)
const isPulling = ref(false)
const PULL_THRESHOLD = 60

const onPullStart = (e) => {
  if (refreshing.value || isManageMode.value) return
  pullStartY.value = e.touches[0].clientY
  isPulling.value = true
}

const onPullMove = (e) => {
  if (!isPulling.value || refreshing.value) return
  const delta = e.touches[0].clientY - pullStartY.value
  pullDistance.value = delta > 0 ? Math.min(delta * 0.45, 90) : 0
}

const onPullEnd = async () => {
  if (!isPulling.value) return
  isPulling.value = false
  if (pullDistance.value >= PULL_THRESHOLD) {
    refreshing.value = true
    pullDistance.value = 0
    await loadPosts(true)
  }
  pullDistance.value = 0
}

const myPosts = computed(() => {
  return [...posts.value].sort((a, b) => new Date(b.date) - new Date(a.date))
})

// ==================== 管理模式 ====================
const isManageMode = ref(false)
const selectedIds = ref(new Set())

/** 进入管理模式 */
const enterManageMode = (preselectId = null) => {
  isManageMode.value = true
  selectedIds.value = new Set()
  if (preselectId != null) {
    selectedIds.value.add(preselectId)
  }
}

/** 退出管理模式 */
const exitManageMode = () => {
  isManageMode.value = false
  selectedIds.value = new Set()
}

/** 切换管理模式 */
const toggleManageMode = () => {
  if (isManageMode.value) {
    exitManageMode()
  } else {
    enterManageMode()
  }
}

/** 切换单个文章的选中状态 */
const toggleSelect = (id) => {
  const next = new Set(selectedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedIds.value = next
}

/** 全选 / 取消全选 */
const toggleSelectAll = () => {
  if (selectedIds.value.size === myPosts.value.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(myPosts.value.map(p => p.id))
  }
}

const isAllSelected = computed(() => {
  return myPosts.value.length > 0 && selectedIds.value.size === myPosts.value.length
})

const selectedCount = computed(() => selectedIds.value.size)

// ==================== 长按检测 ====================
const longPressTimer = ref(null)
const longPressTarget = ref(null)

const LONG_PRESS_DURATION = 500  // ms

const startLongPress = (id, event) => {
  if (isManageMode.value) return  // 管理模式内不需要长按

  longPressTarget.value = id
  longPressTimer.value = setTimeout(() => {
    if (longPressTarget.value === id) {
      enterManageMode(id)
    }
    longPressTimer.value = null
    longPressTarget.value = null
  }, LONG_PRESS_DURATION)
}

const cancelLongPress = () => {
  if (longPressTimer.value) {
    clearTimeout(longPressTimer.value)
    longPressTimer.value = null
  }
  longPressTarget.value = null
}

const onTouchMove = () => {
  // 手指移动超过阈值则取消长按
  cancelLongPress()
}

// ==================== 操作 ====================

/** 批量删除选中文章 */
const deleteSelected = async () => {
  if (selectedIds.value.size === 0) return

  const idsToDelete = [...selectedIds.value]

  // 乐观本地删除
  posts.value = posts.value.filter(p => !idsToDelete.includes(p.id))
  exitManageMode()

  // 异步同步到服务端
  for (const id of idsToDelete) {
    try { await deleteArticle(id) } catch { /* 静默降级 */ }
  }
}

/** 编辑选中文章（仅单选） */
const editSelected = () => {
  if (selectedIds.value.size !== 1) return
  const [id] = [...selectedIds.value]
  router.push(`/publish?edit=${id}`)
}

// ==================== 导航 ====================
const goBack = () => router.back()
const goToDetail = (id) => {
  if (isManageMode.value) {
    toggleSelect(id)
  } else {
    router.push(`/article/${id}`)
  }
}

onMounted(() => {
  loadPosts()
})

onUnmounted(() => {
  cancelLongPress()
})
</script>

<template>
  <main class="posts-page" aria-label="我的文章">

    <!-- ==================== 顶部导航 ==================== -->
    <header class="page-header">
      <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="isManageMode ? exitManageMode() : goBack()" @keydown.enter.prevent="isManageMode ? exitManageMode() : goBack()" @keydown.space.prevent="isManageMode ? exitManageMode() : goBack()">
        <template v-if="isManageMode"><PhX :size="15" class="back-icon" /> 取消</template>
        <template v-else><PhArrowLeft :size="18" class="back-icon" /> 返回</template>
      </span>
      <span class="title">
        {{ isManageMode ? `已选 ${selectedCount} 项` : '我的发布' }}
      </span>
      <span
        v-if="myPosts.length > 0"
        class="manage-btn"
        role="button"
        tabindex="0"
        @click="toggleManageMode"
        @keydown.enter.prevent="toggleManageMode"
        @keydown.space.prevent="toggleManageMode"
      >
        {{ isManageMode ? '完成' : '管理' }}
      </span>
      <span v-else class="header-count">0 篇</span>
    </header>

    <!-- ==================== 管理模式工具栏 ==================== -->
    <div v-if="isManageMode && myPosts.length > 0" class="manage-toolbar">
      <label class="select-all-label" @click="toggleSelectAll" @keydown.enter.prevent="toggleSelectAll" @keydown.space.prevent="toggleSelectAll">
        <span
          class="checkbox-box"
          :class="{ checked: isAllSelected, indeterminate: selectedCount > 0 && !isAllSelected }"
          role="checkbox"
          :aria-checked="isAllSelected ? 'true' : selectedCount > 0 ? 'mixed' : 'false'"
          tabindex="0"
        ></span>
        <span class="select-all-text">
          {{ isAllSelected ? '取消全选' : '全选' }}
        </span>
      </label>
    </div>

    <!-- ==================== 加载骨架屏 ==================== -->
    <div v-if="loading && !refreshing" class="post-list">
      <div v-for="n in 3" :key="n" class="skeleton-card">
        <div class="skeleton-row">
          <span class="skeleton-tag"></span>
          <span class="skeleton-views"></span>
        </div>
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-date"></div>
      </div>
    </div>

    <!-- ==================== 下拉刷新指示器 ==================== -->
    <div
      v-if="refreshing"
      class="refresh-indicator"
    >
      <span class="refresh-spinner"></span>
      <span class="refresh-text">正在刷新...</span>
    </div>

    <!-- ==================== 空状态 ==================== -->
    <div v-else-if="!loading && myPosts.length === 0" class="empty-state">
      <span class="empty-icon"><PhNotePencil :size="56" /></span>
      <p class="empty-text">暂无发布文章</p>
      <p class="empty-hint">发布经验文章后会自动出现在这里</p>
      <button class="publish-btn" @click="router.push('/publish')">去发布经验</button>
    </div>

    <!-- ==================== 文章列表 ==================== -->
    <div
      v-else
      class="post-list"
      @touchstart.passive="onPullStart"
      @touchmove.passive="onPullMove"
      @touchend="onPullEnd"
    >
      <!-- 下拉提示 -->
      <div
        v-if="pullDistance > 0"
        class="pull-hint"
        :style="{ height: pullDistance + 'px', opacity: Math.min(pullDistance / PULL_THRESHOLD, 1) }"
      >
        <span class="pull-icon"><PhCaretUp v-if="pullDistance >= PULL_THRESHOLD" :size="14" /><PhCaretDown v-else :size="14" /></span>
        <span class="pull-text">{{ pullDistance >= PULL_THRESHOLD ? '释放刷新' : '下拉刷新' }}</span>
      </div>
      <article
        v-for="post in myPosts"
        :key="post.id"
        class="post-card"
        :class="{
          'manage-mode': isManageMode,
          selected: isManageMode && selectedIds.has(post.id),
        }"
        role="button"
        tabindex="0"
        @click="goToDetail(post.id)"
        @keydown.enter.prevent="goToDetail(post.id)"
        @keydown.space.prevent="goToDetail(post.id)"
        @touchstart.passive="startLongPress(post.id, $event)"
        @touchend="cancelLongPress"
        @touchmove="onTouchMove"
        @mousedown="startLongPress(post.id, $event)"
        @mouseup="cancelLongPress"
        @mouseleave="cancelLongPress"
      >
        <!-- 管理模式下的勾选框 -->
        <span
          v-if="isManageMode"
          class="select-checkbox"
          :class="{ checked: selectedIds.has(post.id) }"
          role="checkbox"
          :aria-checked="selectedIds.has(post.id) ? 'true' : 'false'"
          tabindex="0"
          @click.stop="toggleSelect(post.id)"
          @keydown.enter.prevent.stop="toggleSelect(post.id)"
          @keydown.space.prevent.stop="toggleSelect(post.id)"
        >
          <span v-if="selectedIds.has(post.id)" class="check-icon">✓</span>
        </span>

        <div class="card-top-row">
          <span class="device-tag">{{ post.type }}</span>
          <span class="views-badge"><PhEye :size="20" /> {{ post.views }}</span>
        </div>
        <h3 class="post-title">{{ post.title }}</h3>
        <span class="post-date">{{ formatDateTime(post.date) }}</span>
      </article>

      <!-- 列表底部 -->
      <div class="list-footer">
        <span class="footer-line"></span>
        <span class="footer-text">暂无更多文章</span>
        <span class="footer-line"></span>
      </div>
    </div>

    <!-- ==================== 悬浮发布按钮 ==================== -->
    <div
      v-if="!isManageMode"
      class="fab-button"
      role="button"
      tabindex="0"
      aria-label="发布经验"
      @click="router.push('/publish')"
      @keydown.enter.prevent="router.push('/publish')"
      @keydown.space.prevent="router.push('/publish')"
    >
      <span class="fab-icon"><PhNotePencil :size="18" /></span>
      <span class="fab-text">发布经验</span>
    </div>

    <!-- ==================== 管理模式底部操作栏 ==================== -->
    <div v-if="isManageMode" class="manage-bottom-bar">
      <button
        class="action-btn edit-btn"
        :disabled="selectedCount !== 1"
        @click="editSelected"
      >
        <PhNotePencil :size="16" /> 编辑
      </button>
      <button
        class="action-btn delete-btn"
        :disabled="selectedCount === 0"
        @click="deleteSelected"
      >
        <PhTrash :size="16" /> 删除{{ selectedCount > 0 ? ` (${selectedCount})` : "" }}
      </button>
    </div>

  </main>
</template>

<style scoped>
.posts-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding-bottom: 100px;
}

/* --- 顶部导航 --- */
.page-header {
  background: var(--color-bg-card);
  padding: 16px 16px;
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
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.back-icon { display: block; flex-shrink: 0; }
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.header-count {
  font-size: 13px;
  color: var(--color-text-tertiary);
}
.manage-btn {
  font-size: 14px;
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}
.manage-btn:active {
  background: var(--color-primary-light);
}

/* --- 管理模式工具栏 --- */
.manage-toolbar {
  display: flex;
  align-items: center;
  padding: 10px 16px;
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-divider);
}
.select-all-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}
.checkbox-box {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}
.checkbox-box.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.checkbox-box.checked::after {
  content: '✓';
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}
.checkbox-box.indeterminate {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.checkbox-box.indeterminate::after {
  content: '−';
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}
.select-all-text {
  font-size: 14px;
  color: var(--color-text-secondary);
}

/* --- 骨架屏 --- */
.skeleton-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 14px;
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.skeleton-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.skeleton-tag {
  width: 60px;
  height: 18px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--color-divider) 25%, var(--color-bg-page) 50%, var(--color-divider) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
.skeleton-views {
  width: 36px;
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--color-divider) 25%, var(--color-bg-page) 50%, var(--color-divider) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
.skeleton-line {
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--color-divider) 25%, var(--color-bg-page) 50%, var(--color-divider) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
.skeleton-title {
  width: 80%;
  height: 16px;
}
.skeleton-date {
  width: 100px;
  height: 12px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* --- 下拉刷新 --- */
.pull-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  overflow: hidden;
  transition: height 0.15s;
  color: var(--color-text-tertiary);
  font-size: 13px;
}
.pull-icon {
  display: flex;
  align-items: center;
}
.pull-text {
  user-select: none;
}

/* --- 刷新指示器 --- */
.refresh-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 0;
  color: var(--color-text-tertiary);
  font-size: 13px;
}
.refresh-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
.refresh-text {
  user-select: none;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* --- 空状态 --- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 20px;
  text-align: center;
}
.empty-icon { display: flex; color: var(--color-text-tertiary); margin-bottom: 16px; }
.empty-text { font-size: 16px; font-weight: 600; color: var(--color-text-body); margin: 0 0 6px 0; }
.empty-hint { font-size: 14px; color: var(--color-text-tertiary); margin: 0 0 20px 0; }
.publish-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  height: 44px;
  padding: 0 28px;
  border-radius: var(--radius-btn);
  font-size: 14px;
  cursor: pointer;
}

/* --- 文章列表 --- */
.post-list {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}
.post-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 14px;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}
.post-card:active { transform: scale(0.98); }

/* 管理模式下的卡片 */
.post-card.manage-mode {
  padding-left: 44px;
  cursor: pointer;
}
.post-card.manage-mode:active {
  transform: none;
}
.post-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

/* 勾选框 */
.select-checkbox {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}
.select-checkbox.checked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.check-icon {
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1;
}

/* 设备型号标签 + 浏览数 */
.card-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.device-tag {
  font-size: 12px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.views-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #94A3B8;
  flex-shrink: 0;
}

/* 文章标题 */
.post-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.4;
}

/* 发布日期 */
.post-date {
  font-size: 12px;
  color: #888;
}

/* --- 列表底部占位 --- */
.list-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 20px 0 10px 0;
}
.footer-line {
  flex: 1;
  max-width: 60px;
  height: 1px;
  background: var(--color-border);
}
.footer-text {
  font-size: 13px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
}

/* --- 悬浮发布按钮 --- */
.fab-button {
  position: fixed;
  right: 20px;
  bottom: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  padding: 0;
  background: var(--color-primary);
  color: #fff;
  border-radius: 50%;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: transform 0.2s;
  z-index: 50;
}
.fab-button:active {
  transform: scale(0.95);
}
.fab-icon { display: flex; align-items: center; }
.fab-text { display: none; }

/* --- 管理模式底部操作栏 --- */
.manage-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-divider);
  padding: 12px 16px;
  padding-bottom: max(12px, env(safe-area-inset-bottom));
  display: flex;
  gap: 12px;
  z-index: 50;
  box-shadow: 0 -2px 8px rgba(0,0,0,0.06);
}
.action-btn {
  flex: 1;
  height: 44px;
  padding: 0;
  border-radius: var(--radius-btn);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s, transform 0.15s;
}
.action-btn:active:not(:disabled) {
  transform: scale(0.97);
}
.action-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.edit-btn {
  background: var(--color-primary);
  color: #fff;
}
.delete-btn {
  background: #fff;
  color: var(--color-error);
  border: 1px solid var(--color-error);
}
</style>
