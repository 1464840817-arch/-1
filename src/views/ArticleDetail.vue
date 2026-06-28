<!-- src/views/ArticleDetail.vue -->
<!-- 文章详情页 — 含评论互动系统 -->
<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getArticle, incrementView, likeArticle, deleteArticle, shareArticle as apiShareArticle } from '../api/article.js'
import { getComments, postComment, toggleLikeComment } from '../api/comment.js'
import { searchArticles } from '../api/search.js'
import { toggleCollect as toggleCollectStore, isCollected, addHistory, currentIsAdmin } from '../store/user.js'
import { friendStore, initFriendData } from '../store/friends.js'
import { request } from '../api/client.js'

const router = useRouter()
const route = useRoute()
const articleId = computed(() => Number(route.params.id))
const fromUserDetail = computed(() => route.query.from === 'userDetail')

// ==================== 文章数据 ====================
const articleData = ref(null)

// 评论数据（必须在 loadArticle 之前声明 — loadArticle 内部引用 loadComments）
const comments = ref([])

/** 加载评论 */
const loadComments = async (id) => {
  try {
    const data = await getComments(id)
    comments.value = Array.isArray(data) ? data : []
  } catch (_) {
    comments.value = []
  }
}

const loadArticle = async (id) => {
  // 防御：id 无效时（如 NaN）直接标记为未找到
  if (id == null || Number.isNaN(id)) {
    articleData.value = null
    return
  }
  try {
    const found = await getArticle(id)
    if (found) {
      articleData.value = { ...found, isCollected: isCollected(found.id) }
      addHistory(found.id)
      incrementView(id)          // 浏览计数（fire-and-forget）
      loadComments(id)           // 加载评论
      loadRelatedArticles()      // 加载相关推荐
    } else {
      articleData.value = null
    }
  } catch {
    articleData.value = null
  }
}

loadArticle(articleId.value)
watch(articleId, (newId) => loadArticle(newId))

// ==================== 点赞文章 ====================
const toggleLike = async () => {
  if (!articleData.value) return
  // 乐观更新
  articleData.value.isLiked = !articleData.value.isLiked
  articleData.value.likes += articleData.value.isLiked ? 1 : -1
  // 异步同步到服务端
  if (articleData.value.isLiked) {
    try { await likeArticle(articleData.value.id) } catch { /* 静默 */ }
  }
}

// ==================== 收藏文章 ====================
const toggleCollect = async () => {
  if (!articleData.value) return
  const collected = await toggleCollectStore(articleData.value.id)
  articleData.value.isCollected = collected
}

// ==================== 相关推荐 ====================
const relatedArticles = ref([])
const relatedLoading = ref(false)

const loadRelatedArticles = async () => {
  if (!articleData.value) return
  const tags = articleData.value.tags || []
  if (tags.length === 0) return
  relatedLoading.value = true
  try {
    const { list } = await searchArticles({ tag: tags[0], pageSize: 6 })
    relatedArticles.value = (list || [])
      .filter(a => a.id !== articleData.value.id)
      .slice(0, 3)
  } catch {
    relatedArticles.value = []
  } finally {
    relatedLoading.value = false
  }
}

// ==================== 分享 ====================
const showShareSheet = ref(false)
const showFriendPicker = ref(false)
const shareFriendsLoading = ref(false)
const shareSendingIds = ref(new Set())
const shareError = ref('')

const openShareSheet = () => {
  showShareSheet.value = true
}

const closeShareSheet = () => {
  showShareSheet.value = false
  showFriendPicker.value = false
}

const copyLink = async () => {
  const url = window.location.href
  try {
    await navigator.clipboard.writeText(url)
    showToast('链接已复制到剪贴板')
  } catch {
    showToast(url)
  }
  closeShareSheet()
}

const openFriendPicker = async () => {
  showFriendPicker.value = true
  shareFriendsLoading.value = true
  shareError.value = ''
  shareSendingIds.value = new Set()

  await initFriendData()

  if (friendStore.list.length === 0) {
    shareError.value = '暂无好友，请先添加好友'
  }
  shareFriendsLoading.value = false
}

const sendToFriend = async (friend) => {
  if (shareSendingIds.value.has(friend.id)) return

  shareSendingIds.value = new Set([...shareSendingIds.value, friend.id])
  try {
    await apiShareArticle(articleId.value, friend.id)
    showToast(`已分享给 ${friend.name}`)
  } catch {
    showToast('分享失败，请重试')
  } finally {
    const next = new Set(shareSendingIds.value)
    next.delete(friend.id)
    shareSendingIds.value = next
  }
}

