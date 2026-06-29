<!-- src/components/BottomNav.vue -->
<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { PhMagnifyingGlass, PhHouse, PhChatCircle, PhUser } from '@phosphor-icons/vue'
import { messageStore } from '../store/messages.js'

const router = useRouter()
const route = useRoute()

// 导航项配置
const navItems = [
  { name: '搜索', path: '/search' },
  { name: '首页', path: '/home' },
  { name: '消息', path: '/message' },
  { name: '我的', path: '/profile' },
]

// 图标映射
const iconMap = {
  '/search':  PhMagnifyingGlass,
  '/home':    PhHouse,
  '/message': PhChatCircle,
  '/profile': PhUser,
}

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
        <component :is="iconMap[item.path]" :size="22" class="nav-icon" aria-hidden="true" />
        <span v-if="item.name === '消息' && unreadBadge > 0" class="nav-badge" aria-label="有未读消息"></span>
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
.nav-item .nav-icon { display: block; }
.nav-item .nav-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #e53e3e;
  box-shadow: 0 1px 3px rgba(229, 62, 62, 0.35);
  animation: badge-pop 0.3s ease;
}
@keyframes badge-pop {
  from { transform: scale(0.6); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.nav-item .nav-text { font-size: 11px; font-weight: 500; }
.nav-item.active { color: var(--color-primary); }
</style>