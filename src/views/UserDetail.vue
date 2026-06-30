<!-- src/views/UserDetail.vue -->
<!-- 用户详情页 — 好友资料 + 已发布文章 + 私聊/好友操作 -->
<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getUserProfile, getUserPosts } from '../api/user.js'
import { friendStore, isFriend, addToFriends, acceptFriendRequest, removeFromFriends, initFriendData, loadFriendRequests } from '../store/friends.js'
import { userStore } from '../store/user.js'
import { PhArrowLeft, PhChatCircle, PhDotsThree, PhNotePencil, PhHeart, PhEye, PhUserPlus, PhUserMinus, PhTrash, PhCheckCircle, PhSmileySad } from '@phosphor-icons/vue'
import { formatDateTime } from '../utils/date.js'

const router = useRouter()
const route = useRoute()
const userId = computed(() => Number(route.params.id))

// ==================== 用户资料 ====================
const profile = ref(null)
const profileLoading = ref(true)
const profileError = ref('')

const loadProfile = async () => {
  profileLoading.value = true
  profileError.value = ''
  try {
    profile.value = await getUserProfile(userId.value)
  } catch (err) {
    profile.value = null
    profileError.value = err.status === 404 ? '用户不存在' : (err.message || '加载失败')
  } finally {
    profileLoading.value = false
  }
}

// ==================== 用户文章 ====================
const articles = ref([])
const articlesLoading = ref(false)
const articlesTotal = ref(0)
const articlesError = ref('')

const loadArticles = async () => {
  articlesLoading.value = true
  articlesError.value = ''
  try {
    const data = await getUserPosts(userId.value)
    articles.value = (data.list || []).sort((a, b) => new Date(b.date) - new Date(a.date))
    articlesTotal.value = data.total || 0
  } catch {
    articles.value = []
    articlesError.value = '加载文章失败'
  } finally {
    articlesLoading.value = false
  }
}

// ==================== 好友状态 ====================
const isCurrentFriend = computed(() => isFriend(userId.value))

/** 当前用户是否已向我发送好友请求（待处理） */
const hasPendingRequest = computed(() => {
  return friendStore.requests.some(r => r.senderId === userId.value)
})

const isSelf = computed(() => {
  return userId.value === userStore.id || (profile.value && profile.value.account === userStore.account)
})

// ==================== 好友操作 ====================
const friendActionLoading = ref(false)

const handleAddFriend = async () => {
  if (!profile.value || friendActionLoading.value) return
  friendActionLoading.value = true
  try {
    // 如果对方已发送好友请求，直接同意
    if (hasPendingRequest.value) {
      await acceptFriendRequest(userId.value)
      showToast('已同意好友申请')
    } else {
      await addToFriends({
        id: profile.value.id,
        name: profile.value.name,
        account: profile.value.account,
        role: profile.value.role,
        department: profile.value.department,
        isOnline: false,
      })
      showToast('已添加好友')
    }
  } catch {
    showToast('操作失败')
  } finally {
    friendActionLoading.value = false
  }
}

const handleRemoveFriend = async () => {
  if (!profile.value || friendActionLoading.value) return
  friendActionLoading.value = true
  try {
    await removeFromFriends(userId.value)
    showToast('已删除好友')
  } catch {
    showToast('删除失败')
  } finally {
    friendActionLoading.value = false
  }
}

// ==================== 私聊 ====================
const goToChat = () => {
  router.push(`/chat/${userId.value}`)
}

// ==================== Toast ====================
const toastText = ref('')
let toastTimer = null
const showToast = (text) => {
  toastText.value = text
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastText.value = '' }, 2000)
}

// ==================== 导航 ====================
const goBack = () => { router.back() }

const goToArticle = (id) => {
  router.push(`/article/${id}?from=userDetail`)
}

// ==================== 生命周期 ====================
onMounted(async () => {
  await initFriendData()
  loadFriendRequests()
  loadProfile()
  loadArticles()
})

onUnmounted(() => {
  clearTimeout(toastTimer)
})
</script>