const toastText = ref('')
const toastTimer = ref(null)
const showToast = (text) => {
  toastText.value = text
  clearTimeout(toastTimer.value)
  toastTimer.value = setTimeout(() => { toastText.value = '' }, 2000)
}

/** 点击标签跳转搜索 */
const goToTagSearch = (tag) => {
  router.push(`/search?q=${encodeURIComponent(tag)}`)
}

// ==================== 评论系统交互 ====================
const newComment = ref('')
const replyingTo = ref(null)    // 当前正在回复的评论 ID
const replyText = ref('')
const commentSectionRef = ref(null)

/** 评论总数（含回复） */
const commentCount = computed(() => {
  let count = comments.value.length
  comments.value.forEach(c => {
    if (c.replies) count += c.replies.length
  })
  return count
})

/** 发表顶级评论 */
const submitComment = async () => {
  const text = newComment.value.trim()
  if (!text) return

  try {
    const created = await postComment(articleId.value, { content: text })
    if (created) {
      comments.value.unshift(created)
    } else {
      // API 返回空时乐观添加
      comments.value.unshift({
        id: Date.now(),
        articleId: articleId.value,
        author: '我',
        content: text,
        time: '刚刚',
        likes: 0,
        isLiked: false,
        replies: [],
      })
    }
    if (articleData.value) articleData.value.comments++
  } catch {
    // 乐观本地添加
    comments.value.unshift({
      id: Date.now(),
      articleId: articleId.value,
      author: '我',
      content: text,
      time: '刚刚',
      likes: 0,
      isLiked: false,
      replies: [],
    })
    if (articleData.value) articleData.value.comments++
  }

  newComment.value = ''
}

/** 开始回复某条评论 */
const startReply = (commentId) => {
  replyingTo.value = commentId
  replyText.value = ''
  nextTick(() => {
    // 聚焦回复输入框
    const el = document.querySelector(`.reply-input-row input`)
    if (el) el.focus()
  })
}

/** 取消回复 */
const cancelReply = () => {
  replyingTo.value = null
  replyText.value = ''
}

/** 提交回复 */
const submitReply = async (parentComment) => {
  const text = replyText.value.trim()
  if (!text) return

  const optimisticReply = {
    id: Date.now(),
    author: '我',
    content: text,
    time: '刚刚',
    likes: 0,
    isLiked: false,
  }

  if (!parentComment.replies) parentComment.replies = []
  parentComment.replies.push(optimisticReply)

  replyText.value = ''
  replyingTo.value = null
  if (articleData.value) articleData.value.comments++

  // 异步同步到服务端
  try {
    await postComment(articleId.value, { content: text, replyTo: parentComment.id })
  } catch { /* 静默 — 本地已添加 */ }
}

/** 点赞/取消点赞评论 */
const toggleCommentLike = async (comment) => {
  // 乐观更新
  comment.isLiked = !comment.isLiked
  comment.likes += comment.isLiked ? 1 : -1
  // 异步同步到服务端
  if (comment.isLiked) {
    try { await toggleLikeComment(comment.id) } catch { /* 静默 */ }
  }
}

/** 滚动到评论区域 */
const scrollToComments = () => {
  commentSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  nextTick(() => {
    const input = document.querySelector('.bottom-bar-input')
    if (input) input.focus()
  })
}

// ==================== 导航 ====================
const goBack = () => { router.back() }

const goToAuthor = () => {
  const data = articleData.value
  if (!data) return
  // 优先使用作者 ID 跳转到用户详情页
  if (data.authorId) {
    router.push(`/user/${data.authorId}`)
  } else {
    // 降级：通过作者名字搜索
    router.push(`/search?q=${encodeURIComponent(data.author)}`)
  }
}

/** 点击评论用户头像/名称 → 跳转到该用户详情页 */
const goToCommentAuthor = async (authorName) => {
  if (!authorName) return
  try {
    const result = await request(`/user/search?q=${encodeURIComponent(authorName)}`)
    const list = result?.list || result || []
    const match = Array.isArray(list) ? list.find(u => u.name === authorName || u.account === authorName) : null
    if (match?.id) {
      router.push(`/user/${match.id}`)
    } else {
      router.push(`/search?q=${encodeURIComponent(authorName)}`)
    }
  } catch {
    router.push(`/search?q=${encodeURIComponent(authorName)}`)
  }
}

// ==================== 管理员菜单（三点按钮） ====================
const isAdmin = computed(() => currentIsAdmin())
const showAdminMenu = ref(false)
const menuRef = ref(null)
const deleting = ref(false)

const toggleAdminMenu = () => {
  showAdminMenu.value = !showAdminMenu.value
}

