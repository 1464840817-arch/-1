<!-- src/views/FriendManage.vue -->
<!-- 好友列表 — 默认展示好友列表，顶部展示待处理好友请求，三点菜单收纳管理操作 -->
<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { PhArrowLeft, PhShieldCheck, PhPlus, PhUsers, PhX, PhMagnifyingGlass, PhBell, PhDotsThree } from '@phosphor-icons/vue'
import { friendStore, initFriendData, loadFriendRequests, isFriend, addToFriends, acceptFriendRequest, declineFriendRequest, removeFromFriends } from '../store/friends.js'
import { getAdminList, searchUsers } from '../api/friend.js'

const router = useRouter()
const toast = inject('showToast', null)

// ==================== 导航与弹窗 ====================
const showDotsMenu = ref(false)
const activePopup = ref(null) // null | 'admin' | 'add' | 'remove'
const dotsRef = ref(null)

const viewTitle = '好友列表'

const toggleDotsMenu = () => {
  showDotsMenu.value = !showDotsMenu.value
}

const openPopup = (type) => {
  showDotsMenu.value = false
  activePopup.value = type
  if (type === 'add') {
    searchKeyword.value = ''
    searchResults.value = []
    hasSearched.value = false
  }
  if (type === 'admin') {
    loadAdmins()
  }
}

const closePopup = () => {
  activePopup.value = null
  deleteConfirmId.value = null
}

const goBack = () => {
  if (activePopup.value) {
    closePopup()
  } else {
    router.back()
  }
}

const goToUser = (id) => {
  router.push(`/user/${id}`)
}

const goToChat = (friendId) => {
  router.push(`/chat/${friendId}`)
}

const closeDotsMenu = (e) => {
  if (dotsRef.value && !dotsRef.value.contains(e.target)) {
    showDotsMenu.value = false
  }
}

onMounted(() => {
  initFriendData()
  loadFriendRequests()
  document.addEventListener('click', closeDotsMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeDotsMenu)
})

// ==================== 待处理好友请求 ====================
const acceptingIds = ref(new Set())
const decliningIds = ref(new Set())

const handleAccept = async (req) => {
  if (acceptingIds.value.has(req.senderId)) return
  acceptingIds.value = new Set([...acceptingIds.value, req.senderId])
  await acceptFriendRequest(req.senderId)
  acceptingIds.value = new Set([...acceptingIds.value].filter(id => id !== req.senderId))
  toast?.('已接受好友请求', 'success')
}

const handleDecline = async (req) => {
  if (decliningIds.value.has(req.senderId)) return
  decliningIds.value = new Set([...decliningIds.value, req.senderId])
  await declineFriendRequest(req.senderId)
  decliningIds.value = new Set([...decliningIds.value].filter(id => id !== req.senderId))
}

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
const addingIds = ref(new Set())

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

/** 添加好友（发送请求） */
const handleAddFriend = async (user) => {
  if (isFriend(user.id)) {
    toast?.('已经是好友了', 'success')
    return
  }
  if (addingIds.value.has(user.id)) return

  addingIds.value = new Set([...addingIds.value, user.id])
  const res = await addToFriends(user)
  addingIds.value = new Set([...addingIds.value].filter(id => id !== user.id))

  if (res.status === 'accepted') {
    toast?.('你们互相添加，已成为好友！', 'success')
  } else if (res.status === 'requested') {
    toast?.('好友请求已发送', 'success')
  } else if (res.status === 'already_requested') {
    toast?.('已发送过请求，请等待对方处理', 'success')
  } else {
    toast?.('操作成功', 'success')
  }
}

const resultFriendIds = computed(() => {
  return new Set(friendStore.list.map(f => f.id))
})

// ==================== 3. 删除好友 ====================
const deleteConfirmId = ref(null)

const requestDelete = (friendId) => {
  if (deleteConfirmId.value === friendId) {
    removeFromFriends(friendId)
    toast?.('已删除好友', 'success')
    deleteConfirmId.value = null
  } else {
    deleteConfirmId.value = friendId
    setTimeout(() => {
      if (deleteConfirmId.value === friendId) {
        deleteConfirmId.value = null
      }
    }, 3000)
  }
}

