<!-- src/views/ProfileView.vue -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { userStore, clearLoginState, currentCanAccessAdmin } from '../store/user.js'
import { getDelistedPosts } from '../api/article.js'
import { getProfileVisibility } from '../api/tenant.js'
import { request } from '../api/client.js'

const router = useRouter()

// ==================== 数据加载 ====================
const loading = ref(true)
const refreshing = ref(false)
const postCount = ref(0)
const delistedCount = ref(0)
const totalLikes = ref(0)
const totalViews = ref(0)

// 个人页面模块可见性
const visibility = ref({
  myPosts: true,
  totalLikes: true,
  totalViews: true,
  collections: true,
  history: true,
  delisted: true,
})

const loadAll = async (silent = false) => {
  if (!silent) loading.value = true
  try {
    const [stats, delistedData, visData] = await Promise.all([
      request('/user/stats').catch(() => ({ total_likes: 0, total_views: 0, total_posts: 0 })),
      getDelistedPosts().catch(() => ({ list: [], total: 0 })),
      getProfileVisibility().catch(() => null),
    ])
    postCount.value = stats.total_posts || 0
    totalLikes.value = stats.total_likes || 0
    totalViews.value = stats.total_views || 0
    // 已下架文章数量
    if (delistedData && typeof delistedData.total === 'number') {
      delistedCount.value = delistedData.total
    } else if (Array.isArray(delistedData)) {
      delistedCount.value = delistedData.length
    } else if (delistedData && Array.isArray(delistedData.list)) {
      delistedCount.value = delistedData.list.length
    }
    // 可见性配置
    if (visData) {
      visibility.value = visData
    }
  } catch {
    postCount.value = 0
  } finally {
    loading.value = false
    refreshing.value = false
  }
}

const allStats = computed(() => [
  { key: 'myPosts', label: '我的发布', count: postCount.value, icon: '📝', color: 'green' },
  { key: 'totalLikes', label: '获得点赞', count: totalLikes.value, icon: '❤️', color: 'red' },
  { key: 'totalViews', label: '总浏览量', count: totalViews.value, icon: '👁️', color: 'blue' },
  { key: 'collections', label: '收藏夹', count: userStore.collectIds.length, icon: '📁', color: 'purple' },
  { key: 'history', label: '浏览历史', count: userStore.historyIds.length, icon: '🕒', color: 'amber' },
  { key: 'delisted', label: '已下架文章', count: delistedCount.value, icon: '📦', color: 'slate' },
])

// 根据可见性配置过滤看板卡片
const stats = computed(() => allStats.value.filter(s => visibility.value[s.key] !== false))

// ==================== 下拉刷新 ====================
const pullDistance = ref(0)
const pullStartY = ref(0)
const isPulling = ref(false)
const PULL_THRESHOLD = 60

const onPullStart = (e) => {
  if (refreshing.value) return
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
    await loadAll(true)
  }
  pullDistance.value = 0
}

onMounted(() => { loadAll() })

const handleEditProfile = () => {
  router.push('/profile/edit')
}

/** 点击看板卡片跳转 */
const goToStat = (label) => {
  const routeMap = {
    '收藏夹': '/collection',
    '浏览历史': '/history',
    '我的发布': '/profile/posts',
    '已下架文章': '/profile/delisted',
  }
  if (routeMap[label]) router.push(routeMap[label])
}

/** 退出登录 */
const handleLogout = () => {
  clearLoginState()
  router.push('/login')
}
</script>