const handleAdminEdit = () => {
  showAdminMenu.value = false
  router.push(`/publish?edit=${articleId.value}`)
}

const handleAdminDelete = async () => {
  showAdminMenu.value = false
  const ok = window.confirm('确定要下架这篇文章吗？下架后作者可在"已下架文章"中恢复。')
  if (!ok) return
  deleting.value = true
  try {
    await deleteArticle(articleId.value)
    router.back()
  } catch (err) {
    showToast(err.message || '下架失败，请重试')
  } finally {
    deleting.value = false
  }
}

const closeAdminMenu = (e) => {
  if (menuRef.value && !menuRef.value.contains(e.target)) {
    showAdminMenu.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', closeAdminMenu)
})

onUnmounted(() => {
  clearTimeout(toastTimer.value)
  document.removeEventListener('click', closeAdminMenu)
})
</script>

<template>
  <main class="detail-page" aria-label="文章详情">

    <!-- ==================== 顶部导航 ==================== -->
    <header class="detail-header">
      <div class="header-left" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack">
        <span class="back-icon">⬅</span>
        <span class="back-text">返回</span>
      </div>
      <span class="header-title">文章详情</span>
      <div class="header-right">
        <div v-if="isAdmin" ref="menuRef" class="admin-menu-wrapper">
          <button
            class="admin-menu-btn"
            :class="{ open: showAdminMenu }"
            aria-label="更多操作"
            :disabled="deleting"
            @click.stop="toggleAdminMenu"
          >
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </button>
          <div v-if="showAdminMenu" class="admin-dropdown">
            <button class="dropdown-item" @click="handleAdminEdit">
              <span class="dropdown-icon">✏️</span>
              <span>修改文章</span>
            </button>
            <button class="dropdown-item dropdown-item--danger" :disabled="deleting" @click="handleAdminDelete">
              <span class="dropdown-icon">🗑️</span>
              <span>{{ deleting ? '下架中...' : '下架文章' }}</span>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- ==================== 文章未找到 ==================== -->
    <main v-if="!articleData" class="detail-main">
      <div class="content-card not-found-card">
        <div class="not-found-icon">📄</div>
        <h2 class="not-found-title">文章不存在</h2>
        <p class="not-found-desc">该文章可能已被删除，或链接地址有误。</p>
        <button class="back-home-btn" @click="router.push('/home')">返回首页</button>
      </div>
    </main>

    <!-- ==================== 文章主体 ==================== -->
    <main v-else class="detail-main">
      <div class="content-card">

        <!-- 设备标签 -->
        <div class="device-tag">{{ articleData.type }}</div>

        <!-- ==================== 作者信息卡片（紧贴标题上方） ==================== -->
        <div
          class="author-card"
          :class="{ clickable: !fromUserDetail }"
          :role="fromUserDetail ? undefined : 'button'"
          :tabindex="fromUserDetail ? undefined : 0"
          @click="!fromUserDetail && goToAuthor()"
          @keydown.enter.prevent="!fromUserDetail && goToAuthor()"
          @keydown.space.prevent="!fromUserDetail && goToAuthor()"
        >
          <div class="author-avatar">{{ (articleData.author || '?')[0] }}</div>
          <div class="author-info">
            <div class="author-name-row">
              <span class="author-name">{{ articleData.author }}</span>
              <span v-if="articleData.department" class="author-dept">{{ articleData.department }}</span>
            </div>
            <p v-if="articleData.authorDesc" class="author-bio">{{ articleData.authorDesc }}</p>
            <p v-else class="author-bio placeholder">这个人很懒，什么都没写…</p>
          </div>
        </div>

        <h1 class="main-title">{{ articleData.title }}</h1>
        <div class="meta-info">
          <span class="date">{{ articleData.date }}</span>
          <span class="views-badge">👁️ {{ articleData.views }}</span>
        </div>

        <!-- 正文：故障描述 + 排查步骤 -->
        <div class="article-body">
          <div class="paragraph-group">
            <h3 class="sub-title">📋 故障描述</h3>
            <p class="text-content">{{ articleData.desc }}</p>
          </div>
          <div class="paragraph-group">
            <h3 class="sub-title">🔧 排查步骤</h3>
            <ul class="step-list">
              <li v-for="(step, index) in articleData.steps" :key="index">
                <span class="step-num">{{ index + 1 }}.</span>
                <span class="step-text">{{ step }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- ==================== 标签 ==================== -->
        <div v-if="articleData.tags && articleData.tags.length > 0" class="tags-row">
          <span
            v-for="tag in articleData.tags"
            :key="tag"
            class="tag-chip"
            role="button"
            tabindex="0"
            @click="goToTagSearch(tag)"
            @keydown.enter.prevent="goToTagSearch(tag)"
            @keydown.space.prevent="goToTagSearch(tag)"
          >{{ tag }}</span>
        </div>

        <!-- ==================== 文章内互动栏（点赞 / 评论跳转 / 收藏 / 分享） ==================== -->
        <div class="inner-actions">
          <div class="action-btn" role="button" tabindex="0" aria-label="点赞" @click="toggleLike" @keydown.enter.prevent="toggleLike" @keydown.space.prevent="toggleLike">
            <span class="icon">{{ articleData.isLiked ? '❤️' : '🤍' }}</span>
            <span class="text">{{ articleData.isLiked ? '已赞' : '点赞' }} {{ articleData.likes > 0 ? articleData.likes : '' }}</span>
          </div>
          <div class="action-btn" role="button" tabindex="0" aria-label="查看评论" @click="scrollToComments" @keydown.enter.prevent="scrollToComments" @keydown.space.prevent="scrollToComments">
            <span class="icon">💬</span>
            <span class="text">评论 {{ commentCount > 0 ? commentCount : '' }}</span>
          </div>
          <div class="action-btn" role="button" tabindex="0" aria-label="收藏" @click="toggleCollect" @keydown.enter.prevent="toggleCollect" @keydown.space.prevent="toggleCollect">
            <span class="icon">{{ articleData.isCollected ? '⭐' : '☆' }}</span>
            <span class="text">{{ articleData.isCollected ? '已收藏' : '收藏' }}</span>
          </div>
          <div class="action-btn" role="button" tabindex="0" aria-label="分享" @click="openShareSheet" @keydown.enter.prevent="openShareSheet" @keydown.space.prevent="openShareSheet">
            <span class="icon">📤</span>
            <span class="text">分享</span>
          </div>
        </div>

        <!-- ==================== 评论区域 ==================== -->
        <div ref="commentSectionRef" class="comment-section">
          <h3 class="comment-section-header">
            评论
            <span v-if="commentCount > 0" class="comment-count">({{ commentCount }})</span>
          </h3>

          <!-- 无评论 -->
          <div v-if="comments.length === 0" class="no-comments">
            <span class="no-comments-icon">💬</span>
            <p>暂无评论，来说两句吧</p>
          </div>

          <!-- 评论列表 -->
          <div v-else class="comment-list">
            <div
              v-for="comment in comments"
              :key="comment.id"
              class="comment-thread"
            >
              <!-- === 顶级评论 === -->
              <div class="comment-item">
                <div
                  class="comment-avatar clickable"
                  role="button"
                  tabindex="0"
                  :aria-label="`查看 ${comment.author} 的主页`"
                  @click.stop="goToCommentAuthor(comment.author)"
                  @keydown.enter.prevent.stop="goToCommentAuthor(comment.author)"
                  @keydown.space.prevent.stop="goToCommentAuthor(comment.author)"
                >{{ comment.author[0] }}</div>
                <div class="comment-main">
                  <div class="comment-meta">
                    <span
                      class="comment-author clickable"
                      role="button"
                      tabindex="0"
                      @click.stop="goToCommentAuthor(comment.author)"
                      @keydown.enter.prevent.stop="goToCommentAuthor(comment.author)"
                      @keydown.space.prevent.stop="goToCommentAuthor(comment.author)"
                    >{{ comment.author }}</span>
                    <span class="comment-time">{{ comment.time }}</span>
                  </div>
                  <p class="comment-text">{{ comment.content }}</p>
                  <div class="comment-actions-row">
                    <span
                      class="comment-action"
                      role="button"
                      tabindex="0"
                      @click="toggleCommentLike(comment)"
                      @keydown.enter.prevent="toggleCommentLike(comment)"
                      @keydown.space.prevent="toggleCommentLike(comment)"
                    >
                      <span>{{ comment.isLiked ? '❤️' : '🤍' }}</span>
                      <span v-if="comment.likes > 0" class="like-count">{{ comment.likes }}</span>
                    </span>
                    <span
                      class="comment-action reply-action"
                      role="button"
                      tabindex="0"
                      @click="replyingTo === comment.id ? cancelReply() : startReply(comment.id)"
                      @keydown.enter.prevent="replyingTo === comment.id ? cancelReply() : startReply(comment.id)"
                      @keydown.space.prevent="replyingTo === comment.id ? cancelReply() : startReply(comment.id)"
                    >
                      {{ replyingTo === comment.id ? '取消' : '回复' }}
                    </span>
                  </div>

                  <!-- 回复列表 -->
                  <div v-if="comment.replies && comment.replies.length > 0" class="replies-list">
                    <div
                      v-for="reply in comment.replies"
                      :key="reply.id"
                      class="reply-item"
                    >
                      <div
                        class="comment-avatar reply-avatar clickable"
                        role="button"
                        tabindex="0"
                        :aria-label="`查看 ${reply.author} 的主页`"
                        @click.stop="goToCommentAuthor(reply.author)"
                        @keydown.enter.prevent.stop="goToCommentAuthor(reply.author)"
                        @keydown.space.prevent.stop="goToCommentAuthor(reply.author)"
                      >{{ reply.author[0] }}</div>
                      <div class="comment-main">
                        <div class="comment-meta">
                          <span
                            class="comment-author clickable"
                            role="button"
                            tabindex="0"
                            @click.stop="goToCommentAuthor(reply.author)"
                            @keydown.enter.prevent.stop="goToCommentAuthor(reply.author)"
                            @keydown.space.prevent.stop="goToCommentAuthor(reply.author)"
                          >{{ reply.author }}</span>
                          <span class="comment-time">{{ reply.time }}</span>
                        </div>
                        <p class="comment-text">{{ reply.content }}</p>
                        <div class="comment-actions-row">
                          <span
                            class="comment-action"
                            role="button"
                            tabindex="0"
                            @click="toggleCommentLike(reply)"
                            @keydown.enter.prevent="toggleCommentLike(reply)"
                            @keydown.space.prevent="toggleCommentLike(reply)"
                          >
                            <span>{{ reply.isLiked ? '❤️' : '🤍' }}</span>
                            <span v-if="reply.likes > 0" class="like-count">{{ reply.likes }}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 回复输入框 -->
                  <div v-if="replyingTo === comment.id" class="reply-input-row">
                    <input
                      v-model="replyText"
                      type="text"
                      :placeholder="`回复 ${comment.author}...`"
                      class="reply-input"
                      aria-label="输入回复内容"
                      @keyup.enter="submitReply(comment)"
                    />
                    <button class="reply-send-btn" @click="submitReply(comment)">发送</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </main>

    <!-- ==================== 相关推荐 ==================== -->
    <section v-if="relatedArticles.length > 0" class="related-section">
      <h3 class="related-title">📎 相关推荐</h3>
      <div class="related-list">
        <article
          v-for="item in relatedArticles"
          :key="item.id"
          class="related-card"
          tabindex="0"
          role="button"
          :aria-label="item.title"
          @click="router.push(`/article/${item.id}`)"
          @keydown.enter.prevent="router.push(`/article/${item.id}`)"
          @keydown.space.prevent="router.push(`/article/${item.id}`)"
        >
          <div class="related-card-header">
            <span class="related-type">{{ item.type }}</span>
            <span class="related-date">{{ item.date }}</span>
          </div>
          <h4 class="related-card-title">{{ item.title }}</h4>
          <p class="related-card-desc">{{ item.desc }}</p>
          <div class="related-card-meta">
            <span>{{ item.author }}</span>
            <span class="related-stats">
              <span v-if="item.likes">❤️ {{ item.likes }}</span>
              <span>👁️ {{ item.views }}</span>
            </span>
          </div>
        </article>
      </div>
    </section>

    <!-- ==================== Toast 提示 ==================== -->
    <div v-if="toastText" class="toast-bar" role="alert">{{ toastText }}</div>

    <!-- ==================== 分享面板 ==================== -->
    <teleport to="body">
      <!-- 底部操作面板 -->
      <transition name="sheet">
        <div v-if="showShareSheet && !showFriendPicker" class="share-overlay" role="dialog" aria-modal="true" aria-label="分享方式" @click.self="closeShareSheet">
          <div class="share-sheet">
            <button class="share-sheet-item" @click="copyLink">
              <span class="share-sheet-icon">🔗</span>
              <span class="share-sheet-label">复制链接</span>
              <span class="share-sheet-desc">将文章链接复制到剪贴板</span>
            </button>
            <button class="share-sheet-item" @click="openFriendPicker">
              <span class="share-sheet-icon">👤</span>
              <span class="share-sheet-label">分享给好友</span>
              <span class="share-sheet-desc">通过站内消息发送给好友</span>
            </button>
            <button class="share-cancel-btn" @click="closeShareSheet">取消</button>
          </div>
        </div>
      </transition>

      <!-- 好友选择器 -->
      <transition name="sheet">
        <div v-if="showFriendPicker" class="friend-picker-overlay" role="dialog" aria-modal="true" aria-label="选择好友" @click.self="closeShareSheet">
          <div class="friend-picker-panel">
            <header class="friend-picker-header">
              <span class="friend-picker-title">选择好友</span>
              <button class="friend-picker-close" @click="closeShareSheet" aria-label="关闭">✕</button>
            </header>

            <!-- 加载态 -->
            <div v-if="shareFriendsLoading" class="friend-picker-status">
              <span class="loading-spinner"></span>
              <p>加载好友列表…</p>
            </div>

            <!-- 错误态 -->
            <div v-else-if="shareError" class="friend-picker-status">
              <span class="status-icon">😕</span>
              <p class="status-text">{{ shareError }}</p>
            </div>

            <!-- 好友列表 -->
            <div v-else class="friend-picker-list">
              <div
                v-for="friend in friendStore.list"
                :key="friend.id"
                class="friend-picker-card"
              >
                <div class="fp-avatar" :class="friend.role">{{ friend.name[0] }}</div>
                <div class="fp-info">
                  <div class="fp-name-line">
                    <span class="fp-name">{{ friend.name }}</span>
                    <span class="fp-role">{{ friend.role }}</span>
                  </div>
                  <span class="fp-meta">{{ friend.department || '未分配部门' }} · {{ friend.account }}</span>
                </div>
                <button
                  class="fp-send-btn"
                  :class="{ sent: shareSendingIds.has(friend.id) }"
                  :disabled="shareSendingIds.has(friend.id)"
                  @click="sendToFriend(friend)"
                >
                  {{ shareSendingIds.has(friend.id) ? '...' : '发送' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- ==================== 底部评论输入栏 ==================== -->
    <div v-if="articleData" class="bottom-action-bar">
      <div class="comment-input-wrapper">
        <input
          v-model="newComment"
          type="text"
          placeholder="写下你的见解..."
          class="comment-input bottom-bar-input"
          aria-label="输入评论内容"
          @keyup.enter="submitComment"
        />
      </div>
      <div class="action-icons">
        <div class="icon-btn" role="button" tabindex="0" aria-label="点赞" @click="toggleLike" @keydown.enter.prevent="toggleLike" @keydown.space.prevent="toggleLike">
          <span>{{ articleData.isLiked ? '❤️' : '🤍' }}</span>
        </div>
        <div class="icon-btn" role="button" tabindex="0" aria-label="收藏" @click="toggleCollect" @keydown.enter.prevent="toggleCollect" @keydown.space.prevent="toggleCollect">
          <span>{{ articleData.isCollected ? '⭐' : '☆' }}</span>
        </div>
      </div>
    </div>

  </main>
</template>

<style scoped>
/* ==================== 页面容器 ==================== */
.detail-page {
  min-height: 100vh;
  background-color: var(--color-bg-card);
  display: flex;
  flex-direction: column;
  padding-bottom: 65px;
}

/* ==================== 顶部导航 ==================== */
.detail-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-bg-card);
  padding: 15px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-divider);
  box-sizing: border-box;
}
.header-left {
  display: flex;
  align-items: center;
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
}
.back-icon { font-size: 18px; margin-right: 4px; }
.header-title { font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 48px;
}

