<!-- src/components/BottomNav.vue -->
<script setup>
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

// 导航项配置
const navItems = [
  { name: '搜索', icon: '🔍', path: '/search' },
  { name: '首页', icon: '🏠', path: '/home' },
  { name: '消息', icon: '✉️', path: '/message' },
  { name: '我的', icon: '👤', path: '/profile' }
]

// 点击跳转
const switchTab = (path) => {
  if (route.path !== path) {
    router.push(path)
  }
}
</script>

<template>
  <nav class="bottom-nav" aria-label="主导航">
    <div
      v-for="(item, index) in navItems"
      :key="index"
      class="nav-item"
      :class="{ active: route.path === item.path }"
      role="link"
      :tabindex="route.path === item.path ? -1 : 0"
      :aria-label="item.name"
      :aria-current="route.path === item.path ? 'page' : undefined"
      @click="switchTab(item.path)"
      @keydown.enter.prevent="switchTab(item.path)"
      @keydown.space.prevent="switchTab(item.path)"
    >
      <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
      <span class="nav-text">{{ item.name }}</span>
    </div>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 65px;
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-border);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 999;
  /* 适配刘海屏 */
  padding-bottom: env(safe-area-inset-bottom);
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--color-text-tertiary);
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}
.nav-item .nav-icon { font-size: 22px; margin-bottom: 2px; }
.nav-item .nav-text { font-size: 11px; font-weight: 500; }
.nav-item.active { color: var(--color-primary); }
.nav-item.active .nav-icon { font-weight: bold; } /* 选中时图标稍微突出 */
</style>