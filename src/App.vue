<!-- src/App.vue -->
<script setup>
import { computed, ref, provide, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from './components/BottomNav.vue'
import ToastMessage from './components/ToastMessage.vue'
import { initUserData, userStore } from './store/user.js'
import { loadFriendRequests } from './store/friends.js'
import { loadUnreadCount } from './store/messages.js'

const route = useRoute()

// 底部导航隐藏的路由：文章详情页、编辑资料页
const hideNavRoutes = ['ArticleDetail', 'ProfileEdit', 'Publish', 'Collection', 'History', 'Login', 'FriendManage', 'ChatView', 'UserDetail', 'PostsView', 'AdminDashboard', 'AccountManage', 'ConfigView', 'OperationLogs']

// 允许子组件动态覆盖底部导航的显隐（如 DelistedPosts 管理模式下隐藏）
const hideBottomNavOverlay = ref(false)
provide('setHideBottomNav', (val) => { hideBottomNavOverlay.value = val })

const showBottomNav = computed(() => !hideNavRoutes.includes(route.name) && !hideBottomNavOverlay.value)

// Toast 全局方法 — 通过 provide 注入给所有子组件
const toastRef = ref(null)
provide('showToast', (msg, type) => {
  toastRef.value?.showToast(msg, type)
})

// 刷新所有通知类数据（好友请求 + 消息未读数）
function refreshBadgeCounts() {
  if (userStore.isLoggedIn) {
    loadFriendRequests()
    loadUnreadCount()
  }
}

// 应用启动时尝试从服务端同步收藏 & 历史数据（失败则使用本地缓存）
onMounted(() => {
  initUserData()
  refreshBadgeCounts()
  // 页面从后台恢复时（用户切回标签页 / 手机从锁屏唤醒），刷新红点数据
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

function onVisibilityChange() {
  if (document.visibilityState === 'visible') {
    refreshBadgeCounts()
  }
}

// 登录状态变化时（登录/会话恢复后），拉取通知类数据
watch(() => userStore.isLoggedIn, (loggedIn) => {
  if (loggedIn) {
    refreshBadgeCounts()
  }
})
</script>

<template>
  <!-- 跳过导航链接 — 仅键盘导航时可见 -->
  <a href="#main-content" class="skip-to-content">跳到主要内容</a>

  <div class="app-container">
    <main id="main-content">
      <router-view v-slot="{ Component, route: r }">
        <component :is="Component" :key="r.fullPath" />
      </router-view>
    </main>

    <BottomNav v-if="showBottomNav" />
    <ToastMessage ref="toastRef" />
  </div>
</template>

<style>
body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; background-color: var(--color-bg-page); }

/* 桌面端阅读线宽约束 — 各页面内容区可按需使用 */
.page-content {
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
}

/* ===== 全局交互状态 ===== */
button:active:not(:disabled) { opacity: 0.9; }
.list-item:active { background: var(--color-bg-page); }

/* 收藏动画 */
.collect-icon { transition: transform 0.2s ease; }
.collect-icon.pulse { transform: scale(1.2); }
</style>

<style scoped>
.app-container { min-height: 100vh; }
</style>