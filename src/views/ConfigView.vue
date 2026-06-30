<!-- src/views/ConfigView.vue -->
<!-- 系统配置 — 超级管理员可修改平台参数 -->
<script setup>
import { ref, reactive, onMounted, inject, computed } from 'vue'
import { useRouter } from 'vue-router'
import { getTenantConfig, updateTenantConfig as updateTenantConfigApi, uploadLogo, deleteLogo } from '../api/tenant.js'
import { PhArrowLeft, PhTag, PhX, PhUpload } from '@phosphor-icons/vue'

const router = useRouter()
const toast = inject('showToast', null)

// ==================== 表单数据 ====================
const form = reactive({
  name: '',
  subtitle: '',
  logoUrl: '',
  orgType: '',
})

// ==================== 部门管理 ====================
const departments = ref([])

const loadConfig = async () => {
  try {
    const config = await getTenantConfig()
    form.name = config.name || ''
    form.subtitle = config.subtitle || '经验沉淀 · 故障智搜'
    form.logoUrl = config.logoUrl || ''
    form.orgType = config.orgType || '企业'
    departments.value = config.departments || []
  } catch (err) {
    console.warn('加载配置失败:', err.message || err)
    toast?.('加载配置失败，请检查网络', 'error')
  }
}

onMounted(() => { loadConfig() })

// ==================== Logo 上传 ====================
const logoFileInput = ref(null)
const logoUploading = ref(false)
const logoPreview = ref('')   // 本地预览 blob URL（未保存时用）

// 当前展示的 logo：优先本地预览，其次已保存的 url
const displayLogo = computed(() => logoPreview.value || form.logoUrl || '')
const hasLogo = computed(() => !!displayLogo.value)

// 允许的格式与大小
const LOGO_ACCEPT = '.jpg,.jpeg,.png,.svg,.webp'
const LOGO_MAX_SIZE = 2 * 1024 * 1024 // 2MB

/** 点击上传按钮 → 触发隐藏的 file input */
const triggerFileInput = () => {
  logoFileInput.value?.click()
}

/** 文件选择后校验并预览 */
const handleLogoFileChange = (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  // 校验格式
  const ext = file.name.split('.').pop()?.toLowerCase()
  const allowed = ['jpg', 'jpeg', 'png', 'svg', 'webp']
  if (!allowed.includes(ext)) {
    toast?.('Logo 仅支持 JPG/PNG/SVG/WebP 格式', 'error')
    return
  }

  // 校验大小
  if (file.size > LOGO_MAX_SIZE) {
    toast?.('Logo 文件不能超过 2MB', 'error')
    return
  }

  // 本地预览
  const blobUrl = URL.createObjectURL(file)
  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
  logoPreview.value = blobUrl

  // 立即上传
  uploadCurrentLogo(file)
}

/** 上传当前选中的文件到后端 */
const uploadCurrentLogo = async (file) => {
  if (logoUploading.value) return
  logoUploading.value = true

  try {
    const fd = new FormData()
    fd.append('logo', file)
    const result = await uploadLogo(fd)
    form.logoUrl = result.url || '/logo'
    toast?.('Logo 上传成功！', 'success')
  } catch (err) {
    toast?.(err.message || 'Logo 上传失败', 'error')
    // 回滚预览
    if (logoPreview.value) {
      URL.revokeObjectURL(logoPreview.value)
      logoPreview.value = ''
    }
  } finally {
    logoUploading.value = false
  }
}

/** 恢复默认 Logo */
const handleRestoreDefault = async () => {
  try {
    await deleteLogo()
    form.logoUrl = ''
    if (logoPreview.value) {
      URL.revokeObjectURL(logoPreview.value)
      logoPreview.value = ''
    }
    toast?.('已恢复默认 Logo', 'success')
  } catch (err) {
    toast?.(err.message || '操作失败', 'error')
  }
}

const newDeptName = ref('')