/* ==================== 内容区 ==================== */
.detail-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.content-card {
  background: var(--color-bg-card);
  padding: 20px 16px 40px 16px;
  flex: 1;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}

/* 设备标签 */
.device-tag {
  display: inline-block;
  background: var(--color-primary-light);
  color: var(--color-primary);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 12px;
}
.main-title {
  font-size: 22px;
  font-weight: bold;
  color: var(--color-text-primary);
  margin: 0 0 12px 0;
  line-height: 1.4;
}
.meta-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  color: var(--color-text-tertiary);
  margin-bottom: 24px;
}
.views-badge {
  font-size: 12px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

/* 正文 */
.article-body { margin-bottom: 20px; }
.paragraph-group { margin-bottom: 24px; }
.sub-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 10px;
}
.text-content {
  font-size: 15px;
  line-height: 1.8;
  color: var(--color-text-body);
}
.step-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.step-list li {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-text-body);
}
.step-num {
  color: var(--color-primary);
  font-weight: 600;
  margin-right: 8px;
  min-width: 20px;
}

/* ==================== 评论区域 ==================== */
.comment-section {
  padding-top: 0;
  margin-bottom: 20px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}
.comment-section-header {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 16px;
}
.comment-count {
  font-weight: 400;
  color: var(--color-text-tertiary);
  font-size: 14px;
}