<template>
  <main
    class="profile-view"
    aria-label="个人主页"
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
      <span class="pull-icon">{{ pullDistance >= PULL_THRESHOLD ? '⬆️' : '⬇️' }}</span>
      <span class="pull-text">{{ pullDistance >= PULL_THRESHOLD ? '释放刷新' : '下拉刷新' }}</span>
    </div>

    <!-- 刷新指示器 -->
    <div v-if="refreshing" class="refresh-indicator">
      <span class="refresh-spinner"></span>
      <span class="refresh-text">正在刷新...</span>
    </div>

    <!-- ==================== 1. 个人资料卡片 ==================== -->
    <div class="profile-card">

      <!-- 装饰性渐变横幅 -->
      <div class="card-banner">
        <span class="banner-orb banner-orb--1"></span>
        <span class="banner-orb banner-orb--2"></span>
      </div>

      <!-- 头像 + 基本信息 -->
      <div class="card-body">
        <div class="avatar-wrapper">
          <div class="avatar">{{ userStore.name[0] }}</div>
          <span class="avatar-dot"></span>
        </div>

        <div class="profile-info">
          <div class="name-line">
            <h2 class="user-name">{{ userStore.name }}</h2>
            <span class="role-badge">{{ userStore.role }}</span>
          </div>
          <p class="user-account">{{ userStore.account }}</p>
        </div>
      </div>

      <!-- 个人简介 -->
      <p class="user-bio">{{ userStore.desc }}</p>

      <!-- 操作区 -->
      <div class="card-actions">
        <button class="edit-btn" @click="handleEditProfile">
          <svg class="btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          编辑资料
        </button>
      </div>
    </div>

    <!-- ==================== 2. 数据看板 ==================== -->
    <div class="stats-grid">
      <div
        v-for="(stat, index) in stats"
        :key="index"
        class="stat-card"
        :class="`stat-card--${stat.color}`"
        role="button"
        tabindex="0"
        @click="goToStat(stat.label)"
        @keydown.enter.prevent="goToStat(stat.label)"
        @keydown.space.prevent="goToStat(stat.label)"
      >
        <span class="stat-icon">{{ stat.icon }}</span>
        <span class="stat-count">{{ stat.count }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </div>
    </div>

    <!-- ==================== 3. 功能菜单 ==================== -->
    <div class="menu-card">
      <!-- 好友管理 -->
      <div class="menu-item" role="button" tabindex="0" @click="router.push('/friend')" @keydown.enter.prevent="router.push('/friend')" @keydown.space.prevent="router.push('/friend')">
        <span class="menu-icon-box menu-icon-box--purple">👥</span>
        <span class="menu-text">
          <span class="menu-label">好友管理</span>
          <span class="menu-hint">查看和管理好友列表</span>
        </span>
        <svg class="menu-arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>

      <!-- 管理中心（仅管理员及以上可见） -->
      <div v-if="currentCanAccessAdmin()" class="menu-item menu-item--admin" role="button" tabindex="0" @click="router.push('/admin')" @keydown.enter.prevent="router.push('/admin')" @keydown.space.prevent="router.push('/admin')">
        <span class="menu-icon-box menu-icon-box--amber">🛡️</span>
        <span class="menu-text">
          <span class="menu-label">管理中心</span>
          <span class="menu-hint">用户管理 · 系统配置</span>
        </span>
        <svg class="menu-arrow" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </div>

    <!-- ==================== 5. 退出登录 ==================== -->
    <button class="logout-btn" @click="handleLogout">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      退出登录
    </button>

  </main>
</template>

<style scoped>
/* ==================== 页面容器 ==================== */
.profile-view {
  background-color: var(--color-bg-page);
  min-height: 100vh;
  padding: 16px;
  padding-bottom: 80px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}

/* ==================== 1. 个人资料卡片 ==================== */
.profile-card {
  background: var(--color-bg-card);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02);
  margin-bottom: 16px;
}

/* --- 渐变横幅 --- */
.card-banner {
  position: relative;
  height: 72px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-msg-reply) 100%);
  opacity: 0.12;
}
/* 装饰性光斑 */
.banner-orb {
  position: absolute;
  border-radius: 50%;
  background: var(--color-primary);
}
.banner-orb--1 {
  width: 120px; height: 120px;
  top: -60px; right: -30px;
  opacity: 0.15;
}
.banner-orb--2 {
  width: 60px; height: 60px;
  bottom: -20px; left: 20%;
  opacity: 0.1;
}

/* --- 头像 + 基本信息 --- */
.card-body {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  margin-top: -36px;  /* 头像上移覆盖横幅底部 */
  position: relative;
  z-index: 1;
}

.avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}
.avatar {
  width: 72px; height: 72px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-msg-reply) 100%);
  color: #fff;
  font-size: 28px;
  font-weight: 700;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 3px solid #fff;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.25);
  letter-spacing: 1px;
}
/* 在线状态指示点 */
.avatar-dot {
  position: absolute;
  bottom: 4px; right: 4px;
  width: 14px; height: 14px;
  background: var(--color-success);
  border: 2.5px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3);
}