const cancelDelete = () => {
  deleteConfirmId.value = null
}
</script>

<template>
  <main class="friend-page" aria-label="好友列表">

    <!-- ==================== 顶部导航 ==================== -->
    <header class="page-header">
      <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack"><PhArrowLeft :size="18" class="back-icon" /> 返回</span>
      <span class="title">{{ viewTitle }}</span>
      <div ref="dotsRef" class="dots-menu-wrapper">
        <button
          class="dots-menu-btn"
          :class="{ open: showDotsMenu }"
          aria-label="更多操作"
          @click.stop="toggleDotsMenu"
        >
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </button>
        <div v-if="showDotsMenu" class="dots-dropdown">
          <button class="dropdown-item" @click="openPopup('admin')">
            <span class="dropdown-icon"><PhShieldCheck :size="15" /></span>
            <span>管理员管理</span>
          </button>
          <button class="dropdown-item" @click="openPopup('add')">
            <span class="dropdown-icon"><PhPlus :size="15" /></span>
            <span>添加好友</span>
          </button>
          <button class="dropdown-item" @click="openPopup('remove')">
            <span class="dropdown-icon"><PhUsers :size="15" /></span>
            <span>删除好友</span>
          </button>
        </div>
      </div>
    </header>

    <!-- ====================================================================== -->
    <!-- 主视图 -->
    <!-- ====================================================================== -->
    <template v-if="!activePopup">

      <!-- ==================== 待处理好友请求 ==================== -->
      <div v-if="friendStore.requests.length > 0" class="requests-section">
        <div class="section-header">
          <span class="section-title">新的朋友</span>
          <span class="section-count">{{ friendStore.requests.length }} 条待处理</span>
        </div>
        <div class="requests-list">
          <div
            v-for="req in friendStore.requests"
            :key="req.messageId"
            class="request-card"
            role="button"
            tabindex="0"
            @click="goToUser(req.senderId)"
            @keydown.enter.prevent="goToUser(req.senderId)"
            @keydown.space.prevent="goToUser(req.senderId)"
          >
            <div class="user-avatar" :class="{ online: req.isOnline }">
              <img v-if="req.avatar" :src="req.avatar" class="user-avatar-img" alt="" />
              <span v-else class="user-avatar-text">{{ req.sender[0] }}</span>
              <span v-if="req.isOnline" class="online-dot"></span>
            </div>
            <div class="user-info">
              <div class="user-name-line">
                <span class="user-name">{{ req.sender }}</span>
                <span class="user-role">{{ req.role }}</span>
              </div>
              <span class="user-meta">{{ req.department || '未分配部门' }} · {{ req.account }}</span>
              <span class="request-desc">{{ req.content }}</span>
            </div>
            <div class="request-actions">
              <button
                class="accept-btn"
                :disabled="acceptingIds.has(req.senderId)"
                @click.stop="handleAccept(req)"
              >{{ acceptingIds.has(req.senderId) ? '…' : '接受' }}</button>
              <button
                class="decline-btn"
                :disabled="decliningIds.has(req.senderId)"
                @click.stop="handleDecline(req)"
              >{{ decliningIds.has(req.senderId) ? '…' : '拒绝' }}</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== 空状态 ==================== -->
      <div v-if="friendStore.list.length === 0 && friendStore.requests.length === 0" class="empty-full">
        <span class="empty-full-icon"><PhUsers :size="56" /></span>
        <p class="empty-full-text">暂无好友</p>
        <p class="empty-full-hint">可通过右上角菜单添加好友</p>
      </div>

      <!-- ==================== 好友列表 ==================== -->
      <div v-else-if="friendStore.list.length > 0" class="user-list">
        <div class="list-header">
          <span class="list-header-text">共 {{ friendStore.list.length }} 位好友</span>
        </div>

        <div
          v-for="friend in friendStore.list"
          :key="friend.id"
          class="user-card"
          role="button"
          tabindex="0"
          @click="goToUser(friend.id)"
          @keydown.enter.prevent="goToUser(friend.id)"
          @keydown.space.prevent="goToUser(friend.id)"
        >
          <div class="user-avatar" :class="{ online: friend.isOnline }">
            <img v-if="friend.avatar" :src="friend.avatar" class="user-avatar-img" alt="" />
            <span v-else class="user-avatar-text">{{ friend.name[0] }}</span>
            <span v-if="friend.isOnline" class="online-dot"></span>
          </div>
          <div class="user-info">
            <div class="user-name-line">
              <span class="user-name">{{ friend.name }}</span>
              <span class="user-role">{{ friend.role }}</span>
            </div>
            <span class="user-meta">{{ friend.department || '未分配部门' }} · {{ friend.account }}</span>
          </div>
          <button class="chat-btn" @click.stop="goToChat(friend.id)">私聊</button>
        </div>

        <div class="list-bottom-hint">
          <span>可通过右上角菜单管理好友</span>
        </div>
      </div>
    </template>

    <!-- ====================================================================== -->
    <!-- 弹出面板：管理员管理 -->
    <!-- ====================================================================== -->
    <Teleport to="body">
      <transition name="modal">
        <div v-if="activePopup === 'admin'" class="popup-overlay" role="dialog" aria-modal="true" aria-label="管理员列表" @click.self="closePopup">
          <div class="popup-panel">
            <header class="popup-header">
              <span class="popup-title">管理员管理</span>
              <button class="popup-close" @click="closePopup" aria-label="关闭"><PhX :size="18" /></button>
            </header>

            <div v-if="adminsLoading" class="loading-state">
              <span class="loading-spinner"></span>
              <p class="loading-text">加载中...</p>
            </div>

            <div v-else class="popup-body">
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
                  <img v-if="admin.avatar" :src="admin.avatar" class="user-avatar-img" alt="" />
                  <span v-else class="user-avatar-text">{{ admin.name[0] }}</span>
                  <span v-if="admin.isOnline" class="online-dot"></span>
                </div>
                <div class="user-info">
                  <div class="user-name-line">
                    <span class="user-name">{{ admin.name }}</span>
                    <span class="user-role">{{ admin.role }}</span>
                  </div>
                  <span class="user-meta">{{ admin.department || '' }} · {{ admin.account }}</span>
                  <span v-if="admin.phone" class="user-phone">{{ admin.phone }}</span>
                </div>
                <span class="contact-hint" role="button" tabindex="0" aria-label="联系管理员" @click.stop="contactAdmin(admin)" @keydown.enter.prevent.stop="contactAdmin(admin)" @keydown.space.prevent.stop="contactAdmin(admin)">联系</span>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- ====================================================================== -->
    <!-- 弹出面板：添加好友 -->
    <!-- ====================================================================== -->
    <Teleport to="body">
      <transition name="modal">
        <div v-if="activePopup === 'add'" class="popup-overlay" role="dialog" aria-modal="true" aria-label="添加好友" @click.self="closePopup">
          <div class="popup-panel">
            <header class="popup-header">
              <span class="popup-title">添加好友</span>
              <button class="popup-close" @click="closePopup" aria-label="关闭"><PhX :size="18" /></button>
            </header>

            <div class="popup-body">
              <div class="search-bar">
                <div class="search-input-wrap">
                  <span class="search-icon"><PhMagnifyingGlass :size="14" /></span>
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
                  ><PhX :size="14" /></span>
                </div>
                <button class="search-btn" :disabled="!searchKeyword.trim() || searching" @click="handleSearch">
                  {{ searching ? '搜索中' : '搜索' }}
                </button>
              </div>

              <div v-if="hasSearched" class="popup-user-list">
                <div v-if="searching" class="loading-state">
                  <span class="loading-spinner"></span>
                  <p class="loading-text">搜索中...</p>
                </div>

                <div v-else-if="searchResults.length === 0" class="empty-inline">
                  <span class="empty-inline-icon"><PhMagnifyingGlass :size="40" /></span>
                  <p class="empty-inline-text">未找到匹配的用户</p>
                  <p class="empty-inline-hint">试试换一个关键词</p>
                </div>

                <div
                  v-for="user in searchResults"
                  :key="user.id"
                  class="user-card"
                >
                  <div class="user-avatar" :class="{ online: user.isOnline }">
                    <img v-if="user.avatar" :src="user.avatar" class="user-avatar-img" alt="" />
                    <span v-else class="user-avatar-text">{{ user.name[0] }}</span>
                    <span v-if="user.isOnline" class="online-dot"></span>
                  </div>
                  <div class="user-info">
                    <div class="user-name-line">
                      <span class="user-name">{{ user.name }}</span>
                      <span class="user-role">{{ user.role }}</span>
                    </div>
                    <span class="user-meta">{{ user.department || '' }} · {{ user.account }}</span>
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

              <div v-else class="search-guide">
                <span class="guide-icon"><PhUsers :size="52" /></span>
                <p class="guide-text">输入同事的工号、姓名或部门</p>
                <p class="guide-hint">找到后点击"添加"即可发送好友请求</p>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- ====================================================================== -->
    <!-- 弹出面板：删除好友 -->
    <!-- ====================================================================== -->
    <Teleport to="body">
      <transition name="modal">
        <div v-if="activePopup === 'remove'" class="popup-overlay" role="dialog" aria-modal="true" aria-label="删除好友" @click.self="closePopup">
          <div class="popup-panel">
            <header class="popup-header">
              <span class="popup-title">删除好友</span>
              <button class="popup-close" @click="closePopup" aria-label="关闭"><PhX :size="18" /></button>
            </header>

            <div class="popup-body">
              <div v-if="friendStore.list.length === 0" class="empty-full">
                <span class="empty-full-icon"><PhUsers :size="56" /></span>
                <p class="empty-full-text">暂无好友</p>
                <p class="empty-full-hint">去"添加好友"里搜索并添加同事吧</p>
              </div>

              <div v-else class="popup-user-list">
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
                    <img v-if="friend.avatar" :src="friend.avatar" class="user-avatar-img" alt="" />
                    <span v-else class="user-avatar-text">{{ friend.name[0] }}</span>
                    <span v-if="friend.isOnline" class="online-dot"></span>
                  </div>
                  <div class="user-info">
                    <div class="user-name-line">
                      <span class="user-name">{{ friend.name }}</span>
                      <span class="user-role">{{ friend.role }}</span>
                    </div>
                    <span class="user-meta">{{ friend.department || '未分配部门' }} · {{ friend.account }}</span>
                  </div>
                  <button
                    class="delete-btn"
                    :class="{ confirming: deleteConfirmId === friend.id }"
                    @click.stop="requestDelete(friend.id)"
                  >
                    {{ deleteConfirmId === friend.id ? '确认删除' : '删除' }}
                  </button>
                </div>

                <div class="list-bottom-hint">
                  <span>点击"删除"后再点"确认删除"即可移除好友</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>

  </main>