/* 无评论 */
.no-comments {
  text-align: center;
  padding: 30px 0;
  color: var(--color-text-tertiary);
}
.no-comments-icon { font-size: 32px; display: block; margin-bottom: 8px; }
.no-comments p { font-size: 14px; margin: 0; }

/* 评论列表 */
.comment-list {
  display: flex;
  flex-direction: column;
}
.comment-thread {
  border-bottom: 1px solid var(--color-divider);
  padding-bottom: 2px;
}

/* 单条评论 */
.comment-item {
  display: flex;
  gap: 10px;
  padding: 12px 0;
}
.comment-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--color-primary-light);
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}
.comment-avatar.clickable {
  cursor: pointer;
  transition: transform 0.15s;
}
.comment-avatar.clickable:hover,
.comment-avatar.clickable:active {
  transform: scale(1.1);
}
.comment-main {
  flex: 1;
  min-width: 0;
}
.comment-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.comment-author {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-body);
}
.comment-author.clickable {
  color: var(--color-primary);
  cursor: pointer;
  transition: opacity 0.15s;
}
.comment-author.clickable:hover,
.comment-author.clickable:active {
  opacity: 0.8;
  text-decoration: underline;
}
.comment-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.comment-text {
  font-size: 14px;
  color: var(--color-text-body);
  line-height: 1.6;
  margin: 0 0 8px 0;
}
.comment-actions-row {
  display: flex;
  gap: 16px;
}
.comment-action {
  font-size: 12px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  user-select: none;
}
.comment-action:active { color: var(--color-primary); }
.like-count { font-size: 11px; }
.reply-action { color: var(--color-primary); font-weight: 500; }

