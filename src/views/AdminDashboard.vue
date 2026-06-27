<!-- src/views/AdminDashboard.vue -->
<!-- 管理中心 — 仅管理员及以上角色可访问 -->
<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { userStore } from '../store/user.js'
import { currentIsSuperAdmin, currentIsAdmin } from '../store/user.js'
import { ROLE_LABELS } from '../store/auth.js'

const router = useRouter()

const goBack = () => router.back()

const roleLabel = computed(() => ROLE_LABELS[userStore.role] || userStore.role)

const adminMenus = computed(() => {
  const menus = [
    {
      label: '用户管理',
      sub: '创建、禁用、删除用户账号',
      icon: '👥',
      path: '/admin/users',
      show: currentIsAdmin(),
    },
    {
      label: '标签管理',
      sub: '分类标签的增删改',
      icon: '🏷️',
      path: '/search',
      query: { admin: '1' },
      show: currentIsAdmin(),
    },
    {
      label: '系统配置',
      sub: '平台参数与部署设置',
      icon: '⚙️',
      path: '/admin/config',
      show: currentIsSuperAdmin(),
    },
  ]
  return menus.filter(m => m.show)
})

const handleMenuClick = (menu) => {
  if (menu.query) {
    router.push({ path: menu.path, query: menu.query })
  } else {
    router.push(menu.path)
  }
}
</script>

<template>
  <main class="admin-page" aria-label="管理中心">

    <!-- 顶部导航 -->
    <header class="page-header">
      <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter="goBack" @keydown.space.prevent="goBack">← 返回</span>
      <span class="title">管理中心</span>
      <span class="role-tag">{{ roleLabel }}</span>
    </header>

    <!-- 欢迎横幅 -->
    <div class="welcome-banner">
      <span class="welcome-icon">🛡️</span>
      <div class="welcome-text">
        <p class="welcome-greet">你好，{{ userStore.name }}</p>
        <p class="welcome-hint">当前身份：{{ roleLabel }}，可进行以下管理操作</p>
      </div>
    </div>

    <!-- 功能菜单 -->
    <div class="menu-container">
      <div
        v-for="(menu, index) in adminMenus"
        :key="index"
        class="menu-card"
        role="button"
        tabindex="0"
        @click="handleMenuClick(menu)"
        @keydown.enter="handleMenuClick(menu)"
        @keydown.space.prevent="handleMenuClick(menu)"
      >
        <div class="menu-left">
          <span class="menu-icon-box">{{ menu.icon }}</span>
          <div class="menu-info">
            <span class="menu-label">{{ menu.label }}</span>
            <span class="menu-sub">{{ menu.sub }}</span>
          </div>
        </div>
        <span class="menu-arrow">›</span>
      </div>
    </div>

  </main>
</template>

<style scoped>
.admin-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding-bottom: 40px;
}

/* --- 顶部导航 --- */
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
.role-tag {
  font-size: 11px;
  color: #fff;
  background: #7c3aed;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: 500;
}

/* --- 欢迎横幅 --- */
.welcome-banner {
  margin: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
}
.welcome-icon {
  font-size: 32px;
  flex-shrink: 0;
}
.welcome-greet {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 4px 0;
}
.welcome-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin: 0;
}

/* --- 菜单 --- */
.menu-container {
  margin: 0 16px;
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
.menu-icon-box {
  width: 44px; height: 44px;
  border-radius: 12px;
  background: #ede9fe;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 22px;
  flex-shrink: 0;
}
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
}
</style>