<template>
  <main class="user-detail-page" aria-label="用户详情">

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
      ><PhArrowLeft :size="15" /> 返回</span>
      <span class="title">用户详情</span>
      <span class="header-spacer"></span>
    </header>

    <!-- ==================== 加载态 ==================== -->
    <div v-if="profileLoading" class="loading-state">
      <span class="loading-spinner"></span>
      <p class="loading-text">加载中...</p>
    </div>

    <!-- ==================== 错误态 ==================== -->
    <div v-else-if="profileError" class="error-state">
      <span class="error-icon"><PhSmileySad :size="48" /></span>
      <p class="error-text">{{ profileError }}</p>
      <button class="retry-btn" @click="loadProfile">重试</button>
    </div>

    <!-- ==================== 主体内容 ==================== -->
    <template v-else-if="profile">
      <div class="detail-body">

        <!-- ========== 资料卡片 ========== -->
        <div class="profile-card">
          <div class="profile-main">
            <img v-if="profile.avatar" :src="profile.avatar" class="profile-avatar-img" alt="头像" />
            <div v-else class="profile-avatar">{{ profile.name[0] }}</div>
            <div class="profile-info">
              <div class="profile-name-row">
                <span class="profile-name">{{ profile.name }}</span>
                <span class="profile-role">{{ profile.role }}</span>
              </div>
              <span class="profile-meta">{{ profile.department || '未分配部门' }} &middot; {{ profile.account }}</span>
              <p class="profile-desc">{{ profile.desc || '这个人很懒，什么都没写…' }}</p>
            </div>
          </div>

          <!-- 操作按钮（非本人） -->
          <div v-if="!isSelf" class="profile-actions">
            <button v-if="isCurrentFriend && route.query.from !== 'chat'" class="action-btn chat-btn" @click="goToChat">
              <PhChatCircle :size="16" /> 私聊
            </button>
            <button
              v-if="isCurrentFriend"
              class="action-btn unfriend-btn"
              :disabled="friendActionLoading"
              @click="handleRemoveFriend"
            >
              <template v-if="friendActionLoading">…</template>
              <template v-else><PhTrash :size="14" /> 删除好友</template>
            </button>
            <button
              v-else
              class="action-btn add-friend-btn"
              :class="{ 'accept-request-btn': hasPendingRequest }"
              :disabled="friendActionLoading"
              @click="handleAddFriend"
            >
              <template v-if="friendActionLoading">…</template>
              <template v-else-if="hasPendingRequest"><PhCheckCircle :size="14" /> 同意好友申请</template>
              <template v-else><PhUserPlus :size="14" /> 添加好友</template>
            </button>
          </div>
        </div>

        <!-- ========== 已发布文章 ========== -->
        <section class="articles-section">
          <h3 class="section-title">已发布文章 ({{ articlesTotal }})</h3>

          <!-- 加载中 -->
          <div v-if="articlesLoading" class="loading-inline">
            <span class="loading-spinner small"></span>
            <span>加载文章…</span>
          </div>

          <!-- 加载失败 -->
          <div v-else-if="articlesError" class="error-inline">
            <span>{{ articlesError }}</span>
            <button class="retry-inline" @click="loadArticles">重试</button>
          </div>

          <!-- 空状态 -->
          <div v-else-if="articles.length === 0" class="empty-articles">
            <span class="empty-icon"><PhNotePencil :size="40" /></span>
            <p>暂无已发布文章</p>
          </div>

          <!-- 文章列表 -->
          <div v-else class="articles-list">
            <article
              v-for="item in articles"
              :key="item.id"
              class="article-card"
              role="button"
              tabindex="0"
              :aria-label="item.title"
              @click="goToArticle(item.id)"
              @keydown.enter.prevent="goToArticle(item.id)"
              @keydown.space.prevent="goToArticle(item.id)"
            >
              <div class="article-card-top">
                <span class="article-type">{{ item.type }}</span>
                <span class="article-date">{{ formatDateTime(item.date) }}</span>
              </div>
              <h4 class="article-title">{{ item.title }}</h4>
              <p class="article-desc">{{ item.desc }}</p>
              <div class="article-stats">
                <span v-if="item.likes"><PhHeart :size="20" weight="fill" /> {{ item.likes }}</span>
                <span><PhChatCircle :size="20" /> {{ item.comments }}</span>
                <span><PhEye :size="20" /> {{ item.views }}</span>
              </div>
            </article>
          </div>
        </section>

      </div>
    </template>

    <!-- ==================== Toast ==================== -->
    <div v-if="toastText" class="toast-bar" role="alert">{{ toastText }}</div>

  </main>
