<!-- src/views/LoginView.vue -->
<!-- 登录页面 — 极简企业级设计，适配移动端 -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { login } from '../api/auth.js'
import { userStore, setLoginState } from '../store/user.js'
import { SEED_SUPER_ADMIN, ROLES } from '../store/auth.js'
import { getTenantConfig } from '../api/tenant.js'
import { PhWarning } from '@phosphor-icons/vue'

const router = useRouter()
const route = useRoute()

// ==================== 表单状态 ====================
const account = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const errorMsg = ref('')

// ==================== 品牌区域（从系统配置动态加载） ====================
const brandName = ref('工控技术库')
const brandSubtitle = ref('经验沉淀 · 故障智搜')
const brandLogo = ref('')

onMounted(() => {
  getTenantConfig().then(config => {
    brandName.value = config.name || '工控技术库'
    brandSubtitle.value = config.subtitle || '经验沉淀 · 故障智搜'
    brandLogo.value = config.logoUrl || ''
  }).catch(() => {})
})

// 按钮是否可点击
const canSubmit = computed(() => {
  return account.value.trim().length > 0 && password.value.length > 0 && !submitting.value
})

// ==================== 登录错误提示映射 ====================
/**
 * 将后端返回的错误转换为用户友好的中文提示
 * 优先使用后端返回的 message，若缺失则根据 HTTP 状态码映射
 */
const getLoginErrorMessage = (err) => {
  // 如果后端已返回明确的中文提示，直接使用
  if (err.message && typeof err.message === 'string') {
    return err.message
  }

  // 根据 HTTP 状态码映射友好提示
  const STATUS_MAP = {
    400: '请求参数有误，请检查输入',
    401: '密码错误，请检查后重试',
    403: '账号已被禁用，请联系管理员',
    404: '账号不存在，请检查工号或手机号',
    429: '登录尝试过于频繁，请稍后再试',
    500: '服务器异常，请稍后重试',
    502: '服务暂不可用，请稍后重试',
    503: '服务正在维护中，请稍后重试',
  }
  if (err.status && STATUS_MAP[err.status]) {
    return STATUS_MAP[err.status]
  }

  // 兜底
  return '登录失败，请稍后重试'
}

// ==================== 登录逻辑 ====================
const handleLogin = async () => {
  // 清除上次错误
  errorMsg.value = ''

  // 前端校验
  if (!account.value.trim()) {
    errorMsg.value = '请输入工号或手机号'
    return
  }
  if (!password.value) {
    errorMsg.value = '请输入密码'
    return
  }

  submitting.value = true

  try {
    // API 优先：调用后端登录接口
    const result = await login({
      account: account.value.trim(),
      password: password.value,
    })

    // 后端返回了有效 token → 真实登录成功
    if (result?.token) {
      setLoginState({
        name: result.name || account.value.trim(),
        token: result.token,
        refreshToken: result.refreshToken || '',
        role: result.role || '',
        account: result.account || account.value.trim(),
        avatar: result.avatar || '',
      })
      const redirect = route.query.redirect || '/search'
      router.push(redirect)
      return
    }

    // result 无效（如 Vite 返回了 index.html）→ 降级 demo 模式
    throw { status: 0 }
  } catch (err) {
    // 后端不可达（网络不通 / 接口未部署）— 降级本地 demo 模式
    if (err.status === 0 || err instanceof TypeError) {
      // 检查是否为种子超级管理员
      const isSeedAdmin =
        account.value.trim() === SEED_SUPER_ADMIN.account &&
        password.value === SEED_SUPER_ADMIN.password

      // demo 模式放行
      setLoginState({
        name: isSeedAdmin ? SEED_SUPER_ADMIN.name : account.value.trim(),
        token: 'demo-token',
        role: isSeedAdmin ? SEED_SUPER_ADMIN.role : '一线工程师',
        account: isSeedAdmin ? SEED_SUPER_ADMIN.account : account.value.trim(),
      })
      const redirect = route.query.redirect || '/search'
      router.push(redirect)
      return
    }

    // 后端可达但登录凭据错误（401/403 等）— 映射为友好中文提示
    errorMsg.value = getLoginErrorMessage(err)
  } finally {
    submitting.value = false
  }
}

