<!-- src/views/FriendManage.vue -->
<!-- 好友管理 — 管理员列表 / 添加好友 / 删除好友 三个功能模块 -->
<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { friendStore, initFriendData, isFriend, addToFriends, removeFromFriends } from '../store/friends.js'
import { getAdminList, searchUsers } from '../api/friend.js'

const router = useRouter()
const toast = inject('showToast', null)

// ==================== 视图切换 ====================
const currentView = ref('menu') // 'menu' | 'admin' | 'add' | 'remove'

const goToView = (view) => {
  currentView.value = view
  // 重置各子视图状态
  if (view === 'add') {
    searchKeyword.value = ''
    searchResults.value = []
    hasSearched.value = false
  }
}

const goBack = () => {
  if (currentView.value !== 'menu') {
    currentView.value = 'menu'
  } else {
    router.back()
  }
}

// 子视图标题
const viewTitle = computed(() => {
  switch (currentView.value) {
    case 'admin': return '管理员列表'
    case 'add': return '添加好友'
    case 'remove': return '删除好友'
    default: return '好友管理'
  }
})

// ==================== 1. 管理员列表 ====================
const admins = ref([])
const adminsLoading = ref(false)

const loadAdmins = async () => {
  adminsLoading.value = true
  try {
    const data = await getAdminList()
    admins.value = Array.isArray(data) ? data : []
  } catch {
    admins.value = []
  } finally {
    adminsLoading.value = false
  }
}

/** 联系管理员 */
const contactAdmin = (admin) => {
  toast?.(`已复制 ${admin.name} 的工号：${admin.account}`, 'success')
}

// ==================== 2. 添加好友 ====================
const searchKeyword = ref('')
const searchResults = ref([])
const hasSearched = ref(false)
const searching = ref(false)
const addingIds = ref(new Set()) // 正在添加中的用户 ID

