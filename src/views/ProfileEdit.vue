<!-- src/views/ProfileEdit.vue -->
<!-- 编辑资料页面 — 头像更换、账号只读、用户名/简介编辑，真实 HTTP 保存 -->

<script setup>
import { ref, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { getProfile, updateProfile, changePassword } from '../api/user.js'
import { userStore, updateUser, currentIsAdmin } from '../store/user.js'

const router = useRouter()

// 从 App.vue inject 全局 toast 方法
const toast = inject('showToast', null)

// ==================== 表单数据 ====================
const form = ref({
  avatar: '',       // 初始头像 URL（来自服务端）
  account: '',
  name: '',
  desc: '',
})

// ==================== 头像相关 ====================
const avatarPreview = ref('')          // 本地预览 URL
const avatarFile = ref(null)           // 选择的文件对象
const fileInputRef = ref(null)         // input[type=file] 的 DOM 引用

/** 点击头像 → 触发文件选择 */
const triggerFilePicker = () => {
  fileInputRef.value?.click()
}

/** 文件选择后 → 生成本地预览 */
const handleAvatarChange = (e) => {
  const file = e.target.files[0]
  if (!file) return

  // 仅允许图片格式
  if (!file.type.startsWith('image/')) {
    toast?.('仅支持图片格式（JPG、PNG 等）', 'error')
    return
  }
  // 限制大小 5MB
  if (file.size > 5 * 1024 * 1024) {
    toast?.('图片大小不能超过 5MB', 'error')
    return
  }

  avatarFile.value = file

  // 生成本地预览 URL
  if (avatarPreview.value) URL.revokeObjectURL(avatarPreview.value)
  avatarPreview.value = URL.createObjectURL(file)
}

// ==================== 表单校验 ====================
const errors = ref({})

const validate = () => {
  const errs = {}
  const name = form.value.name.trim()

  if (!name) {
    errs.name = '请输入用户名'
  } else if (name.length < 2 || name.length > 20) {
    errs.name = '用户名需为 2–20 个字符'
  }

  if (form.value.desc.length > 200) {
    errs.desc = '个人简介不能超过 200 字'
  }

  errors.value = errs
  return Object.keys(errs).length === 0
}

// ==================== 页面状态 ====================
const pageLoading = ref(true)   // 初始加载骨架
const loadError = ref(false)
const saving = ref(false)

/** 加载用户资料 */
const loadProfile = async () => {
  pageLoading.value = true
  loadError.value = false
  try {
    const data = await getProfile()
    form.value = {
      avatar: data.avatar || '',
      account: data.account || '',
      name: data.name || '',
      desc: data.desc || '',
    }
    avatarPreview.value = data.avatar || ''
  } catch (err) {
    console.warn('加载用户资料失败:', err.message || err)
    loadError.value = true
  } finally {
    pageLoading.value = false
  }
}

/** 保存 */
const handleSave = async () => {
  if (!validate()) return
  if (saving.value) return

  saving.value = true
  try {
    let body
    if (avatarFile.value) {
      body = new FormData()
      body.append('avatar', avatarFile.value)
      body.append('name', form.value.name.trim())
      body.append('desc', form.value.desc.trim())
    } else {
      body = {
        name: form.value.name.trim(),
        desc: form.value.desc.trim(),
      }
    }

    await updateProfile(body)
    // 同步到全局用户状态，ProfileView 等页面自动更新
    updateUser({
      name: form.value.name.trim(),
      desc: form.value.desc.trim(),
    })
    toast?.('资料保存成功', 'success')
    router.back()
  } catch (err) {
    toast?.(err.message || '保存失败，请稍后重试', 'error')
  } finally {
    saving.value = false
  }
}

// ==================== 修改密码 ====================
const pwdForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})
const pwdErrors = ref({})
const pwdChanging = ref(false)

const validatePassword = () => {
  const errs = {}
  if (!pwdForm.value.oldPassword) {
    errs.oldPassword = '请输入旧密码'
  }
  if (!pwdForm.value.newPassword) {
    errs.newPassword = '请输入新密码'
  } else if (pwdForm.value.newPassword.length < 6) {
    errs.newPassword = '新密码至少需要 6 位'
  }
  if (!pwdForm.value.confirmPassword) {
    errs.confirmPassword = '请再次输入新密码'
  } else if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) {
    errs.confirmPassword = '两次输入的新密码不一致'
  }
  pwdErrors.value = errs
  return Object.keys(errs).length === 0
}