// 回车键触发登录
const handleKeyup = (e) => {
  if (e.key === 'Enter') {
    handleLogin()
  }
}
</script>

<template>
  <main class="login-page" aria-labelledby="brand-title">

    <!-- ==================== 1. 品牌 Logo 区域 ==================== -->
    <div class="brand-area">
      <!-- 已上传 Logo：显示图片 -->
      <img v-if="brandLogo" :src="brandLogo" class="brand-logo-img" alt="平台 Logo" />
      <!-- 未上传：显示默认靶心 SVG 图标 -->
      <svg v-else class="brand-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 外圈齿轮 -->
        <circle cx="40" cy="40" r="34" stroke="var(--color-primary)" stroke-width="3" fill="none" />
        <!-- 齿轮齿 (8个) -->
        <g stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round">
          <line x1="40" y1="2"  x2="40" y2="10" />
          <line x1="40" y1="70" x2="40" y2="78" />
          <line x1="2"  y1="40" x2="10" y2="40" />
          <line x1="70" y1="40" x2="78" y2="40" />
          <!-- 对角齿 -->
          <line x1="13.1" y1="13.1" x2="18.8" y2="18.8" />
          <line x1="61.2" y1="61.2" x2="66.9" y2="66.9" />
          <line x1="66.9" y1="13.1" x2="61.2" y2="18.8" />
          <line x1="18.8" y1="61.2" x2="13.1" y2="66.9" />
        </g>
        <!-- 内圈电路线条 -->
        <circle cx="40" cy="40" r="18" stroke="var(--color-primary)" stroke-width="1.5" fill="none" opacity="0.5" />
        <!-- 中心芯片/节点 -->
        <rect x="30" y="30" width="20" height="20" rx="3" fill="var(--color-primary)" />
        <!-- 芯片引脚 (4个方向) -->
        <g stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round">
          <line x1="40" y1="21" x2="40" y2="28" />
          <line x1="40" y1="52" x2="40" y2="59" />
          <line x1="21" y1="40" x2="28" y2="40" />
          <line x1="52" y1="40" x2="59" y2="40" />
        </g>
        <!-- 连接点 -->
        <circle cx="40" cy="40" r="3" fill="#fff" />
      </svg>

      <h1 id="brand-title" class="brand-title">{{ brandName }}</h1>
      <p class="brand-subtitle">{{ brandSubtitle }}</p>
    </div>

    <!-- ==================== 2. 核心表单区域 ==================== -->
    <div class="form-area">
      <!-- 错误提示 -->
      <transition name="fade">
        <div v-if="errorMsg" class="error-banner" role="alert">
          <PhWarning :size="14" class="error-icon" />
          <span>{{ errorMsg }}</span>
        </div>
      </transition>

      <!-- 账号输入框 -->
      <div class="input-group">
        <span class="input-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--color-text-tertiary)" stroke-width="2" stroke-linecap="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </span>
        <input
          id="login-account"
          v-model="account"
          type="text"
          class="text-input"
          placeholder="请输入工号或手机号"
          autocomplete="username"
          aria-label="工号或手机号"
          aria-required="true"
          @keyup="handleKeyup"
        />
      </div>

      <!-- 密码输入框 -->
      <div class="input-group">
        <span class="input-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--color-text-tertiary)" stroke-width="2" stroke-linecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <input
          id="login-password"
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          class="text-input"
          placeholder="请输入密码"
          autocomplete="current-password"
          aria-label="密码"
          aria-required="true"
          @keyup="handleKeyup"
        />
        <!-- 显示/隐藏密码 -->
        <span
          class="toggle-pwd"
          role="button"
          tabindex="0"
          aria-label="切换密码可见性"
          @click="showPassword = !showPassword"
          @keydown.enter.prevent="showPassword = !showPassword"
          @keydown.space.prevent="showPassword = !showPassword"
        >
          <svg v-if="!showPassword" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--color-text-tertiary)" stroke-width="2" stroke-linecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--color-text-tertiary)" stroke-width="2" stroke-linecap="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        </span>
      </div>

      <!-- 登录按钮 -->
      <button
        class="login-btn"
        :class="{ 'is-disabled': !canSubmit }"
        :disabled="!canSubmit"
        @click="handleLogin"
      >
        <span v-if="!submitting">登 录</span>
        <span v-else class="btn-loading">
          <span class="spinner"></span>
          登录中...
        </span>
      </button>

      <!-- 忘记密码 -->
      <div class="extra-links">
        <span
          class="forgot-link"
          role="button"
          tabindex="0"
          @click="errorMsg = '请联系管理员重置密码'"
          @keydown.enter.prevent="errorMsg = '请联系管理员重置密码'"
          @keydown.space.prevent="errorMsg = '请联系管理员重置密码'"
        >忘记密码？</span>
      </div>
    </div>

    <!-- ==================== 3. 版权信息 ==================== -->
    <footer class="page-footer">
      <p>© 2026 工控技术库 · 私有化部署</p>
    </footer>

  </main>
