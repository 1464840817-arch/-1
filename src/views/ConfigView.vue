<!-- src/views/ConfigView.vue -->
<!-- 系统配置 — 超级管理员可修改平台参数 -->
<script setup>
import { ref, reactive, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { getTenantConfig, updateTenantConfig as updateTenantConfigApi } from '../api/tenant.js'
import { PhArrowLeft, PhTag, PhX } from '@phosphor-icons/vue'

const router = useRouter()
const toast = inject('showToast', null)

// ==================== 表单数据 ====================
const form = reactive({
  name: '',
  logoUrl: '',
  orgType: '',
})

// ==================== 部门管理 ====================
const departments = ref([])

const loadConfig = async () => {
  try {
    const config = await getTenantConfig()
    form.name = config.name || ''
    form.logoUrl = config.logoUrl || ''
    form.orgType = config.orgType || '企业'
    departments.value = config.departments || []
  } catch (err) {
    console.warn('加载配置失败:', err.message || err)
    toast?.('加载配置失败，请检查网络', 'error')
  }
}

onMounted(() => { loadConfig() })
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

      <!-- Logo URL -->
      <div class="form-card">
        <label class="form-label" for="config-logo">平台 Logo URL</label>
        <input
          id="config-logo"
          v-model="form.logoUrl"
          type="text"
          class="form-input"
          placeholder="如：https://example.com/logo.png"
          aria-label="平台 Logo URL"
        />
        <p class="field-hint">可选，留空则使用默认图标</p>
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
  min-height: 100vh;
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
</style>