const handleChangePassword = async () => {
  if (!validatePassword()) return
  if (pwdChanging.value) return

  pwdChanging.value = true
  try {
    await changePassword({
      oldPassword: pwdForm.value.oldPassword,
      newPassword: pwdForm.value.newPassword,
    })
    toast?.('密码修改成功', 'success')
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
  } catch (err) {
    toast?.(err.message || '密码修改失败，请稍后重试', 'error')
  } finally {
    pwdChanging.value = false
  }
}

/** 返回上一页 */
const goBack = () => {
  router.back()
}

// ==================== 生命周期 ====================
onMounted(() => {
  loadProfile()
})
</script>

<template>
  <main class="edit-page" aria-label="编辑资料">

    <!-- 1. 顶部导航 -->
    <header class="edit-header">
      <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack">← 返回</span>
      <span class="title">编辑资料</span>
      <button
        class="save-btn"
        :disabled="saving"
        aria-label="保存资料"
        @click="handleSave"
      >
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </header>

    <!-- 2. 加载骨架 -->
    <div v-if="pageLoading" class="loading-box">
      <div class="skeleton skeleton-avatar"></div>
      <div class="skeleton skeleton-line"></div>
      <div class="skeleton skeleton-line short"></div>
    </div>

    <!-- 3. 加载失败 -->
    <div v-else-if="loadError" class="error-box">
      <p class="error-text">加载失败，请检查网络</p>
      <button class="retry-btn" @click="loadProfile">重新加载</button>
    </div>

    <!-- 4. 编辑表单 -->
    <div v-else class="edit-form">

      <!-- 头像 -->
      <div class="form-item avatar-item" role="button" tabindex="0" aria-label="更换头像" @click="triggerFilePicker" @keydown.enter.prevent="triggerFilePicker" @keydown.space.prevent="triggerFilePicker">
        <span class="label">头像</span>
        <div class="avatar-box">
          <img
            v-if="avatarPreview"
            :src="avatarPreview"
            alt="头像"
            class="avatar-img"
          />
          <span v-else class="avatar-placeholder">{{ form.name[0] || '?' }}</span>
          <div class="avatar-overlay">
            <span class="camera-icon">📷</span>
          </div>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          class="sr-only"
          aria-label="选择头像文件"
          @change="handleAvatarChange"
        />
      </div>

      <!-- 账号（只读） -->
      <div class="form-item">
        <span class="label">账号</span>
        <span class="value readonly">{{ form.account }}</span>
      </div>

      <!-- 用户名 -->
      <div class="form-item">
        <span class="label">用户名</span>
        <div class="input-wrapper">
          <input
            v-model="form.name"
            type="text"
            class="input"
            :class="{ 'input-error': errors.name }"
            placeholder="请输入用户名"
            maxlength="20"
            aria-label="用户名"
            aria-required="true"
            :aria-describedby="errors.name ? 'name-error' : undefined"
          />
          <span v-if="errors.name" id="name-error" class="error-msg">{{ errors.name }}</span>
        </div>
      </div>

      <!-- 个人简介 -->
      <div class="form-item">
        <span class="label">个人简介</span>
        <div class="input-wrapper">
          <textarea
            v-model="form.desc"
            class="textarea"
            :class="{ 'input-error': errors.desc }"
            placeholder="介绍一下自己…"
            rows="3"
            maxlength="200"
            aria-label="个人简介"
            aria-required="true"
            :aria-describedby="errors.desc ? 'desc-error' : undefined"
          ></textarea>
          <div class="textarea-footer">
            <span v-if="errors.desc" id="desc-error" class="error-msg">{{ errors.desc }}</span>
            <span class="char-count">{{ form.desc.length }}/200</span>
          </div>
        </div>
      </div>

      <!-- 修改密码（仅管理员可见） -->
      <template v-if="currentIsAdmin()">
        <div class="section-divider">
          <span class="section-label">修改密码</span>
        </div>

        <!-- 旧密码 -->
        <div class="form-item">
          <span class="label">旧密码</span>
          <div class="input-wrapper">
            <input
              v-model="pwdForm.oldPassword"
              type="password"
              class="input"
              placeholder="输入旧密码"
              maxlength="32"
              aria-label="旧密码"
              aria-required="true"
              :aria-describedby="pwdErrors.oldPassword ? 'oldpwd-error' : undefined"
            />
            <span v-if="pwdErrors.oldPassword" id="oldpwd-error" class="error-msg">{{ pwdErrors.oldPassword }}</span>
          </div>
        </div>

        <!-- 新密码 -->
        <div class="form-item">
          <span class="label">新密码</span>
          <div class="input-wrapper">
            <input
              v-model="pwdForm.newPassword"
              type="password"
              class="input"
              placeholder="输入新密码（至少6位）"
              maxlength="32"
              aria-label="新密码"
              aria-required="true"
              :aria-describedby="pwdErrors.newPassword ? 'newpwd-error' : undefined"
            />
            <span v-if="pwdErrors.newPassword" id="newpwd-error" class="error-msg">{{ pwdErrors.newPassword }}</span>
          </div>
        </div>

        <!-- 确认新密码 -->
        <div class="form-item">
          <span class="label">确认密码</span>
          <div class="input-wrapper">
            <input
              v-model="pwdForm.confirmPassword"
              type="password"
              class="input"
              placeholder="再次输入新密码"
              maxlength="32"
              aria-label="确认密码"
              aria-required="true"
              :aria-describedby="pwdErrors.confirmPassword ? 'confirmpwd-error' : undefined"
            />
            <span v-if="pwdErrors.confirmPassword" id="confirmpwd-error" class="error-msg">{{ pwdErrors.confirmPassword }}</span>
          </div>
        </div>

        <!-- 修改密码按钮 -->
        <button
          class="change-pwd-btn"
          :disabled="pwdChanging"
          @click="handleChangePassword"
        >
          {{ pwdChanging ? '修改中…' : '修改密码' }}
        </button>
      </template>

    </div>
  </main>