/** 搜索用户 */
const handleSearch = async () => {
  const kw = searchKeyword.value.trim()
  if (!kw) return

  searching.value = true
  hasSearched.value = true

  try {
    const data = await searchUsers(kw)
    searchResults.value = Array.isArray(data) ? data : []
  } catch {
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

/** 搜索框回车 */
const onSearchKeyup = (e) => {
  if (e.key === 'Enter') handleSearch()
}

/** 添加好友 */
const handleAddFriend = async (user) => {
  if (isFriend(user.id)) {
    toast?.('已经是好友了', 'success')
    return
  }
  if (addingIds.value.has(user.id)) return

  addingIds.value = new Set([...addingIds.value, user.id])
  const ok = await addToFriends(user)
  addingIds.value = new Set([...addingIds.value].filter(id => id !== user.id))

  if (ok) {
    toast?.('添加成功！', 'success')
  } else {
    toast?.('已是好友', 'success')
  }
}

// 搜索结果中已添加的好友 ID 集合
const resultFriendIds = computed(() => {
  return new Set(friendStore.list.map(f => f.id))
})

// ==================== 3. 删除好友 ====================
const deleteConfirmId = ref(null) // 当前确认删除的好友 ID

/** 点击删除按钮 — 第一击进入确认态，第二击执行删除 */
const requestDelete = (friendId) => {
  if (deleteConfirmId.value === friendId) {
    // 二次确认通过，执行删除
    removeFromFriends(friendId)
    toast?.('已删除好友', 'success')
    deleteConfirmId.value = null
  } else {
    deleteConfirmId.value = friendId
    // 3 秒后自动取消确认态
    setTimeout(() => {
      if (deleteConfirmId.value === friendId) {
        deleteConfirmId.value = null
      }
    }, 3000)
  }
}

/** 取消删除确认 */
const cancelDelete = () => {
  deleteConfirmId.value = null
}

// ==================== 初始化 ====================
onMounted(() => {
  initFriendData()
})
</script>

<template>
  <main class="friend-page" aria-label="好友管理">

    <!-- ==================== 顶部导航 ==================== -->
    <header class="page-header">
      <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack">
        {{ currentView !== 'menu' ? '← 返回' : '⬅ 返回' }}
      </span>
      <span class="title">{{ viewTitle }}</span>
      <div class="header-placeholder"></div>
    </header>

    <!-- ====================================================================== -->
    <!-- 菜单主页 -->
    <!-- ====================================================================== -->
    <template v-if="currentView === 'menu'">
      <div class="menu-container">
        <!-- 管理员管理 -->
        <div class="menu-card" role="button" tabindex="0" @click="goToView('admin'); loadAdmins()" @keydown.enter.prevent="goToView('admin'); loadAdmins()" @keydown.space.prevent="goToView('admin'); loadAdmins()">
          <div class="menu-left">
            <span class="menu-icon-box menu-icon--purple">🛡️</span>
            <div class="menu-info">
              <span class="menu-label">管理员管理</span>
              <span class="menu-sub">查看与联系平台管理员</span>
            </div>
          </div>
          <span class="menu-arrow">›</span>
        </div>

        <!-- 添加好友 -->
        <div class="menu-card" role="button" tabindex="0" @click="goToView('add')" @keydown.enter.prevent="goToView('add')" @keydown.space.prevent="goToView('add')">
          <div class="menu-left">
            <span class="menu-icon-box menu-icon--blue">➕</span>
            <div class="menu-info">
              <span class="menu-label">添加好友</span>
              <span class="menu-sub">输入工号或姓名搜索添加</span>
            </div>
          </div>
          <span class="menu-arrow">›</span>
        </div>

        <!-- 删除好友 -->
        <div class="menu-card" role="button" tabindex="0" @click="goToView('remove')" @keydown.enter.prevent="goToView('remove')" @keydown.space.prevent="goToView('remove')">
          <div class="menu-left">
            <span class="menu-icon-box menu-icon--red">👥</span>
            <div class="menu-info">
              <span class="menu-label">删除好友</span>
              <span class="menu-sub">管理已添加的好友列表</span>
            </div>
          </div>
          <div class="menu-right">
            <span v-if="friendStore.list.length > 0" class="friend-count">{{ friendStore.list.length }}人</span>
            <span class="menu-arrow">›</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ====================================================================== -->
    <!-- 1. 管理员列表 -->
    <!-- ====================================================================== -->
    <template v-if="currentView === 'admin'">
      <!-- 加载态 -->
      <div v-if="adminsLoading" class="loading-state">
        <span class="loading-spinner"></span>
        <p class="loading-text">加载中...</p>
      </div>

      <!-- 管理员列表 -->
      <div v-else class="user-list">
        <div
          v-for="admin in admins"
          :key="admin.id"
          class="user-card"
          role="button"
          tabindex="0"
          @click="contactAdmin(admin)"
          @keydown.enter.prevent="contactAdmin(admin)"
          @keydown.space.prevent="contactAdmin(admin)"
        >
          <div class="user-avatar" :class="{ online: admin.isOnline }">
            {{ admin.name[0] }}
            <span v-if="admin.isOnline" class="online-dot"></span>
          </div>
          <div class="user-info">
            <div class="user-name-line">
              <span class="user-name">{{ admin.name }}</span>
              <span class="user-role">{{ admin.role }}</span>
            </div>
            <span class="user-meta">{{ admin.department }} · {{ admin.account }}</span>
            <span v-if="admin.phone" class="user-phone">{{ admin.phone }}</span>
          </div>
          <span class="contact-hint" role="button" tabindex="0" aria-label="联系管理员" @click.stop="contactAdmin(admin)" @keydown.enter.prevent.stop="contactAdmin(admin)" @keydown.space.prevent.stop="contactAdmin(admin)">联系</span>
        </div>
      </div>
    </template>

    <!-- ====================================================================== -->
    <!-- 2. 添加好友 -->
    <!-- ====================================================================== -->
    <template v-if="currentView === 'add'">
      <!-- 搜索栏 -->
      <div class="search-bar">
        <div class="search-input-wrap">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchKeyword"
            type="text"
            class="search-input"
            aria-label="搜索用户"
            placeholder="输入工号、姓名或部门搜索"
            @keyup="onSearchKeyup"
          />
          <span
            v-if="searchKeyword"
            class="search-clear"
            role="button"
            tabindex="0"
            aria-label="清除搜索"
            @click="searchKeyword = ''; searchResults = []; hasSearched = false"
            @keydown.enter.prevent="searchKeyword = ''; searchResults = []; hasSearched = false"
            @keydown.space.prevent="searchKeyword = ''; searchResults = []; hasSearched = false"
          >✕</span>
        </div>
        <button class="search-btn" :disabled="!searchKeyword.trim() || searching" @click="handleSearch">
          {{ searching ? '搜索中' : '搜索' }}
        </button>
      </div>

      <!-- 搜索结果 -->
      <div v-if="hasSearched" class="user-list">
        <!-- 搜索中 -->
        <div v-if="searching" class="loading-state">
          <span class="loading-spinner"></span>
          <p class="loading-text">搜索中...</p>
        </div>

        <!-- 空结果 -->
        <div v-else-if="searchResults.length === 0" class="empty-inline">
          <span class="empty-inline-icon">🔍</span>
          <p class="empty-inline-text">未找到匹配的用户</p>
          <p class="empty-inline-hint">试试换一个关键词</p>
        </div>

        <!-- 结果列表 -->
        <div
          v-for="user in searchResults"
          :key="user.id"
          class="user-card"
        >
          <div class="user-avatar" :class="{ online: user.isOnline }">
            {{ user.name[0] }}
            <span v-if="user.isOnline" class="online-dot"></span>
          </div>
          <div class="user-info">
            <div class="user-name-line">
              <span class="user-name">{{ user.name }}</span>
              <span class="user-role">{{ user.role }}</span>
            </div>
            <span class="user-meta">{{ user.department }} · {{ user.account }}</span>
          </div>
          <button
            v-if="resultFriendIds.has(user.id)"
            class="add-btn added"
            disabled
          >已添加</button>
          <button
            v-else
            class="add-btn"
            :disabled="addingIds.has(user.id)"
            @click="handleAddFriend(user)"
          >
            {{ addingIds.has(user.id) ? '…' : '添加' }}
          </button>
        </div>
      </div>

      <!-- 未搜索时的引导 -->
      <div v-else class="search-guide">
        <span class="guide-icon">👥</span>
        <p class="guide-text">输入同事的工号、姓名或部门</p>
        <p class="guide-hint">找到后点击"添加"即可成为好友</p>
      </div>
    </template>

    <!-- ====================================================================== -->
    <!-- 3. 删除好友 -->
    <!-- ====================================================================== -->
    <template v-if="currentView === 'remove'">
      <!-- 空状态 -->
      <div v-if="friendStore.list.length === 0" class="empty-full">
        <span class="empty-full-icon">👥</span>
        <p class="empty-full-text">暂无好友</p>
        <p class="empty-full-hint">去"添加好友"里搜索并添加同事吧</p>
        <button class="go-add-btn" @click="goToView('add')">去添加好友</button>
      </div>

      <!-- 好友列表 -->
      <div v-else class="user-list">
        <div class="list-header">
          <span class="list-header-text">共 {{ friendStore.list.length }} 位好友</span>
          <span
            v-if="deleteConfirmId"
            class="cancel-confirm-btn"
            @click="cancelDelete"
          >取消删除</span>
        </div>

        <div
          v-for="friend in friendStore.list"
          :key="friend.id"
          class="user-card"
          :class="{ 'confirm-delete': deleteConfirmId === friend.id }"
        >
          <div class="user-avatar" :class="{ online: friend.isOnline }">
            {{ friend.name[0] }}
            <span v-if="friend.isOnline" class="online-dot"></span>
          </div>
          <div class="user-info">
            <div class="user-name-line">
              <span class="user-name">{{ friend.name }}</span>
              <span class="user-role">{{ friend.role }}</span>
            </div>
            <span class="user-meta">{{ friend.department }} · {{ friend.account }}</span>
          </div>
          <button
            class="delete-btn"
            :class="{ confirming: deleteConfirmId === friend.id }"
            @click.stop="requestDelete(friend.id)"
          >
            {{ deleteConfirmId === friend.id ? '确认删除' : '删除' }}
          </button>
        </div>

        <!-- 底部安全区 -->
        <div class="list-bottom-hint">
          <span>点击"删除"后再点"确认删除"即可移除好友</span>
        </div>
      </div>
    </template>

  </main>
</template>

<style scoped>
/* ==================== 页面容器 ==================== */
.friend-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding-bottom: 40px;
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
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.header-placeholder { width: 40px; }

/* ==================== 菜单主页 ==================== */
.menu-container {
  margin: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
}

.menu-card {
  background: var(--color-bg-card);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);
  cursor: pointer;
  transition: all 0.15s;
}
.menu-card:active {
  background: var(--color-bg-page);
  transform: scale(0.98);
}

.menu-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.menu-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.menu-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 22px;
  flex-shrink: 0;
}
.menu-icon--purple { background: #ede9fe; }
.menu-icon--blue   { background: var(--color-primary-light); }
.menu-icon--red    { background: #fee2e2; }

.menu-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.menu-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.menu-sub {
  font-size: 13px;
  color: var(--color-text-tertiary);
}
.menu-arrow {
  font-size: 20px;
  color: var(--color-text-tertiary);
  transition: transform 0.2s;
}
.menu-card:active .menu-arrow {
  transform: translateX(3px);
}
.friend-count {
  font-size: 12px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-page);
  padding: 2px 8px;
  border-radius: 10px;
}

/* ==================== 加载态 ==================== */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
}
.loading-spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin-bottom: 12px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text {
  font-size: 14px;
  color: var(--color-text-tertiary);
  margin: 0;
}