const addDepartment = () => {
  const name = newDeptName.value.trim()
  if (!name) return
  if (departments.value.some(d => d.name === name)) {
    toast?.('部门已存在', 'error')
    return
  }
  const maxId = departments.value.reduce((max, d) => Math.max(max, d.id), 0)
  departments.value.push({ id: maxId + 1, name, active: true })
  newDeptName.value = ''
}

const removeDepartment = (index) => {
  departments.value.splice(index, 1)
}

const onDeptKeyup = (e) => {
  if (e.key === 'Enter') addDepartment()
}

// ==================== 保存 ====================
const saving = ref(false)

const handleSave = async () => {
  if (!form.name.trim()) {
    toast?.('请输入平台名称', 'error')
    return
  }
  if (saving.value) return
  saving.value = true

  const data = {
    name: form.name.trim(),
    subtitle: form.subtitle.trim(),
    logoUrl: form.logoUrl.trim(),
    departments: departments.value,
  }

  try {
    await updateTenantConfigApi(data)
    toast?.('配置保存成功！', 'success')
  } catch (err) {
    toast?.(err.message || '保存失败', 'error')
    saving.value = false
    return
  }

  saving.value = false
}

// ==================== 导航 ====================
const goBack = () => router.back()
</script>

<template>
  <main class="config-page" aria-label="租户配置">

    <!-- 顶部导航 -->
    <header class="page-header">
      <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter="goBack" @keydown.space.prevent="goBack"><PhArrowLeft :size="18" class="back-icon" /> 返回</span>
      <span class="title">系统配置</span>
      <button
        class="save-btn"
        :disabled="saving"
        @click="handleSave"
      >
        {{ saving ? '保存中…' : '保存' }}
      </button>
    </header>

    <!-- 表单区 -->
    <div class="form-body">

      <!-- 平台名称 -->
      <div class="form-card">
        <label class="form-label" for="config-name">平台名称</label>
        <input
          id="config-name"
          v-model="form.name"
          type="text"
          class="form-input"
          placeholder="如：工控技术库"
          maxlength="30"
          aria-label="平台名称"
        />
        <p class="field-hint">显示在登录页和页面标题</p>
      </div>

      <!-- 平台副标题 -->
      <div class="form-card">
        <label class="form-label" for="config-subtitle">副标题</label>
        <input
          id="config-subtitle"
          v-model="form.subtitle"
          type="text"
          class="form-input"
          placeholder="如：经验沉淀 · 故障智搜"
          maxlength="30"
          aria-label="平台副标题"
        />
        <p class="field-hint">显示在登录页和搜索页品牌区域</p>
      </div>

      <!-- 平台 Logo -->
      <div class="form-card">
        <label class="form-label">平台 Logo</label>

        <!-- 隐藏的文件选择器 -->
        <input
          ref="logoFileInput"
          type="file"
          :accept="LOGO_ACCEPT"
          class="logo-file-input"
          aria-label="选择 Logo 文件"
          @change="handleLogoFileChange"
        />

        <!-- Logo 预览区域 -->
        <div class="logo-preview-box" :class="{ 'has-logo': hasLogo }">
          <!-- 已上传：显示图片 -->
          <img v-if="hasLogo" :src="displayLogo" class="logo-img" alt="平台 Logo" />
          <!-- 空状态：默认图标 -->
          <template v-else>
            <svg class="logo-default-icon" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="40" cy="40" r="34" stroke="#94A3B8" stroke-width="2.5" fill="none" />
              <g stroke="#94A3B8" stroke-width="2.5" stroke-linecap="round">
                <line x1="40" y1="2"  x2="40" y2="10" />
                <line x1="40" y1="70" x2="40" y2="78" />
                <line x1="2"  y1="40" x2="10" y2="40" />
                <line x1="70" y1="40" x2="78" y2="40" />
                <line x1="13.1" y1="13.1" x2="18.8" y2="18.8" />
                <line x1="61.2" y1="61.2" x2="66.9" y2="66.9" />
                <line x1="66.9" y1="13.1" x2="61.2" y2="18.8" />
                <line x1="18.8" y1="61.2" x2="13.1" y2="66.9" />
              </g>
              <circle cx="40" cy="40" r="18" stroke="#94A3B8" stroke-width="1.5" fill="none" opacity="0.5" />
              <rect x="30" y="30" width="20" height="20" rx="3" fill="#94A3B8" opacity="0.6" />
              <g stroke="#94A3B8" stroke-width="2" stroke-linecap="round">
                <line x1="40" y1="21" x2="40" y2="28" />
                <line x1="40" y1="52" x2="40" y2="59" />
                <line x1="21" y1="40" x2="28" y2="40" />
                <line x1="52" y1="40" x2="59" y2="40" />
              </g>
              <circle cx="40" cy="40" r="3" fill="#F8FAFC" />
            </svg>
            <span class="logo-empty-text">暂无 Logo</span>
          </template>
        </div>

        <!-- 操作按钮行 -->
        <div class="logo-actions">
          <button
            v-if="hasLogo"
            class="logo-btn logo-btn-change"
            :disabled="logoUploading"
            @click="triggerFileInput"
          >
            {{ logoUploading ? '上传中…' : '更换图片' }}
          </button>
          <button
            v-else
            class="logo-btn logo-btn-upload"
            :disabled="logoUploading"
            @click="triggerFileInput"
          >
            <PhUpload :size="16" />
            {{ logoUploading ? '上传中…' : '上传图片' }}
          </button>

          <button
            v-if="hasLogo"
            class="logo-btn-text logo-btn-restore"
            @click="handleRestoreDefault"
          >
            恢复默认
          </button>
        </div>

        <p class="field-hint">建议上传透明背景 PNG 或白底正方形图片，尺寸 120×120px，最大 2MB</p>
      </div>

      <!-- 组织类型（只读） -->
      <div class="form-card">
        <label class="form-label" for="config-orgtype">组织类型</label>
        <input
          id="config-orgtype"
          :value="form.orgType === 'factory' ? '工厂' : form.orgType === 'equipment_company' ? '非标设备公司' : form.orgType"
          type="text"
          class="form-input"
          readonly
          disabled
          aria-label="组织类型"
        />
        <p class="field-hint">由系统部署时设定，不可修改</p>
      </div>

      <!-- 部门管理 -->
      <div class="form-card">
        <label class="form-label">部门列表</label>
        <div class="dept-list">
          <div
            v-for="(dept, index) in departments"
            :key="dept.id"
            class="dept-row"
          >
            <span class="dept-name">{{ dept.name }}</span>
            <span
              v-if="departments.length > 1"
              class="dept-remove"
              role="button"
              tabindex="0"
              aria-label="删除部门"
              @click="removeDepartment(index)"
              @keydown.enter="removeDepartment(index)"
              @keydown.space.prevent="removeDepartment(index)"
            ><PhX :size="12" /></span>
          </div>
        </div>

        <!-- 空状态 -->
        <p v-if="departments.length === 0" class="field-hint" style="margin-top: 0;">暂无部门，请在下方添加</p>

        <!-- 添加部门 -->
        <div class="add-dept-row">
          <input
            v-model="newDeptName"
            type="text"
            class="form-input add-dept-input"
            placeholder="输入部门名称"
            maxlength="20"
            aria-label="部门名称"
            @keyup="onDeptKeyup"
          />
          <span class="add-dept-btn" role="button" tabindex="0" aria-label="添加部门" @click="addDepartment" @keydown.enter="addDepartment" @keydown.space.prevent="addDepartment">+ 添加</span>
        </div>
        <p class="field-hint">部门用于用户账号归属分类</p>
      </div>

      <!-- 分类标签提示 -->
      <div class="form-card hint-card">
        <label class="form-label"><PhTag :size="18" /> 分类标签</label>
        <p class="hint-text">
          分类标签的增删改请在
          <span class="link-text" role="button" tabindex="0" @click="router.push('/search?admin=1')" @keydown.enter="router.push('/search?admin=1')" @keydown.space.prevent="router.push('/search?admin=1')">搜索页标签管理</span>
          中操作。
        </p>
      </div>

    </div>

  </main>
