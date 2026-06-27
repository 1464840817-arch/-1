<!-- src/views/CollectionView.vue -->
<!-- 收藏夹 — 展示用户收藏的文章列表 -->
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { userStore } from '../store/user.js'
import { getArticle } from '../api/article.js'

const router = useRouter()

const collectedArticles = ref([])
const loading = ref(true)
const refreshing = ref(false)

const loadCollections = async (silent = false) => {
  if (!silent) loading.value = true
  const results = []
  for (const id of userStore.collectIds) {
    try {
      const article = await getArticle(id)
      if (article) results.push(article)
    } catch { /* 跳过已删除的文章 */ }
  }
  collectedArticles.value = results
  loading.value = false
  refreshing.value = false
}

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
    await loadCollections(true)
  }
  pullDistance.value = 0
}

onMounted(() => { loadCollections() })

const goBack = () => router.back()
const goToDetail = (id) => router.push(`/article/${id}`)
</script>

<template>
  <main class="collection-page" aria-label="我的收藏">

    <!-- 顶部导航 -->
    <header class="page-header">
      <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack">← 返回</span>
      <span class="title">收藏夹</span>
      <span class="header-count">{{ collectedArticles.length }} 篇</span>
    </header>

    <!-- 加载骨架屏 -->
    <div v-if="loading && !refreshing" class="article-list">
      <div v-for="n in 3" :key="n" class="skeleton-card">
        <div class="skeleton-row">
          <span class="skeleton-tag"></span>
          <span class="skeleton-date-tag"></span>
        </div>
        <div class="skeleton-line skeleton-title"></div>
        <div class="skeleton-line skeleton-desc"></div>
        <div class="skeleton-row">
          <span class="skeleton-line skeleton-author"></span>
          <span class="skeleton-line skeleton-stats"></span>
        </div>
      </div>
    </div>

    <!-- 下拉刷新指示器 -->
    <div v-if="refreshing" class="refresh-indicator">
      <span class="refresh-spinner"></span>
      <span class="refresh-text">正在刷新...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!loading && collectedArticles.length === 0" class="empty-state">
      <span class="empty-icon">📁</span>
      <p class="empty-text">收藏夹还是空的</p>
      <p class="empty-hint">浏览文章时点击 ⭐ 即可收藏</p>
      <button class="browse-btn" @click="router.push('/home')">去首页看看</button>
    </div>

    <!-- 文章列表 -->
    <div
      v-else-if="collectedArticles.length > 0"
      class="article-list"
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
      <article
        v-for="article in collectedArticles"
        :key="article.id"
        class="article-card"
        role="button"
        tabindex="0"
        @click="goToDetail(article.id)"
        @keydown.enter.prevent="goToDetail(article.id)"
        @keydown.space.prevent="goToDetail(article.id)"
      >
        <div class="card-header">
          <span class="device-tag">{{ article.type }}</span>
          <span class="article-date">{{ article.date }}</span>
        </div>
        <h3 class="article-title">{{ article.title }}</h3>
        <p class="article-desc">{{ article.desc }}</p>
        <div class="card-footer">
          <span class="author">{{ article.author }}</span>
          <div class="stats">
            <span>❤️ {{ article.likes }}</span>
            <span>💬 {{ article.comments }}</span>
          </div>
        </div>
      </article>
    </div>

  </main>
</template>

<style scoped>
.collection-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding-bottom: 20px;
}

/* --- 顶部 --- */
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
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.header-count {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

/* --- 骨架屏 --- */
.skeleton-card {
  background: var(--color-bg-card);
  border-radius: 10px;
  padding: 14px;
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
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
.skeleton-date-tag {
  width: 80px;
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
.skeleton-title { width: 80%; height: 16px; }
.skeleton-desc { width: 95%; }
.skeleton-author { width: 40px; height: 12px; }
.skeleton-stats { width: 70px; height: 12px; }
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
.refresh-text { user-select: none; }
@keyframes spin { to { transform: rotate(360deg); } }

/* --- 空状态 --- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 20px;
  text-align: center;
}
.empty-icon { font-size: 56px; margin-bottom: 16px; }
.empty-text { font-size: 16px; font-weight: 600; color: var(--color-text-body); margin: 0 0 6px 0; }
.empty-hint { font-size: 14px; color: var(--color-text-tertiary); margin: 0 0 20px 0; }
.browse-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 10px 28px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

/* --- 文章列表 --- */
.article-list {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}
.article-card {
  background: var(--color-bg-card);
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.15s;
}
.article-card:active { transform: scale(0.98); }
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.device-tag {
  font-size: 12px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.article-date { font-size: 12px; color: var(--color-text-tertiary); }
.article-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 6px 0;
  line-height: 1.4;
}
.article-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0 0 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.author { font-size: 12px; color: var(--color-text-tertiary); }
.stats { display: flex; gap: 12px; font-size: 12px; color: var(--color-text-tertiary); }
</style>