/* 回复列表 */
.replies-list {
  margin-top: 10px;
  padding-left: 16px;
  border-left: 2px solid var(--color-border);
  border-radius: 0 0 0 4px;
}
.reply-item {
  display: flex;
  gap: 10px;
  padding: 8px 0;
}
.reply-avatar {
  width: 28px;
  height: 28px;
  font-size: 12px;
}

/* 回复输入框 */
.reply-input-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  align-items: center;
}
.reply-input {
  flex: 1;
  border: none;
  background: var(--color-divider);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  outline: none;
  font-family: inherit;
  transition: background 0.2s;
}
.reply-input:focus { background: var(--color-divider); }
.reply-send-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  font-family: inherit;
}
.reply-send-btn:active { opacity: 0.8; }

/* ==================== 文章内互动栏 ==================== */
.inner-actions {
  display: flex;
  gap: 24px;
  padding: 16px 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 20px;
}
.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}
.action-btn .icon { font-size: 16px; }
.action-btn:active { color: var(--color-primary); }

/* ==================== 标签 ==================== */
.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.tag-chip {
  display: inline-block;
  padding: 4px 12px;
  font-size: 13px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  border-radius: 14px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}
.tag-chip:active {
  background: var(--color-primary);
  color: #fff;
}

/* ==================== 作者信息卡片 ==================== */
.author-card {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: var(--color-bg-page);
  border-radius: 12px;
  margin-bottom: 16px;
  align-items: flex-start;
  transition: background 0.15s;
}
.author-card.clickable {
  cursor: pointer;
}
.author-card.clickable:hover,
.author-card.clickable:active {
  background: var(--color-divider);
}
.author-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), #5b8def);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
}
.author-info {
  flex: 1;
  min-width: 0;
}
.author-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.author-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.author-dept {
  font-size: 11px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}