</template>

<style scoped>
.config-page {
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
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 15px;
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
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
.save-btn {
  font-size: 14px;
  color: #fff;
  background: var(--color-primary);
  border: none;
  height: 44px;
  padding: 0 18px;
  border-radius: var(--radius-btn);
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.2s;
}
.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.save-btn:active:not(:disabled) {
  opacity: 0.8;
}

/* --- 表单主体 --- */
.form-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}
.form-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow-card);
}
.form-label {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 10px;
}
.form-input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  padding: 10px 12px;
  font-size: 15px;
  color: var(--color-text-body);
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  transition: border-color 0.2s;
}
.form-input:focus {
  border-color: var(--color-primary);
}
.form-input:disabled {
  background: var(--color-bg-page);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
}
.form-input::placeholder {
  color: var(--color-text-tertiary);
}
.field-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin: 8px 0 0 0;
}

/* --- 部门列表 --- */
.dept-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.dept-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: var(--radius-full);
  font-size: 13px;
  font-weight: 500;
}
.dept-remove {
  display: flex;
  align-items: center;
  font-size: 12px;
  cursor: pointer;
  padding: 0 2px;
  color: var(--color-text-tertiary);
  transition: color 0.15s;
}
.dept-remove:hover {
  color: var(--color-error);
}