</template>

<style scoped>
/* ==================== 页面容器 ==================== */
.friend-page {
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
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.back-icon {
  display: block;
  flex-shrink: 0;
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* ==================== 三点菜单 ==================== */
.dots-menu-wrapper {
  position: relative;
}
.dots-menu-btn {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: var(--radius-btn);
  transition: background 0.15s;
}
.dots-menu-btn:hover,
.dots-menu-btn:active,
.dots-menu-btn.open {
  background: var(--color-bg-page);
}
.dots-menu-btn .dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-text-primary);
  flex-shrink: 0;
}
.dots-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 150px;
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
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
  padding: 12px 16px;
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
.dropdown-icon {
  display: flex;
  flex-shrink: 0;
}

/* ==================== 待处理好友请求 ==================== */
.requests-section {
  padding: 8px 16px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 4px 4px 4px;
}
.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.section-count {
  font-size: 12px;
  color: var(--color-error);
  font-weight: 500;
}
.requests-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 2px;
}
.request-card {
  background: var(--color-bg-card);
  border: 1px solid #FECACA;
  border-radius: var(--radius-card);
  padding: 14px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  box-shadow: var(--shadow-card);
  cursor: pointer;
  transition: background 0.15s;
}
.request-card:active {
  background: var(--color-bg-page);
}
.request-desc {
  font-size: 12px;
  color: var(--color-text-tertiary);
  display: block;
  margin-top: 2px;
}
.request-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}
.accept-btn {
  font-size: 12px;
  font-weight: 600;
  padding: 6px 16px;
  border-radius: var(--radius-btn);
  border: none;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
  white-space: nowrap;
}
.accept-btn:active:not(:disabled) { opacity: 0.8; }
.accept-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.decline-btn {
  font-size: 12px;
  font-weight: 500;
  padding: 6px 16px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-tertiary);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  white-space: nowrap;
}
.decline-btn:active:not(:disabled) {
  border-color: var(--color-error);
  color: var(--color-error);
}
.decline-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ==================== 弹窗面板 ==================== */
.popup-overlay {
  position: fixed;
  inset: 0;
  z-index: 400;
  background: rgba(15,23,42,0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.popup-panel {
  width: 100%;
  max-width: 500px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  overflow: hidden;
}
.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-divider);
  flex-shrink: 0;
}
.popup-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
}
.popup-close {
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  color: var(--color-text-tertiary);
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.popup-body {
  overflow-y: auto;
  flex: 1;
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
  gap: 12px;
  width: 100%;
  box-sizing: border-box;
}
.search-input-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  background: var(--color-bg-page);
  border-radius: var(--radius-btn);
  padding: 0 12px;
  border: 1px solid var(--color-border);
  gap: 8px;
}
.search-icon {
  display: flex;
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
  display: flex;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px;
}
.search-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-btn);
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