.author-bio {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.author-bio.placeholder {
  color: var(--color-text-tertiary);
  font-style: italic;
}

/* ==================== 相关推荐 ==================== */
.related-section {
  padding: 20px 16px 0 16px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}
.related-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 12px 0;
}
.related-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.related-card {
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  cursor: pointer;
  transition: background 0.15s;
}
.related-card:active {
  background: var(--color-bg-page);
}
.related-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.related-type {
  font-size: 11px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.related-date {
  font-size: 11px;
  color: var(--color-text-tertiary);
}
.related-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 6px 0;
  line-height: 1.4;
}
.related-card-desc {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0 0 8px 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.related-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.related-stats {
  display: flex;
  gap: 10px;
}

/* ==================== Toast ==================== */
.toast-bar {
  position: fixed;
  bottom: 90px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.78);
  color: #fff;
  font-size: 14px;
  padding: 10px 24px;
  border-radius: 24px;
  z-index: 300;
  pointer-events: none;
  white-space: nowrap;
  animation: toast-in 0.25s ease;
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(8px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* ==================== 底部评论栏 ==================== */
.bottom-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-border);
  padding: 10px 16px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 200;
  box-sizing: border-box;
}
.comment-input-wrapper {
  flex: 1;
  background: var(--color-divider);
  border-radius: 20px;
  padding: 6px 16px;
}
.comment-input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  padding: 6px 0;
  font-family: inherit;
}
.comment-input::placeholder { color: var(--color-text-tertiary); }
.action-icons {
  display: flex;
  gap: 16px;
  align-items: center;
}
.icon-btn {
  font-size: 20px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 4px;
  user-select: none;
}
.icon-btn:active { color: var(--color-primary); }

