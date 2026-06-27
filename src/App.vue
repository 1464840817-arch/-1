<!-- src/App.vue -->
<script setup>
import { computed, ref, provide, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import BottomNav from './components/BottomNav.vue'
import ToastMessage from './components/ToastMessage.vue'
import { initUserData } from './store/user.js'

const route = useRoute()

// 底部导航隐藏的路由：文章详情页、编辑资料页
const hideNavRoutes = ['ArticleDetail', 'ProfileEdit', 'Publish', 'Collection', 'History', 'Login', 'FriendManage', 'PostsView', 'AdminDashboard', 'AccountManage', 'ConfigView']
const showBottomNav = computed(() => !hideNavRoutes.includes(route.name))

// Toast 全局方法 — 通过 provide 注入给所有子组件
const toastRef = ref(null)
provide('showToast', (msg, type) => {
  toastRef.value?.showToast(msg, type)
})

// 应用启动时尝试从服务端同步收藏 & 历史数据（失败则使用本地缓存）
onMounted(() => {
  initUserData()
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
</style>

<style scoped>
.app-container { min-height: 100vh; }
</style>