/* ==================== 搜索栏 ==================== */
.search-bar {
  padding: 16px;
  display: flex;
  gap: 10px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}
.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--color-bg-card);
  border-radius: 10px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  gap: 8px;
}
.search-icon {
  font-size: 14px;
  flex-shrink: 0;
}
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px 0;
  font-size: 14px;
  outline: none;
  color: var(--color-text-primary);
  font-family: inherit;
}
.search-input::placeholder {
  color: var(--color-text-tertiary);
}
.search-clear {
  font-size: 14px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px;
}
.search-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  font-family: inherit;
  transition: opacity 0.2s;
}
.search-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 搜索前引导 */
.search-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
  text-align: center;
}
.guide-icon { font-size: 52px; margin-bottom: 16px; }
.guide-text { font-size: 15px; color: var(--color-text-secondary); margin: 0 0 6px 0; }
.guide-hint { font-size: 13px; color: var(--color-text-tertiary); margin: 0; }

/* ==================== 用户列表 ==================== */
.user-list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 4px 4px 4px;
}
.list-header-text {
  font-size: 13px;
  color: var(--color-text-tertiary);
}
.cancel-confirm-btn {
  font-size: 12px;
  color: var(--color-primary);
  cursor: pointer;
}

/* 用户卡片 */
.user-card {
  background: var(--color-bg-card);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
  border: 1px solid var(--color-border);
  transition: all 0.2s;
}
.user-card.confirm-delete {
  border-color: var(--color-error);
  background: #fef2f2;
}