/* ==================== 未找到文章 ==================== */
.not-found-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding-top: 80px;
}
.not-found-icon { font-size: 64px; margin-bottom: 16px; }
.not-found-title { font-size: 20px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 8px; }
.not-found-desc { font-size: 14px; color: var(--color-text-tertiary); margin-bottom: 24px; }
.back-home-btn {
  background: var(--color-primary); color: #fff; border: none;
  padding: 10px 32px; border-radius: 8px; font-size: 15px; cursor: pointer;
  font-family: inherit;
}
.back-home-btn:active { opacity: 0.8; }

/* ==================== 管理员三点菜单 ==================== */
.admin-menu-wrapper {
  position: relative;
}
.admin-menu-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.15s;
}
.admin-menu-btn:hover,
.admin-menu-btn:active,
.admin-menu-btn.open {
  background: var(--color-bg-page);
}
.admin-menu-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.admin-menu-btn .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-text-primary);
  flex-shrink: 0;
}

/* 下拉菜单 */
.admin-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 140px;
  background: var(--color-bg-card);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
  overflow: hidden;
  z-index: 300;
  animation: dropdown-in 0.15s ease;
}
@keyframes dropdown-in {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 11px 16px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-family: inherit;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
}
.dropdown-item:hover,
.dropdown-item:active {
  background: var(--color-bg-page);
}
.dropdown-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dropdown-item--danger {
  color: #e53e3e;
}
.dropdown-item--danger:hover,
.dropdown-item--danger:active {
  background: #fff5f5;
}
.dropdown-icon {
  font-size: 15px;
  flex-shrink: 0;
}

/* ==================== 分享面板 ==================== */
.share-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.share-sheet {
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
.share-sheet-item {
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
  border-radius: 10px;
  transition: background 0.15s;
}
.share-sheet-item:hover,
.share-sheet-item:active {
  background: var(--color-bg-page);
}
.share-sheet-item + .share-sheet-item {
  border-top: 1px solid var(--color-divider);
}
.share-sheet-icon {
  font-size: 28px;
  flex-shrink: 0;
  width: 44px;
  text-align: center;
}
.share-sheet-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  flex-shrink: 0;
}
.share-sheet-desc {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-left: auto;
}
.share-cancel-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: var(--color-divider);
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}
.share-cancel-btn:hover {
  background: var(--color-border);
}

/* ==================== 好友选择器 ==================== */
.friend-picker-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.friend-picker-panel {
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  background: var(--color-bg-card);
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  animation: sheet-up 0.25s ease;
}
.friend-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-divider);
  flex-shrink: 0;
}
.friend-picker-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.friend-picker-close {
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: var(--color-text-tertiary);
  padding: 4px 8px;
  border-radius: 4px;
}
.friend-picker-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
  color: var(--color-text-secondary);
  font-size: 14px;
}
.friend-picker-status .loading-spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.friend-picker-status .status-icon {
  font-size: 40px;
}
.friend-picker-status .status-text {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}
.friend-picker-list {
  overflow-y: auto;
  padding: 8px 16px 28px;
  flex: 1;
}
.friend-picker-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-divider);
}
.friend-picker-card:last-child {
  border-bottom: none;
}
.fp-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}
.fp-avatar[class*="一线"] { background: var(--color-primary); }
.fp-avatar[class*="管理员"]:not([class*="超级"]) { background: #f59e0b; }
.fp-avatar[class*="系统部署"] { background: #7c3aed; }
.fp-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.fp-name-line {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fp-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.fp-role {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--color-divider);
  color: var(--color-text-tertiary);
}
.fp-meta {
  font-size: 12px;
  color: var(--color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fp-send-btn {
  flex-shrink: 0;
  padding: 6px 16px;
  border-radius: 16px;
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}
.fp-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.fp-send-btn.sent {
  background: var(--color-success);
}

/* 页面过渡 */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.25s ease;
}
.sheet-enter-active .share-sheet,
.sheet-enter-active .friend-picker-panel,
.sheet-leave-active .share-sheet,
.sheet-leave-active .friend-picker-panel {
  transition: transform 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .share-sheet,
.sheet-enter-from .friend-picker-panel {
  transform: translateY(100%);
}
.sheet-leave-to .share-sheet,
.sheet-leave-to .friend-picker-panel {
  transform: translateY(100%);
}
</style>
