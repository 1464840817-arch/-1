<!-- src/views/HomeView.vue -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCategoryTags, addCategoryTag, deleteCategoryTag } from '../api/tenant.js'
import { searchArticles } from '../api/search.js'
import { likeArticle } from '../api/article.js'
import { isCollected, toggleCollect as toggleCollectStore, currentIsAdmin } from '../store/user.js'

const router = useRouter()

// ==================== 搜索 ====================
const searchInput = ref('')
const handleSearch = () => {
  if (!searchInput.value.trim()) return
  router.push(`/search?q=${encodeURIComponent(searchInput.value.trim())}`)
}

// ==================== 筛选标签（动态拉取 + 管理员可编辑） ====================
const filterItems = ref(['全部'])
const tagObjects = ref([])   // 保留原始 tag 对象 {id, name, active}，供删除时反查 ID

const loadFilters = async () => {
  try {
    const tags = await getCategoryTags()
    buildFilterItems(tags)
  } catch (err) {
    console.warn('标签加载失败:', err.message || err)
  }
}

const buildFilterItems = (tags) => {
  const active = tags.filter(t => t.active && t.name !== '全部')
  tagObjects.value = active
  filterItems.value = ['全部', ...active.map(t => t.name)]
}

const switchFilter = (index) => {
  if (isEditMode.value) return
  activeFilterName.value = filterItems.value[index] || '全部'
}

// ==================== 编辑模式：标签管理（仅管理员及以上可操作） ====================
const isEditMode = ref(false)
const newTagName = ref('')
const tagEmojiWarning = ref(false)

/** 检测字符串是否包含 emoji */
function hasEmoji(str) {
  return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{FE0F}\u{238C}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/u.test(str)
}

/** 进入/退出编辑模式（仅管理员及以上可操作） */
const toggleEditMode = () => {
  if (!currentIsAdmin()) return
  isEditMode.value = !isEditMode.value
  newTagName.value = ''
}

/** 删除标签 — API 优先，失败降级本地 */
const removeTag = async (tagName) => {
  const idx = filterItems.value.indexOf(tagName)
  if (idx <= 0) return  // "全部" 不可删除

  // 先本地移除（乐观更新）
  filterItems.value.splice(idx, 1)

  // 如果删除的是当前选中标签，重置为"全部"
  if (activeFilterName.value === tagName) {
    activeFilterName.value = '全部'
  }

  // 异步同步到服务端：按名称反查 ID
  const tagObj = tagObjects.value.find(t => t.name === tagName)
  try {
    if (tagObj) {
      await deleteCategoryTag(tagObj.id)
    } else {
      await deleteCategoryTag(tagName)
    }
  } catch { /* API 不可用时静默降级 */ }
}

/** 添加标签 — API 优先，emoji 限制，失败降级本地 */
const addTag = async () => {
  const name = newTagName.value.trim()
  if (!name) return

  // emoji 检测
  if (hasEmoji(name)) {
    tagEmojiWarning.value = true
    setTimeout(() => { tagEmojiWarning.value = false }, 2500)
    return
  }

  if (filterItems.value.includes(name)) {
    newTagName.value = ''
    return
  }

  // 先本地添加（乐观更新）
  filterItems.value.push(name)
  const tempId = -Date.now()
  tagObjects.value.push({ id: tempId, name, active: true })
  newTagName.value = ''
  tagEmojiWarning.value = false

  // 异步同步到服务端
  try {
    const created = await addCategoryTag(name)
    if (created?.id) {
      const obj = tagObjects.value.find(t => t.id === tempId)
      if (obj) obj.id = created.id
    }
  } catch { /* API 不可用时静默降级 */ }
}

/** 添加标签的键盘事件 */
const onAddTagKeyup = (e) => {
  if (e.key === 'Enter') addTag()
}

// ==================== 文章数据 + 标签筛选 ====================
const articles = ref([])
const articlesLoading = ref(true)
const refreshing = ref(false)
const activeFilterName = ref('全部')

