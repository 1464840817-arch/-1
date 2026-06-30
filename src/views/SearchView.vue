<!-- src/views/SearchView.vue -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getCategoryTags, addCategoryTag, deleteCategoryTag, getTenantConfig } from '../api/tenant.js'
import { getSearchHistory, addSearchHistory, clearSearchHistory } from '../api/searchHistory.js'
import { searchArticles } from '../api/search.js'
import { currentIsAdmin } from '../store/user.js'
import { PhArrowLeft, PhPlus, PhWarning, PhCheck, PhNotePencil, PhClock, PhMagnifyingGlass, PhCaretUp, PhCaretDown, PhHeart, PhChatCircle, PhEye } from '@phosphor-icons/vue'
import { formatDateTime } from '../utils/date.js'

const route = useRoute()
const router = useRouter()

// 从首页搜索框跳转过来时，URL 带有 ?q=xxx，自动填入搜索词
const searchInput = ref(route.query.q || '')

// ==================== 品牌区域 ====================
const platformName = ref('工控技术库')
const platformSubtitle = ref('经验沉淀 · 故障智搜')
const platformLogo = ref('')

// ==================== 搜索历史 ====================
const MAX_HISTORY = 8
const searchHistory = ref([])

const loadHistory = async () => {
  try {
    const data = await getSearchHistory()
    if (Array.isArray(data)) {
      searchHistory.value = data.slice(0, MAX_HISTORY)
      return
    }
  } catch { /* API 不可用时静默 */ }
}

/** 添加搜索词到历史记录 — 乐观本地 + 异步 API */
const pushToHistory = (term) => {
  const t = term.trim()
  if (!t) return
  // 本地去重 & 插入最前
  const idx = searchHistory.value.findIndex(h => h === t)
  if (idx >= 0) searchHistory.value.splice(idx, 1)
  searchHistory.value.unshift(t)
  if (searchHistory.value.length > MAX_HISTORY) {
    searchHistory.value = searchHistory.value.slice(0, MAX_HISTORY)
  }
  // 异步同步到服务端
  addSearchHistory(t).catch(() => {})
}

/** 清空全部历史 — 乐观本地 + 异步 API */
const clearHistory = () => {
  searchHistory.value = []
  clearSearchHistory().catch(() => {})
}

/** 点击历史记录项 → 填词并搜索 */
const tapHistoryItem = (term) => {
  searchInput.value = term
  activeTag.value = '全部'
  doSearch()
}

// ==================== 筛选标签 ====================
const filterTags = ref(['全部'])
const tagObjects = ref([])   // 保留原始 tag 对象 {id, name, active}，供删除时反查 ID
const activeTag = ref('全部')
const isEditMode = ref(false)
const newTagName = ref('')
const tagEmojiWarning = ref(false)

/** 检测字符串是否包含 emoji */
function hasEmoji(str) {
  return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{FE0F}\u{238C}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/u.test(str)
}

/** 从 API 数据构建标签列表 */
const buildFilterTags = (tags) => {
  const active = tags.filter(t => t.active && t.name !== '全部')
  tagObjects.value = active
  filterTags.value = ['全部', ...active.map(t => t.name)]
}

const loadFilterData = async () => {
  try {
    const tags = await getCategoryTags()
    buildFilterTags(tags)
  } catch (err) {
    console.warn('标签加载失败:', err.message || err)
    // API 不可用时保留默认"全部"标签
  }
}

/** 切换筛选标签 */
const switchFilter = (tagName) => {
  activeTag.value = tagName
  if (hasSearched.value) {
    doSearch()
  }
}

// ==================== 编辑模式：标签管理 ====================

/** 进入/退出编辑模式（仅管理员及以上可操作） */
const toggleEditMode = () => {
  if (!currentIsAdmin()) return
  isEditMode.value = !isEditMode.value
  newTagName.value = ''
}