.search-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
  text-align: center;
}
.guide-icon { display: flex; color: var(--color-text-tertiary); margin-bottom: 16px; }
.guide-text { font-size: 15px; color: var(--color-text-secondary); margin: 0 0 6px 0; }
.guide-hint { font-size: 13px; color: var(--color-text-tertiary); margin: 0; }

/* ==================== 用户列表 ==================== */
.user-list,
.popup-user-list {
  padding: 4px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}
.popup-user-list {
  max-width: none;
  padding-bottom: 28px;
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
  border-radius: var(--radius-card);
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: var(--shadow-card);
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
  background: var(--color-primary);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.user-avatar-img {
  width: 100%; height: 100%;
  border-radius: 50%;
  object-fit: cover;
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
  gap: 4px;
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
  border-radius: var(--radius-tag);
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
  border-radius: var(--radius-btn);
  background: var(--color-primary-light);
  cursor: pointer;
  transition: background 0.15s;
}
.contact-hint:active {
  background: #dbeafe;
}

/* 私聊按钮 */
.chat-btn {
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-primary);
  background: transparent;
  color: var(--color-primary);
  cursor: pointer;
  flex-shrink: 0;
  font-family: inherit;
  transition: all 0.15s;
}
.chat-btn:active {
  background: var(--color-primary);
  color: #fff;
}

