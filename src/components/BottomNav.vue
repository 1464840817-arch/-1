<!-- src/components/BottomNav.vue -->
<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { messageStore } from '../store/messages.js'

const router = useRouter()
const route = useRoute()

// 导航项配置
const navItems = [
  { name: '搜索', icon: '🔍', path: '/search' },
  { name: '首页', icon: '🏠', path: '/home' },
  { name: '消息', icon: '✉️', path: '/message' },
  { name: '我的', icon: '👤', path: '/profile' }
]

// 消息未读数（底部导航红点）
const unreadBadge = computed(() => messageStore.unread)

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
      <span class="nav-icon-wrap">
        <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>
        <span v-if="item.name === '消息' && unreadBadge > 0" class="nav-badge" :aria-label="`${unreadBadge} 条未读消息`">{{ unreadBadge > 99 ? '99+' : unreadBadge }}</span>
      </span>
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
.nav-item .nav-icon-wrap {
  position: relative;
  display: inline-flex;
  margin-bottom: 2px;
}
.nav-item .nav-icon { font-size: 22px; }
.nav-item .nav-badge {
  position: absolute;
  top: -6px;
  right: -12px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: #e53e3e;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  line-height: 1;
  box-sizing: border-box;
  box-shadow: 0 1px 3px rgba(229, 62, 62, 0.35);
  animation: badge-pop 0.3s ease;
}
@keyframes badge-pop {
  from { transform: scale(0.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.nav-item .nav-text { font-size: 11px; font-weight: 500; }
.nav-item.active { color: var(--color-primary); }
.nav-item.active .nav-icon { font-weight: bold; } /* 选中时图标稍微突出 */
</style>