/* --- 添加部门 --- */
.add-dept-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.add-dept-input {
  flex: 1;
}
.add-dept-btn {
  font-size: 14px;
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0;
  user-select: none;
  transition: opacity 0.15s;
}
.add-dept-btn:active { opacity: 0.7; }

/* --- 提示卡片 --- */
.hint-card {
  background: var(--color-warning-bg);
}
.hint-text {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.6;
}
.link-text {
  color: var(--color-primary);
  cursor: pointer;
  font-weight: 500;
}
.link-text:hover {
  text-decoration: underline;
}

/* ==================== Logo 上传区域 ==================== */

/* 隐藏原生 file input */
.logo-file-input {
  display: none;
}

/* 预览框 — 120x120 圆角卡片 */
.logo-preview-box {
  width: 120px;
  height: 120px;
  border-radius: var(--radius-btn);
  background: var(--color-bg-page);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px dashed var(--color-border);
  transition: border-color 0.2s;
}
.logo-preview-box.has-logo {
  border-style: solid;
  border-color: var(--color-divider);
}

/* 默认图标 */
.logo-default-icon {
  width: 80px;
  height: 80px;
  margin-bottom: 4px;
}
.logo-empty-text {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* Logo 图片 */
.logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 按钮行 */
.logo-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

/* 通用按钮基础 */
.logo-btn {
  height: 36px;
  font-size: 14px;
  color: var(--color-text-secondary);
  background: var(--color-divider);
  border: none;
  border-radius: var(--radius-tag);
  padding: 0 16px;
  cursor: pointer;
  font-family: inherit;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s, opacity 0.15s;
}
.logo-btn:active:not(:disabled) { opacity: 0.8; }
.logo-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* 上传按钮 */
.logo-btn-upload {
  color: var(--color-text-secondary);
  background: var(--color-divider);
}

/* 更换图片按钮 */
.logo-btn-change {
  color: var(--color-text-secondary);
  background: var(--color-divider);
}

/* 恢复默认 — 文字按钮，红色 */
.logo-btn-text {
  font-size: 14px;
  color: var(--color-error);
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  padding: 0;
  transition: opacity 0.15s;
}
.logo-btn-text:active { opacity: 0.7; }
</style>