const loadArticles = async (silent = false) => {
  if (!silent) articlesLoading.value = true
  try {
    const data = await searchArticles({ pageSize: 50 })
    articles.value = data?.list || []
  } catch (err) {
    console.warn('文章加载失败:', err.message || err)
    articles.value = []
  } finally {
    articlesLoading.value = false
    refreshing.value = false
  }
}

onMounted(() => { loadFilters(); loadArticles() })

const filteredArticles = computed(() => {
  const list = activeFilterName.value === '全部'
    ? articles.value
    : articles.value.filter(a => a.tags && a.tags.includes(activeFilterName.value))
  // 同步收藏状态
  return list.map(a => ({ ...a, isCollected: isCollected(a.id) }))
})

// ==================== 点赞功能（乐观更新 + API 同步） ====================
const toggleLike = async (postId, event) => {
  if (event) event.stopPropagation()
  const post = articles.value.find(p => p.id === postId)
  if (post) {
    post.isLiked = !post.isLiked
    post.likes += post.isLiked ? 1 : -1
    if (post.isLiked) {
      try { await likeArticle(postId) } catch { /* 静默 */ }
    }
  }
}

// ==================== 收藏（接入全局 store，API 优先） ====================
const toggleCollect = async (postId, event) => {
  if (event) event.stopPropagation()
  await toggleCollectStore(postId)
}

// ==================== 跳转文章详情 ====================
const goToDetail = (id) => {
  router.push(`/article/${id}`)
}

// ==================== 跳转发布页 ====================
const goToPublish = () => {
  router.push('/publish')
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
    await loadArticles(true)
  }
  pullDistance.value = 0
}
</script>