</template>

<style scoped>
/* ==================== 整体布局 ==================== */
.login-page {
  min-height: var(--app-height, 100dvh);
  min-height: 100dvh;
  background: var(--color-bg-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 24px;
  box-sizing: border-box;
}

/* ==================== 1. 品牌区域 ==================== */
.brand-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 80px;
  margin-bottom: 48px;
}

/* 已上传 Logo 图片 */
.brand-logo-img {
  width: 72px;
  height: 72px;
  border-radius: 12px;
  object-fit: contain;
  margin-bottom: 16px;
}

.brand-icon {
  width: 72px;
  height: 72px;
  margin-bottom: 16px;
}

.brand-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 6px 0;
  letter-spacing: 1px;
}

.brand-subtitle {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: 0;
  letter-spacing: 0.5px;
}

/* ==================== 2. 表单区域 ==================== */
.form-area {
  width: 100%;
  max-width: 360px;
}

/* 错误横幅 */
.error-banner {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-error-bg);
  color: var(--color-error);
  font-size: 13px;
  padding: 10px 14px;
  border-radius: 8px;
  margin-bottom: 12px;
}
.error-icon { display: flex; flex-shrink: 0; }

.fade-enter-active,
.fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }

/* 输入框组 */
.input-group {
  display: flex;
  align-items: center;
  background: var(--color-divider);
  border-radius: var(--radius-card);
  padding: 0 14px;
  margin-bottom: 16px;
  border: 1.5px solid transparent;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.input-group:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.input-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-right: 10px;
}

.text-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 15px;
  color: var(--color-text-primary);
  padding: 16px 0;
  font-family: inherit;
}
.text-input::placeholder {
  color: var(--color-text-tertiary);
  font-size: 14px;
}

/* 密码可见性切换 */
.toggle-pwd {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding: 6px;
  cursor: pointer;
  margin-left: 6px;
  border-radius: var(--radius-btn);
  transition: background 0.15s;
  user-select: none;
}
.toggle-pwd:active {
  background: rgba(0, 0, 0, 0.05);
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: var(--radius-btn);
  background: var(--color-primary);
  color: var(--color-bg-card);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 2px;
  cursor: pointer;
  margin-top: 8px;
  transition: background 0.2s, transform 0.15s, opacity 0.2s;
  font-family: inherit;
}
.login-btn:active:not(.is-disabled) {
  transform: scale(0.98);
  background: var(--color-primary);
}
.login-btn.is-disabled {
  background: var(--color-border);
  color: rgba(255, 255, 255, 0.7);
  cursor: not-allowed;
  pointer-events: none;
}

/* loading 状态 */
.btn-loading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 辅助链接 */
.extra-links {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.forgot-link {
  font-size: 13px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}
.forgot-link:active {
  color: var(--color-primary);
}

/* ==================== 3. 版权 ==================== */
.page-footer {
  margin-top: auto;
  padding: 24px 0 32px 0;
}

.page-footer p {
  margin: 0;
  font-size: 11px;
  color: var(--color-text-tertiary);
  text-align: center;
  letter-spacing: 0.3px;
}
</style>
