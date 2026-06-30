<!-- src/views/AdminDashboard.vue -->
<!-- 管理中心 — 仅管理员及以上角色可访问 -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { PhArrowLeft, PhUsers, PhTag, PhClipboardText, PhUser, PhGear, PhNotePencil, PhHeart, PhEye, PhFolder, PhClock, PhPackage } from '@phosphor-icons/vue'
import { userStore } from '../store/user.js'
import { currentIsSuperAdmin, currentIsAdmin } from '../store/user.js'
import { ROLE_LABELS } from '../store/auth.js'
import { getProfileVisibility, updateProfileVisibility } from '../api/tenant.js'

const router = useRouter()

const goBack = () => router.back()

const roleLabel = computed(() => ROLE_LABELS[userStore.role] || userStore.role)

// ==================== 个人页面可见性管理 ====================
const showVisibilityPanel = ref(false)
const visibilitySaving = ref(false)
const profileVisibility = ref({
  myPosts: true,
  totalLikes: true,
  totalViews: true,
  collections: true,
  history: true,
  delisted: true,
})

const SECTION_LABELS = {
  myPosts: '我的发布',
  totalLikes: '获得点赞',
  totalViews: '总浏览量',
  collections: '收藏',
  history: '浏览历史',
  delisted: '已下架文章',
}

const SECTION_ICONS = {
  myPosts:     PhNotePencil,
  totalLikes:  PhHeart,
  totalViews:  PhEye,
  collections: PhFolder,
  history:     PhClock,
  delisted:    PhPackage,
}

const loadVisibility = async () => {
  try {
    const data = await getProfileVisibility()
    if (data) {
      profileVisibility.value = data
    }
  } catch { /* 静默 */ }
}

const toggleVisibility = async (key) => {
  profileVisibility.value[key] = !profileVisibility.value[key]
  visibilitySaving.value = true
  try {
    await updateProfileVisibility({ [key]: profileVisibility.value[key] })
  } catch { /* 静默 */ }
  visibilitySaving.value = false
}

const toggleVisibilityPanel = () => {
  showVisibilityPanel.value = !showVisibilityPanel.value
  if (showVisibilityPanel.value) {
    loadVisibility()
  }
}

const adminMenus = computed(() => {
  const menus = [
    {
      label: '用户管理',
      sub: '创建、禁用、删除用户账号',
      icon: PhUsers,
      path: '/admin/users',
      show: currentIsAdmin(),
    },
    {
      label: '标签管理',
      sub: '分类标签的增删改',
      icon: PhTag,
      path: '/search',
      query: { admin: '1' },
      show: currentIsAdmin(),
    },
    {
      label: '操作日志',
      sub: '查看管理员敏感操作记录',
      icon: PhClipboardText,
      path: '/admin/operation-logs',
      show: currentIsAdmin(),
    },
    {
      label: '个人页面管理',
      sub: '管理一线工程师个人页面的模块可见性',
      icon: PhUser,
      action: 'toggleVisibilityPanel',
      show: currentIsAdmin(),
    },
    {
      label: '系统配置',
      sub: '平台参数与部署设置',
      icon: PhGear,
      path: '/admin/config',
      show: currentIsSuperAdmin(),
    },
  ]
  return menus.filter(m => m.show)
})

const handleMenuClick = (menu) => {
  if (menu.action === 'toggleVisibilityPanel') {
    toggleVisibilityPanel()
  } else if (menu.query) {
    router.push({ path: menu.path, query: menu.query })
  } else {
    router.push(menu.path)
  }
}

onMounted(() => {
  loadVisibility()
})
</script>

<template>
  <main class="admin-page" aria-label="管理中心">

    <!-- 顶部导航 -->
    <header class="page-header">
      <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter="goBack" @keydown.space.prevent="goBack"><PhArrowLeft :size="18" class="back-icon" /> 返回</span>
      <span class="title">管理中心</span>
      <span class="role-tag">{{ roleLabel }}</span>
    </header>

    <!-- 欢迎横幅 -->
    <div class="welcome-banner">
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
          <span class="menu-icon-box"><component :is="menu.icon" :size="22" /></span>
          <div class="menu-info">
            <span class="menu-label">{{ menu.label }}</span>
            <span class="menu-sub">{{ menu.sub }}</span>
          </div>
        </div>
        <span class="menu-arrow">›</span>
      </div>
    </div>

    <!-- ==================== 个人页面可见性管理面板 ==================== -->
    <div v-if="showVisibilityPanel" class="visibility-panel">
      <div class="visibility-header">
        <h2 class="visibility-title">个人页面模块可见性</h2>
        <p class="visibility-desc">控制一线工程师个人页面中各模块的显示/隐藏</p>
      </div>
      <div class="visibility-list">
        <div
          v-for="(label, key) in SECTION_LABELS"
          :key="key"
          class="visibility-item"
        >
          <div class="visibility-item-left">
            <span class="visibility-icon"><component :is="SECTION_ICONS[key]" :size="18" /></span>
            <span class="visibility-label">{{ label }}</span>
          </div>
          <button
            class="visibility-toggle"
            :class="{ on: profileVisibility[key] }"
            role="switch"
            :aria-checked="profileVisibility[key] ? 'true' : 'false'"
            :aria-label="`切换${label}可见性`"
            :disabled="visibilitySaving"
            @click="toggleVisibility(key)"
          >
            <span class="toggle-knob"></span>
          </button>
        </div>
      </div>
    </div>

  </main>
</template>

<style scoped>
.admin-page {
  min-height: var(--app-height, 100dvh);
  background: var(--color-bg-page);
  padding-bottom: 40px;
}

/* --- 顶部导航 --- */
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
.back-icon { display: block; flex-shrink: 0; }
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.role-tag {
  font-size: 11px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 4px 12px;
  border-radius: var(--radius-tag);
  font-weight: 500;
}

/* --- 欢迎横幅 --- */
.welcome-banner {
  margin: 16px;
  padding: 16px;
  background: var(--color-bg-card);
  box-shadow: var(--shadow-card);
  border-radius: var(--radius-card);
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
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
  gap: 12px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
}
.menu-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-card);
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
  gap: 16px;
}
.menu-icon-box {
  width: 44px; height: 44px;
  border-radius: var(--radius-card);
  background: var(--color-primary-light);
  color: var(--color-primary);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}
.menu-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
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

/* --- 个人页面可见性管理面板 --- */
.visibility-panel {
  margin: 0 16px 40px 16px;
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 20px;
  box-shadow: var(--shadow-card);
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
}
.visibility-header {
  margin-bottom: 16px;
}
.visibility-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 4px 0;
}
.visibility-desc {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: 0;
}
.visibility-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.visibility-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-bg-page);
}
.visibility-item:last-child {
  border-bottom: none;
}
.visibility-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.visibility-icon {
  display: flex;
  align-items: center;
  color: var(--color-text-tertiary);
}
.visibility-label {
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

/* Toggle Switch */
.visibility-toggle {
  position: relative;
  width: 48px;
  height: 28px;
  border-radius: 14px;
  border: none;
  background: #CBD5E1;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}
.visibility-toggle.on {
  background: #2563EB;
}
.visibility-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.toggle-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
  transition: transform 0.2s;
}
.visibility-toggle.on .toggle-knob {
  transform: translateX(22px);
}
</style>