<template>
  <main class="home-view" aria-label="技术首页">

    <!-- 1. 顶部搜索框 -->
    <div class="search-wrapper-container">
      <div class="search-wrapper">
        <input
          type="text"
          v-model="searchInput"
          placeholder="输入故障、设备或关键字..."
          class="search-input"
          id="home-search"
          aria-label="搜索工控技术经验"
          @keyup.enter="handleSearch"
        />
        <button class="search-btn" @click="handleSearch">搜</button>
      </div>
    </div>

    <!-- 2. 分类导航 -->
    <div class="category-tabs-wrapper" role="tablist" aria-label="技术分类">
      <span
        v-for="(tag, index) in filterItems"
        :key="tag"
        class="category-item"
        :class="{ active: activeFilterName === tag, editable: isEditMode && tag !== '全部' }"
        role="tab"
        :aria-selected="activeFilterName === tag"
        tabindex="0"
        @click="switchFilter(index)"
        @keydown.enter.prevent="switchFilter(index)"
        @keydown.space.prevent="switchFilter(index)"
      >
        {{ tag }}
        <span
          v-if="isEditMode && tag !== '全部'"
          class="tag-delete"
          role="button"
          tabindex="0"
          :aria-label="`删除标签 ${tag}`"
          @click.stop="removeTag(tag)"
          @keydown.enter.prevent.stop="removeTag(tag)"
          @keydown.space.prevent.stop="removeTag(tag)"
        >✕</span>
      </span>

      <!-- 编辑模式：添加标签输入区 -->
      <span v-if="isEditMode" class="add-tag-group">
        <input
          v-model="newTagName"
          type="text"
          class="add-tag-input"
          placeholder="新标签"
          maxlength="10"
          aria-label="新标签名称"
          @keyup="onAddTagKeyup"
        />
        <span class="add-tag-btn" role="button" tabindex="0" aria-label="添加标签" @click="addTag" @keydown.enter.prevent="addTag" @keydown.space.prevent="addTag">➕</span>
      </span>

      <!-- emoji 警告提示 -->
      <span v-if="isEditMode && tagEmojiWarning" class="emoji-warning" role="alert">⚠️ 标签不支持表情符号</span>

      <!-- 标签管理入口（仅管理员及以上可见） -->
      <span v-if="currentIsAdmin()" class="tag-admin-btn" role="button" tabindex="0" :aria-label="isEditMode ? '完成编辑' : '编辑标签'" @click="toggleEditMode" @keydown.enter.prevent="toggleEditMode" @keydown.space.prevent="toggleEditMode">
        {{ isEditMode ? '✔️ 完成' : '✏️' }}
      </span>
    </div>

    <!-- 3. 骨架屏（首次加载） -->
    <div v-if="articlesLoading && !refreshing" class="article-grid">
      <div v-for="n in 6" :key="n" class="skeleton-card">
        <div class="skeleton-row">
          <span class="skeleton-tag"></span>
          <span class="skeleton-views"></span>
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

    <!-- 4. 帖子列表 -->
    <div
      v-else-if="!articlesLoading"
      class="article-grid"
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
        v-for="post in filteredArticles"
        :key="post.id"
        class="post-card"
        role="button"
        tabindex="0"
        @click="goToDetail(post.id)"
        @keydown.enter.prevent="goToDetail(post.id)"
        @keydown.space.prevent="goToDetail(post.id)"
      >
        <div class="card-header">
          <div class="card-top-row">
            <span class="device-tag">{{ post.type }}</span>
            <span class="views-badge">👁️ {{ post.views }}</span>
          </div>
          <h3 class="post-title">{{ post.title }}</h3>
        </div>
        <div class="card-body">
          <p class="post-desc">{{ post.desc }}</p>
        </div>
        <div class="card-footer">
          <div class="author-info">
            <span class="author-name">{{ post.author }}</span>
            <span class="post-date"> · {{ post.date }}</span>
          </div>
          <div class="interaction-bar">
            <span class="action-btn" role="button" tabindex="0" :aria-label="post.isLiked ? '取消点赞' : '点赞'" @click="toggleLike(post.id, $event)" @keydown.enter.prevent="toggleLike(post.id, $event)" @keydown.space.prevent="toggleLike(post.id, $event)">
              <span class="icon">{{ post.isLiked ? '❤️' : '🤍' }}</span>
              <span class="count">{{ post.likes }}</span>
            </span>
            <span class="action-btn">
              <span class="icon">💬</span>
              <span class="count">{{ post.comments }}</span>
            </span>
            <span class="action-btn" role="button" tabindex="0" :aria-label="post.isCollected ? '取消收藏' : '收藏'" @click="toggleCollect(post.id, $event)" @keydown.enter.prevent="toggleCollect(post.id, $event)" @keydown.space.prevent="toggleCollect(post.id, $event)">
              <span class="icon">{{ post.isCollected ? '⭐' : '☆' }}</span>
            </span>
          </div>
        </div>
      </article>
    </div>

    <!-- 5. 悬浮发布按钮 -->
    <div class="fab-button" role="button" tabindex="0" aria-label="发布经验" @click="goToPublish" @keydown.enter.prevent="goToPublish" @keydown.space.prevent="goToPublish">
      <span class="fab-icon">✏️</span>
      <span class="fab-text">发布经验</span>
    </div>

  </main>
</template>

<style scoped>
.home-view {
  background-color: var(--color-bg-page);
  min-height: 80vh;
  padding: 16px;
  padding-bottom: 80px;
}
.search-wrapper-container {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}
.search-wrapper {
  display: flex;
  align-items: center;
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 6px 6px 6px 16px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.04);
  border: 1px solid var(--color-border);
  width: 100%;
  max-width: 500px;
}
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px 0;
  font-size: 15px;
  outline: none;
  color: var(--color-text-primary);
}
.search-input::placeholder { color: var(--color-text-tertiary); }
.search-btn {
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
}
.search-btn:active { opacity: 0.8; }