/* 头像 */
.user-avatar {
  width: 44px; height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), #6366f1);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  position: relative;
}
.online-dot {
  position: absolute;
  bottom: 1px; right: 1px;
  width: 10px; height: 10px;
  background: var(--color-success);
  border: 2px solid #fff;
  border-radius: 50%;
}

/* 用户信息 */
.user-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.user-name-line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.user-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.user-role {
  font-size: 11px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 1px 8px;
  border-radius: 10px;
  font-weight: 500;
}
.user-meta {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.user-phone {
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* 联系按钮 */
.contact-hint {
  font-size: 13px;
  color: var(--color-primary);
  font-weight: 500;
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 6px;
  background: var(--color-primary-light);
  cursor: pointer;
  transition: background 0.15s;
}
.contact-hint:active {
  background: #dbeafe;
}

/* 添加按钮 */
.add-btn {
  font-size: 13px;
  font-weight: 500;
  padding: 7px 16px;
  border-radius: 6px;
  border: 1px solid var(--color-primary);
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  flex-shrink: 0;
  font-family: inherit;
  transition: all 0.15s;
}
.add-btn:active:not(:disabled) {
  background: var(--color-primary);
  color: #fff;
}
.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.add-btn.added {
  border-color: var(--color-border);
  color: var(--color-text-tertiary);
  background: transparent;
  cursor: default;
}

/* 删除按钮 */
.delete-btn {
  font-size: 13px;
  font-weight: 500;
  padding: 7px 16px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  flex-shrink: 0;
  font-family: inherit;
  transition: all 0.15s;
}
.delete-btn:active {
  border-color: var(--color-error);
  color: var(--color-error);
}
.delete-btn.confirming {
  border-color: var(--color-error);
  background: var(--color-error);
  color: #fff;
}

/* 列表底部提示 */
.list-bottom-hint {
  padding: 20px 4px;
  text-align: center;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* ==================== 空状态 ==================== */
/* 行内空状态 */
.empty-inline {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  text-align: center;
}
.empty-inline-icon { font-size: 40px; margin-bottom: 10px; }
.empty-inline-text { font-size: 15px; color: var(--color-text-secondary); margin: 0 0 4px 0; }
.empty-inline-hint { font-size: 13px; color: var(--color-text-tertiary); margin: 0; }

/* 满屏空状态 */
.empty-full {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 20px;
  text-align: center;
}
.empty-full-icon { font-size: 56px; margin-bottom: 16px; }
.empty-full-text { font-size: 16px; font-weight: 600; color: var(--color-text-body); margin: 0 0 6px 0; }
.empty-full-hint { font-size: 14px; color: var(--color-text-tertiary); margin: 0 0 20px 0; }
.go-add-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 10px 28px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
}
</style>