/** 删除标签 — API 优先，失败降级本地 */
const removeTag = async (tagName) => {
  const idx = filterTags.value.indexOf(tagName)
  if (idx <= 0) return  // "全部" 不可删除

  // 先本地移除（乐观更新）
  filterTags.value.splice(idx, 1)

  // 如果删除的是当前选中标签，重置为"全部"
  if (activeTag.value === tagName) {
    activeTag.value = '全部'
    if (hasSearched.value) doSearch()
  }

  // 异步同步到服务端：按名称反查 ID
  const tagObj = tagObjects.value.find(t => t.name === tagName)
  try {
    if (tagObj) {
      await deleteCategoryTag(tagObj.id)
    } else {
      await deleteCategoryTag(tagName) // 降级：无 ID 时传名称
    }
  } catch {
    // API 不可用时静默降级
  }
}

/** 添加标签 — API 优先，失败降级本地 */
const addTag = async () => {
  const name = newTagName.value.trim()
  if (!name) return

  // emoji 检测
  if (hasEmoji(name)) {
    tagEmojiWarning.value = true
    setTimeout(() => { tagEmojiWarning.value = false }, 2500)
    return
  }

  if (filterTags.value.includes(name)) {
    newTagName.value = ''
    return
  }

  // 先本地添加（乐观更新）
  filterTags.value.push(name)
  // 本地补一个临时 tag 对象，后续删除时可反查 ID
  const tempId = -Date.now()
  tagObjects.value.push({ id: tempId, name, active: true })
  newTagName.value = ''
  tagEmojiWarning.value = false

  // 异步同步到服务端，用真实 ID 替换临时 ID
  try {
    const created = await addCategoryTag(name)
    if (created?.id) {
      const obj = tagObjects.value.find(t => t.id === tempId)
      if (obj) obj.id = created.id
    }
  } catch {
    // API 不可用时静默降级
  }
}

/** 添加标签的键盘事件 */
const onAddTagKeyup = (e) => {
  if (e.key === 'Enter') addTag()
}

// ==================== 排序方式 ====================
const SORT_OPTIONS = [
  { label: '最新发布', value: 'latest' },
  { label: '点赞最多', value: 'likes' },
  { label: '收藏最多', value: 'collections' },
]
const sortMode = ref('latest')
const showSortDropdown = ref(false)
const sortLabel = computed(() => SORT_OPTIONS.find(o => o.value === sortMode.value)?.label || '最新')

const toggleSortDropdown = () => {
  showSortDropdown.value = !showSortDropdown.value
}

const selectSortMode = (value) => {
  sortMode.value = value
  showSortDropdown.value = false
}

const sortedResults = computed(() => {
  const list = [...searchResults.value]
  if (sortMode.value === 'likes') {
    list.sort((a, b) => (b.likes || 0) - (a.likes || 0))
  } else if (sortMode.value === 'collections') {
    list.sort((a, b) => (b.isCollected ? 1 : 0) - (a.isCollected ? 1 : 0))
  } else {
    // latest — 按日期降序
    list.sort((a, b) => new Date(b.date) - new Date(a.date))
  }
  return list
})

// ==================== 搜索逻辑 ====================
const hasSearched = ref(false)
const searchResults = ref([])
const searching = ref(false)
const refreshing = ref(false)

const doSearch = async (silent = false) => {
  const keyword = searchInput.value.trim()
  if (!keyword) return

  // 记录搜索历史
  pushToHistory(keyword)

  if (!silent) searching.value = true
  try {
    const data = await searchArticles({
      keyword,
      tag: activeTag.value !== '全部' ? activeTag.value : undefined,
      sortBy: sortMode.value,
    })
    searchResults.value = data?.list || []
  } catch (err) {
    console.warn('搜索失败:', err.message || err)
    searchResults.value = []
  } finally {
    searching.value = false
    refreshing.value = false
    hasSearched.value = true
  }
}

const handleSearch = () => {
  if (!searchInput.value.trim()) return
  doSearch()
}

const backToSearch = () => {
  hasSearched.value = false
  searchResults.value = []
}

// 如果进来时带了 query（从首页搜索跳转），自动搜索
const autoSearch = () => {
  if (route.query.q) {
    searchInput.value = route.query.q
    doSearch()
  }
}

// 点击搜索结果跳转详情
const goToDetail = (id) => {
  router.push(`/article/${id}`)
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
    await doSearch(true)
  }
  pullDistance.value = 0
}