.category-tabs-wrapper {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-bottom: 16px;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
}
.category-tabs-wrapper::-webkit-scrollbar { display: none; }
.category-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  background-color: var(--color-bg-card);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  user-select: none;
  white-space: nowrap;
}
.category-item:active { transform: scale(0.95); }
.category-item.active {
  background-color: var(--color-primary);
  color: var(--color-bg-card);
  border-color: var(--color-primary);
  font-weight: 500;
}
.category-item.editable {
  cursor: default;
  padding-right: 24px;
}
.category-item.editable:active {
  transform: none;
}

/* 删除按钮（编辑模式） */
.tag-delete {
  position: absolute;
  top: -5px;
  right: -4px;
  width: 18px;
  height: 18px;
  background: var(--color-error);
  color: #fff;
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  line-height: 1;
  transition: transform 0.15s;
}
.tag-delete:active { transform: scale(1.2); }

/* 编辑模式：添加标签输入组 */
.add-tag-group {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.add-tag-input {
  width: 72px;
  border: 1px dashed var(--color-border);
  border-radius: 16px;
  padding: 6px 10px;
  font-size: 12px;
  outline: none;
  background: transparent;
  color: var(--color-text-primary);
  font-family: inherit;
}
.add-tag-input:focus { border-color: var(--color-primary); }
.add-tag-input::placeholder {
  color: var(--color-text-tertiary);
  font-size: 11px;
}
.add-tag-btn {
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  line-height: 1;
  user-select: none;
  transition: transform 0.15s;
}
.add-tag-btn:active { transform: scale(1.2); }

/* emoji 警告提示 */
.emoji-warning {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: var(--color-error);
  background: var(--color-error-bg);
  padding: 4px 10px;
  border-radius: 12px;
  flex-shrink: 0;
  animation: fadeInOut 2.5s ease;
}
@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(-4px); }
  15% { opacity: 1; transform: translateY(0); }
  75% { opacity: 1; }
  100% { opacity: 0; }
}

/* 标签管理按钮 */
.tag-admin-btn {
  font-size: 13px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  user-select: none;
  padding: 5px 10px;
  border-radius: 14px;
  margin-left: auto;
  flex-shrink: 0;
  white-space: nowrap;
  background: var(--color-bg-page);
  transition: color 0.15s, background 0.15s;
}
.tag-admin-btn:active { background: var(--color-border); }
.tag-admin-btn:hover { color: var(--color-primary); }

.article-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
.post-card {
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.03);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s;
}
.post-card:active { transform: scale(0.98); }
.card-header { margin-bottom: 10px; }
.card-top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.device-tag {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 500;
  display: inline-block;
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 4px;
}
.views-badge {
  font-size: 11px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}
.post-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.4;
  margin-top: 4px;
}
.post-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0 0 12px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
}
.author-info {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--color-text-tertiary);
}
.author-name { color: var(--color-text-secondary); font-weight: 500; }
.post-date { color: var(--color-text-tertiary); }
.interaction-bar { display: flex; gap: 12px; }
.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}
.action-btn:active { color: var(--color-primary); }
.action-btn .icon { font-size: 15px; }
.fab-button {
  position: fixed;
  right: 20px;
  bottom: 90px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 20px;
  background: rgba(37, 99, 235, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #fff;
  border-radius: 28px;
  font-size: 15px;
  font-weight: 500;
  box-shadow:
    0 4px 16px rgba(37, 99, 235, 0.35),
    0 1px 4px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  user-select: none;
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 50;
}
.fab-button:active {
  transform: scale(0.95);
  box-shadow:
    0 2px 8px rgba(37, 99, 235, 0.25),
    0 1px 2px rgba(0, 0, 0, 0.06);
}
.fab-icon { font-size: 18px; line-height: 1; }
.fab-text { white-space: nowrap; }
@media (min-width: 768px) { .article-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .article-grid { grid-template-columns: repeat(3, 1fr); } }

/* --- 骨架屏 --- */
.skeleton-card {
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 16px;
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
.skeleton-views {
  width: 50px;
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
.skeleton-author { width: 60px; height: 12px; }
.skeleton-stats { width: 80px; height: 12px; }
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
  grid-column: 1 / -1;
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
</style>