/* 添加按钮 */
.add-btn {
  font-size: 13px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: var(--radius-btn);
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
  padding: 8px 16px;
  border-radius: var(--radius-btn);
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
.empty-inline {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  text-align: center;
}
.empty-inline-icon { display: flex; color: var(--color-text-tertiary); margin-bottom: 10px; }
.empty-inline-text { font-size: 15px; color: var(--color-text-secondary); margin: 0 0 4px 0; }
.empty-inline-hint { font-size: 13px; color: var(--color-text-tertiary); margin: 0; }

.empty-full {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100px 20px;
  text-align: center;
}
.empty-full-icon { display: flex; color: var(--color-text-tertiary); margin-bottom: 16px; }
.empty-full-text { font-size: 16px; font-weight: 600; color: var(--color-text-body); margin: 0 0 6px 0; }
.empty-full-hint { font-size: 14px; color: var(--color-text-tertiary); margin: 0 0 20px 0; }
.go-add-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 0 28px;
  border-radius: var(--radius-btn);
  height: 44px;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
}

/* ==================== 弹窗过渡动画 ==================== */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-active .popup-panel,
.modal-leave-active .popup-panel {
  transition: transform 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .popup-panel {
  transform: translateY(100%);
}
.modal-leave-to .popup-panel {
  transform: translateY(100%);
}
</style>