// 高亮关键词（先转义 HTML 实体防止 XSS，再包裹 <mark> 标签）
const htmlEscape = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const highlight = (text) => {
  const keyword = searchInput.value.trim()
  if (!keyword) return text
  let escaped = htmlEscape(text)
  const escapedKeyword = htmlEscape(keyword)
  const re = new RegExp(`(${escapedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  return escaped.replace(re, '<mark>$1</mark>')
}

const onClickOutside = (e) => {
  if (!showSortDropdown.value) return
  const el = e.target
  if (!el.closest('.sort-dropdown-wrapper')) {
    showSortDropdown.value = false
  }
}

onMounted(() => {
  loadHistory()
  loadFilterData()
  autoSearch()
  // 加载平台配置（名称 + Logo），失败静默降级为默认值
  getTenantConfig().then(config => {
    platformName.value = config.name || '工控技术库'
    platformSubtitle.value = config.subtitle || '经验沉淀 · 故障智搜'
    platformLogo.value = config.logoUrl || ''
  }).catch(() => {})
  document.addEventListener('click', onClickOutside)
  // 从管理中心跳转过来时自动进入编辑模式（仅管理员及以上）
  if (route.query.admin === '1' && currentIsAdmin()) {
    isEditMode.value = true
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<template>
  <main class="search-view" :class="{ 'has-results': hasSearched }" aria-label="搜索页面">

    <!-- 品牌区域（初始状态显示，搜索后隐藏以节省空间） -->
    <div v-if="!hasSearched" class="brand-area">
      <!-- 已上传 Logo：显示图片 -->
      <img v-if="platformLogo" :src="platformLogo" class="brand-logo-img" alt="平台 Logo" />
      <!-- 未上传：显示默认靶心图标（与登录页同款） -->
      <svg v-else class="brand-logo-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="34" stroke="currentColor" stroke-width="2.5" fill="none" />
        <g stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="40" y1="2"  x2="40" y2="10" />
          <line x1="40" y1="70" x2="40" y2="78" />
          <line x1="2"  y1="40" x2="10" y2="40" />
          <line x1="70" y1="40" x2="78" y2="40" />
          <line x1="13.1" y1="13.1" x2="18.8" y2="18.8" />
          <line x1="61.2" y1="61.2" x2="66.9" y2="66.9" />
          <line x1="66.9" y1="13.1" x2="61.2" y2="18.8" />
          <line x1="18.8" y1="61.2" x2="13.1" y2="66.9" />
        </g>
        <circle cx="40" cy="40" r="18" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5" />
        <rect x="30" y="30" width="20" height="20" rx="3" fill="currentColor" opacity="0.85" />
        <g stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="40" y1="21" x2="40" y2="28" />
          <line x1="40" y1="52" x2="40" y2="59" />
          <line x1="21" y1="40" x2="28" y2="40" />
          <line x1="52" y1="40" x2="59" y2="40" />
        </g>
        <circle cx="40" cy="40" r="3" fill="#fff" />
      </svg>
      <h1 class="brand-name">{{ platformName }}</h1>
      <p class="brand-subtitle">{{ platformSubtitle }}</p>
    </div>

    <!-- 始终在顶部的搜索区域 -->
    <div class="search-header">
      <!-- 0. 搜索结果时：返回按钮（位于筛选标签上方最左边） -->
      <div v-if="hasSearched" class="search-back-row">
        <span class="search-back-btn" role="button" tabindex="0" @click="backToSearch" @keydown.enter.prevent="backToSearch" @keydown.space.prevent="backToSearch">
          <span class="back-icon"><PhArrowLeft :size="18" /></span>
          <span class="back-text">返回</span>
        </span>
      </div>

      <!-- 1. 横向筛选标签栏 -->
      <div class="filter-tabs" role="tablist" aria-label="筛选标签">
        <span
          v-for="tag in filterTags"
          :key="tag"
          class="filter-item"
          :class="{ active: activeTag === tag, editable: isEditMode && tag !== '全部' }"
          role="tab"
          :aria-selected="activeTag === tag"
          @click="!isEditMode && switchFilter(tag)"
          @keydown.enter.prevent="!isEditMode && switchFilter(tag)"
          @keydown.space.prevent="!isEditMode && switchFilter(tag)"
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
          <span class="add-tag-btn" role="button" tabindex="0" aria-label="添加标签" @click="addTag" @keydown.enter.prevent="addTag" @keydown.space.prevent="addTag"><PhPlus :size="16" /></span>
        </span>

        <!-- emoji 警告提示 -->
        <span v-if="isEditMode && tagEmojiWarning" class="emoji-warning" role="alert"><PhWarning :size="12" /> 标签不支持表情符号</span>

        <!-- 标签管理入口（仅管理员及以上可见，置于标签栏右上方） -->
        <span v-if="currentIsAdmin()" class="tag-admin-btn" role="button" tabindex="0" :aria-label="isEditMode ? '完成编辑' : '编辑标签'" @click="toggleEditMode" @keydown.enter.prevent="toggleEditMode" @keydown.space.prevent="toggleEditMode">
          <template v-if="isEditMode"><PhCheck :size="13" /> 完成</template>
          <template v-else><PhNotePencil :size="13" /></template>
        </span>
      </div>

      <!-- 2. 搜索框 -->
      <div class="search-wrapper">
        <input
          type="text"
          id="search-input"
          v-model="searchInput"
          placeholder="输入故障、设备或关键字..."
          aria-label="搜索工控技术经验"
          class="search-input"
          @keyup.enter="handleSearch"
        />
        <button class="search-btn" @click="handleSearch">搜</button>
      </div>

      <!-- 3. 排序栏（仅搜索结果时在搜索栏下方最右侧显示） -->
      <div v-if="hasSearched" class="sort-row">
        <div class="sort-dropdown-wrapper">
          <span class="sort-toggle" role="button" tabindex="0" aria-haspopup="listbox" :aria-expanded="showSortDropdown" @click.stop="toggleSortDropdown" @keydown.enter.prevent="toggleSortDropdown" @keydown.space.prevent="toggleSortDropdown">
            {{ sortLabel }} ▾
          </span>
          <div v-if="showSortDropdown" class="sort-dropdown" role="listbox">
            <div
              v-for="opt in SORT_OPTIONS"
              :key="opt.value"
              class="sort-option"
              :class="{ active: sortMode === opt.value }"
              role="option"
              :aria-selected="sortMode === opt.value"
              tabindex="0"
              @click.stop="selectSortMode(opt.value)"
              @keydown.enter.prevent="selectSortMode(opt.value)"
              @keydown.space.prevent="selectSortMode(opt.value)"
            >
              {{ opt.label }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. 未搜索时：搜索历史卡片 -->
    <div v-if="!hasSearched" class="search-initial">
      <div v-if="searchHistory.length > 0" class="history-card">
        <div class="card-title">搜索历史</div>
        <div class="history-list">
          <div
            v-for="(term, index) in searchHistory"
            :key="index"
            class="history-item"
            role="button"
            tabindex="0"
            @click="tapHistoryItem(term)"
            @keydown.enter.prevent="tapHistoryItem(term)"
            @keydown.space.prevent="tapHistoryItem(term)"
          >
            <span class="history-icon"><PhClock :size="14" /></span>
            <span class="history-text">{{ term }}</span>
          </div>
        </div>
        <button class="clear-history-btn" @click="clearHistory">清空历史</button>
      </div>
    </div>

    <!-- 4. 搜索结果列表 -->
    <div v-else class="search-results">
      <!-- 结果统计 -->
      <div class="results-header" aria-live="polite" aria-atomic="true">
        <span class="results-count">找到 {{ sortedResults.length }} 条结果</span>
        <span class="results-keyword">"{{ searchInput.trim() }}"</span>
      </div>

      <!-- 搜索中骨架屏 -->
      <div v-if="searching && !refreshing" class="result-list">
        <div v-for="n in 4" :key="n" class="skeleton-card">
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

      <!-- 无结果 -->
      <div v-else-if="!searching && sortedResults.length === 0" class="empty-state" role="status">
        <span class="empty-icon"><PhMagnifyingGlass :size="48" /></span>
        <p class="empty-text">未找到相关经验文章</p>
        <p class="empty-hint">试试更换关键词，或减少筛选条件</p>
      </div>

      <!-- 结果列表 -->
      <div
        v-else-if="!searching && sortedResults.length > 0"
        class="result-list"
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
          v-for="article in sortedResults"
          :key="article.id"
          class="result-card"
          role="button"
          tabindex="0"
          @click="goToDetail(article.id)"
          @keydown.enter.prevent="goToDetail(article.id)"
          @keydown.space.prevent="goToDetail(article.id)"
        >
          <div class="result-header">
            <span class="result-type">{{ article.type }}</span>
            <span class="result-date">{{ formatDateTime(article.date) }}</span>
          </div>
          <h3 class="result-title" v-html="highlight(article.title)"></h3>
          <p class="result-desc" v-html="highlight(article.desc)"></p>
          <div class="result-meta">
            <span>{{ article.author }}</span>
            <span><PhEye :size="20" /> {{ article.views }}</span>
            <span><PhHeart :size="12" /> {{ article.likes }}</span>
            <span><PhChatCircle :size="12" /> {{ article.comments }}</span>
          </div>
        </article>
      </div>
    </div>

    <!-- 5. 悬浮发布按钮（与首页同位置） -->
    <div class="fab-button" role="button" tabindex="0" aria-label="发布经验" @click="router.push('/publish')" @keydown.enter.prevent="router.push('/publish')" @keydown.space.prevent="router.push('/publish')">
      <span class="fab-icon"><PhNotePencil :size="18" /></span>
      <span class="fab-text">发布经验</span>
    </div>

  </main>
</template>

<style scoped>
/* --- 整体容器 --- */
.search-view {
  background-color: var(--color-bg-page);
  min-height: calc(var(--app-height, 100dvh) - 65px);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: 16px;
  box-sizing: border-box;
}
.search-view.has-results {
  padding-bottom: 0;
}

/* --- 顶部搜索区域（sticky 固定，状态切换不跳动） --- */
.search-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--color-bg-page);
  padding: 8px 0;
  flex-shrink: 0;
}

/* ==================== 品牌区域 ==================== */
.brand-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 28px;
  padding-bottom: 4px;
  flex-shrink: 0;
}

/* 已上传 Logo 图片 */
.brand-logo-img {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  object-fit: contain;
}

/* 默认靶心图标（与登录页同款，linear 风格） */
.brand-logo-icon {
  width: 60px;
  height: 60px;
  color: var(--color-primary);
}

.brand-name {
  font-size: 20px;
  font-weight: 700;
  color: #0F172A;
  margin: 10px 0 0 0;
  line-height: 1.4;
}

.brand-subtitle {
  font-size: 14px;
  font-weight: 400;
  color: #94A3B8;
  margin: 4px 0 0 0;
  line-height: 1.4;
}

/* --- 搜索框 --- */
.search-wrapper {
  display: flex;
  align-items: center;
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 6px 6px 6px 16px;
  border: 1px solid var(--color-border);
  width: 100%;
  box-sizing: border-box;
}
.search-input {
  flex: 1; border: none; background: transparent; padding: 10px 0; font-size: 15px; outline: none; color: var(--color-text-primary);
}
.search-input::placeholder { color: var(--color-text-tertiary); }
.search-btn {
  background: var(--color-primary); color: white; border: none; border-radius: var(--radius-btn); height: 44px; padding: 0 20px; font-size: 15px; font-weight: 500; cursor: pointer; flex-shrink: 0;
}

/* --- 排序栏（搜索栏下方最右侧） --- */
.sort-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
.sort-dropdown-wrapper {
  position: relative;
}
.sort-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-secondary);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 4px 14px;
  cursor: pointer;
  user-select: none;
  transition: color 0.15s, border-color 0.15s;
}
.sort-toggle:active {
  color: var(--color-primary);
  border-color: var(--color-primary);
}
.sort-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 120px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  z-index: 120;
}
.sort-option {
  padding: 10px 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}
.sort-option:not(:last-child) {
  border-bottom: 1px solid var(--color-bg-page);
}
.sort-option:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}
.sort-option.active {
  color: var(--color-primary);
  font-weight: 600;
  background: var(--color-primary-light);
}

/* ==================== 筛选标签栏 ==================== */
.filter-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px 0;
  overflow-x: auto;
  white-space: nowrap;
  padding: 4px 0;
  -webkit-overflow-scrolling: touch;
}
.filter-tabs::-webkit-scrollbar { display: none; }

/* 标签 chip */
.filter-item {
  position: relative;
  padding: 6px 16px;
  border-radius: var(--radius-full);
  font-size: 13px;
  background: #F1F5F9;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  user-select: none;
}
.filter-item:active { transform: scale(0.95); }
.filter-item.active {
  background: var(--color-primary);
  color: #fff;
  font-weight: 500;
}

/* 编辑模式下标签不可点击但保留样式 */
.filter-item.editable {
  cursor: default;
  padding-right: 24px;
}
.filter-item.editable:active {
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
.tag-delete:active {
  transform: scale(1.2);
}

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
.add-tag-input:focus {
  border-color: var(--color-primary);
}
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
  border-radius: var(--radius-btn);
  flex-shrink: 0;
  animation: fadeInOut 2.5s ease;
}
@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(-4px); }
  15% { opacity: 1; transform: translateY(0); }
  75% { opacity: 1; }
  100% { opacity: 0; }
}

/* 标签管理按钮（位于标签栏右侧） */
.tag-admin-btn {
  font-size: 13px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  user-select: none;
  padding: 4px 10px;
  border-radius: 14px;
  margin-left: auto;
  flex-shrink: 0;
  white-space: nowrap;
  background: var(--color-bg-page);
  transition: color 0.15s, background 0.15s;
}
.tag-admin-btn:active {
  background: var(--color-border);
}
.tag-admin-btn:hover {
  color: var(--color-primary);
}

/* --- 初始状态：搜索历史卡片 --- */
.search-initial {
  flex-shrink: 0;
  margin-top: 8px;
}
.history-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 20px;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border);
  width: 100%;
  box-sizing: border-box;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 12px;
}

/* 历史记录列表（从上至下排列） */
.history-list {
  display: flex;
  flex-direction: column;
}
.history-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  cursor: pointer;
  user-select: none;
  border-bottom: 1px solid var(--color-bg-page);
  transition: background 0.15s;
}
.history-item:last-child {
  border-bottom: none;
}
.history-item:active {
  background: var(--color-bg-page);
  margin: 0 -8px;
  padding-left: 8px;
  padding-right: 8px;
  border-radius: var(--radius-btn);
}
.history-icon {
  display: flex;
  flex-shrink: 0;
  opacity: 0.5;
}
.history-text {
  font-size: 14px;
  color: var(--color-text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 清空历史按钮（左下角） */
.clear-history-btn {
  display: inline-block;
  margin-top: 16px;
  padding: 6px 14px;
  font-size: 13px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-page);
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-family: inherit;
  transition: color 0.15s, background 0.15s;
}
.clear-history-btn:active {
  color: var(--color-error);
  background: var(--color-error-bg);
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

/* --- 搜索结果返回按钮行（位于筛选标签上方最左边） --- */
.search-back-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.search-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--color-primary);
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  padding: 4px 0;
}
.back-icon {
  display: block;
  flex-shrink: 0;
}

/* --- 搜索结果 --- */
.search-results {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 20px;
}
.results-header {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 12px;
}
.results-count {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}
.results-keyword {
  font-size: 13px;
  color: var(--color-primary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- 空状态 --- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  text-align: center;
}
.empty-icon { display: flex; color: var(--color-text-tertiary); margin-bottom: 12px; }
.empty-text { font-size: 15px; color: var(--color-text-secondary); margin: 0 0 6px 0; }
.empty-hint { font-size: 13px; color: var(--color-text-tertiary); margin: 0; }

/* --- 结果卡片 --- */
.result-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
}
.result-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 14px;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.15s;
}
.result-card:active { transform: scale(0.98); }
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.result-type {
  font-size: 12px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.result-date {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.result-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 6px 0;
  line-height: 1.4;
}
.result-title :deep(mark) {
  background: var(--color-warning-bg);
  color: inherit;
  padding: 0 2px;
  border-radius: var(--radius-tag);
}
.result-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0 0 10px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.result-desc :deep(mark) {
  background: var(--color-warning-bg);
  color: inherit;
  padding: 0 2px;
  border-radius: var(--radius-tag);
}
.result-meta {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #94A3B8;
}
.result-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
  gap: 4px;
  overflow: hidden;
  transition: height 0.15s;
  color: var(--color-text-tertiary);
  font-size: 13px;
}
.pull-icon { display: flex; align-items: center; }
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