</template>

<style scoped>
/* ==================== 页面容器 ==================== */
.user-detail-page {
  min-height: var(--app-height, 100dvh);
  background: var(--color-bg-page);
  padding-bottom: 40px;
}

/* ==================== 顶部导航 ==================== */
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
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.header-spacer {
  width: 48px;
}

/* ==================== 加载/错误态 ==================== */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 20px;
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
@keyframes spin { to { transform: rotate(360deg); } }
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
}
.error-icon { display: flex; justify-content: center; color: var(--color-text-tertiary); margin-bottom: 12px; }
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

/* ==================== 主体 ==================== */
.detail-body {
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
  padding: 0 16px;
}

/* ==================== 资料卡片 ==================== */
.profile-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 20px;
  margin-top: 16px;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border);
}
.profile-main {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.profile-avatar {
  width: 56px; height: 56px;
  border-radius: 50%;
  background: #E2E8F0;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.profile-avatar-img {
  width: 56px; height: 56px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}
.profile-info {
  flex: 1;
  min-width: 0;
}
.profile-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.profile-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.profile-role {
  font-size: 11px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: var(--radius-card);
  font-weight: 500;
}
.profile-meta {
  font-size: 13px;
  color: var(--color-text-tertiary);
  display: block;
  margin-bottom: 6px;
}
.profile-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0;
}

/* 操作按钮 */
.profile-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--color-divider);
}
.action-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: var(--radius-btn);
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.chat-btn {
  background: var(--color-primary);
  color: #fff;
}
.chat-btn:active:not(:disabled) {
  opacity: 0.85;
}
.add-friend-btn {
  background: var(--color-primary-light);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}
.add-friend-btn:active:not(:disabled) {
  background: var(--color-primary);
  color: #fff;
}
.accept-request-btn {
  background: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success);
}
.accept-request-btn:active:not(:disabled) {
  background: var(--color-success);
  color: #fff;
}
.unfriend-btn {
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}
.unfriend-btn:active:not(:disabled) {
  border-color: var(--color-error);
  color: var(--color-error);
  background: #fef2f2;
}

/* ==================== 文章区域 ==================== */
.articles-section {
  margin-top: 24px;
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 12px 0;
}

/* 内联加载 */
.loading-inline {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 32px 0;
  justify-content: center;
  font-size: 14px;
  color: var(--color-text-tertiary);
}

/* 内联错误 */
.error-inline {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 0;
  justify-content: center;
  font-size: 14px;
  color: var(--color-text-secondary);
}
.retry-inline {
  border: none;
  background: var(--color-primary-light);
  color: var(--color-primary);
  padding: 4px 12px;
  border-radius: var(--radius-btn);
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}

/* 空文章 */
.empty-articles {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 20px;
  color: var(--color-text-tertiary);
}
.empty-icon { display: flex; justify-content: center; color: var(--color-text-tertiary); margin-bottom: 8px; }
.empty-articles p { font-size: 14px; margin: 0; }

/* 文章列表 */
.articles-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.article-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: background 0.15s;
}
.article-card:active {
  background: var(--color-bg-page);
}
.article-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.article-type {
  font-size: 11px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}
.article-date {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
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
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.article-stats {
  display: flex;
  gap: 12px;
  font-size: 14px;
  color: #64748B;
  align-items: center;
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
</style>