.profile-info {
  flex: 1;
  min-width: 0;
  padding-top: 4px;
}
.name-line {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}
.user-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: 0.3px;
}
.role-badge {
  font-size: 11px;
  font-weight: 500;
  background: var(--color-primary-light);
  color: var(--color-primary);
  padding: 3px 10px;
  border-radius: 20px;
  white-space: nowrap;
  letter-spacing: 0.2px;
}
.user-account {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: 0;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
  letter-spacing: 0.3px;
}

/* --- 个人简介 --- */
.user-bio {
  margin: 14px 20px 0 20px;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.65;
  position: relative;
  z-index: 1;
}

/* --- 编辑按钮 --- */
.card-actions {
  padding: 14px 20px 18px 20px;
  position: relative;
  z-index: 1;
}
.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: var(--color-bg-page);
  color: var(--color-text-body);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.edit-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}
.edit-btn:active {
  transform: scale(0.96);
}
.btn-icon {
  flex-shrink: 0;
}

/* ==================== 2. 数据看板 ==================== */
.stats-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.stat-card {
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 14px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  cursor: pointer;
  transition: all 0.18s ease;
  position: relative;
  overflow: hidden;
  flex: 0 0 calc((100% - 16px) / 3);
}
/* 顶部色条 */
.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 20%; right: 20%;
  height: 3px;
  border-radius: 0 0 3px 3px;
  transition: all 0.2s;
}
.stat-card--blue::before    { background: var(--color-primary); }
.stat-card--amber::before   { background: var(--color-warning); }
.stat-card--green::before   { background: var(--color-success); }
.stat-card--red::before     { background: var(--color-error); }
.stat-card--purple::before  { background: #8b5cf6; }
.stat-card--slate::before   { background: #64748b; }

.stat-card:active {
  transform: scale(0.95);
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.stat-icon {
  font-size: 22px;
  line-height: 1;
  transition: transform 0.2s;
}
.stat-card:active .stat-icon {
  transform: scale(1.15);
}

.stat-count {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1;
  letter-spacing: -0.5px;
}

.stat-label {
  font-size: 11px;
  color: var(--color-text-tertiary);
  font-weight: 400;
}

/* --- 下拉刷新 --- */
.pull-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  overflow: hidden;
  transition: height 0.15s;
  color: var(--color-text-tertiary);
  font-size: 13px;
}
.pull-icon { font-size: 14px; line-height: 1; }
.pull-text { user-select: none; }
.refresh-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 0;
  color: var(--color-text-tertiary);
  font-size: 13px;
}
.refresh-spinner {
  width: 18px; height: 18px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
.refresh-text { user-select: none; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ==================== 3. 功能菜单 ==================== */
.menu-card {
  background: var(--color-bg-card);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  margin-bottom: 20px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  cursor: pointer;
  transition: background 0.15s;
}
.menu-item:active {
  background: var(--color-bg-page);
}

.menu-icon-box {
  width: 42px; height: 42px;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 20px;
  flex-shrink: 0;
}
.menu-icon-box--purple {
  background: var(--color-msg-reply-bg);
}
.menu-icon-box--amber {
  background: #fef3c7;
}

/* 管理中心菜单项高亮 */
.menu-item--admin {
  border-top: 1px solid var(--color-divider);
  margin-top: 4px;
  padding-top: 18px;
}

.menu-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.menu-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.menu-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.menu-arrow {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.menu-item:active .menu-arrow {
  transform: translateX(3px);
}

/* ==================== 4. 退出登录 ==================== */
.logout-btn {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 0;
  background: var(--color-bg-card);
  color: var(--color-error);
  border: 1px solid transparent;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  transition: all 0.2s;
  font-family: inherit;
  letter-spacing: 0.5px;
}
.logout-btn:hover {
  background: var(--color-error-bg);
  border-color: rgba(239, 68, 68, 0.15);
}
.logout-btn:active {
  transform: scale(0.97);
  background: var(--color-error-bg);
}
</style>