</template>

<style scoped>
.edit-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding-bottom: 40px;
}

/* --- 1. 顶部 --- */
.edit-header {
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
  background: none;
  border: none;
  padding: 0;
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.save-btn {
  font-size: 14px;
  color: #fff;
  background: var(--color-primary);
  border: none;
  padding: 6px 16px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}
.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.save-btn:active:not(:disabled) {
  opacity: 0.8;
}

/* --- 2. 加载骨架 --- */
.loading-box {
  padding: 40px 20px;
}
.skeleton {
  background: var(--color-border);
  border-radius: 8px;
  animation: pulse 1.5s infinite;
}
.skeleton-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  margin: 0 auto 20px auto;
}
.skeleton-line {
  height: 16px;
  margin-bottom: 12px;
}
.skeleton-line.short {
  width: 60%;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* --- 3. 加载失败 --- */
.error-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
}
.error-text {
  font-size: 15px;
  color: var(--color-text-tertiary);
  margin-bottom: 16px;
}
.retry-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 10px 32px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

/* --- 4. 表单 --- */
.edit-form {
  padding: 20px 16px;
}
.form-item {
  background: var(--color-bg-card);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.form-item .label {
  width: 80px;
  font-size: 15px;
  color: var(--color-text-body);
  font-weight: 500;
  flex-shrink: 0;
}
.form-item .value.readonly {
  flex: 1;
  font-size: 15px;
  color: var(--color-text-tertiary);
  text-align: right;
}
.input-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.form-item .input,
.form-item .textarea {
  width: 100%;
  border: none;
  outline: none;
  font-size: 15px;
  color: var(--color-text-body);
  background: transparent;
  text-align: right;
  font-family: inherit;
  box-sizing: border-box;
}
.form-item .input::placeholder,
.form-item .textarea::placeholder {
  color: var(--color-text-tertiary);
}
.form-item .textarea {
  text-align: left;
  resize: none;
  line-height: 1.5;
}
.input-error {
  /* 输入框本身不加红框，通过下方 error-msg 提示 */
}
.error-msg {
  font-size: 12px;
  color: var(--color-error);
  margin-top: 4px;
  text-align: right;
}
.textarea-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
}
.char-count {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-left: auto;
}

/* --- 头像 --- */
.avatar-item {
  cursor: pointer;
  user-select: none;
}
.avatar-item:active {
  background: var(--color-bg-card);
}
.avatar-box {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: var(--color-primary);
  color: #fff;
  font-size: 22px;
  font-weight: bold;
}
.avatar-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;
}
.avatar-box:hover .avatar-overlay {
  opacity: 1;
}
.camera-icon {
  font-size: 18px;
  pointer-events: none;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
}

/* --- 修改密码区域 --- */
.section-divider {
  padding: 8px 0 4px 16px;
  margin-top: 8px;
}
.section-label {
  font-size: 13px;
  color: var(--color-text-tertiary);
  font-weight: 500;
}
.change-pwd-btn {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 12px 0;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}
.change-pwd-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.change-pwd-btn:active:not(:disabled) {
  opacity: 0.8;
}
</style>
