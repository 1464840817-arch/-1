<!-- src/views/PublishView.vue -->
<!-- 发布/编辑经验文章 — 支持 ?edit=<id> 编辑模式 -->
<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getCategoryTags } from '../api/tenant.js'
import { createArticle, updateArticle, getArticle } from '../api/article.js'
import { userStore } from '../store/user.js'
import { formatDateTime } from '../utils/date.js'

const router = useRouter()
const route = useRoute()
const toast = inject('showToast', null)

// ==================== 编辑模式检测 ====================
const editId = route.query.edit ? Number(route.query.edit) : null
const isEditMode = computed(() => editId != null)

// ==================== 表单数据 ====================
const form = reactive({
  type: '',
  title: '',
  desc: '',
  steps: [''],
  tags: [],
})

// ==================== 编辑模式：加载已有文章数据 ====================
const loadArticleForEdit = async () => {
  if (!editId) return
  try {
    const article = await getArticle(editId)
    if (!article) {
      toast?.('文章不存在', 'error')
      router.replace('/profile/posts')
      return
    }
    form.type = article.type || ''
    form.title = article.title || ''
    form.desc = article.desc || ''
    form.steps = article.steps && article.steps.length > 0
      ? [...article.steps]
      : ['']
    form.tags = article.tags ? [...article.tags] : []
  } catch {
    toast?.('加载文章失败', 'error')
    router.replace('/profile/posts')
  }
}

// ==================== 分类标签 ====================
const categoryTags = ref([])
const loadTags = async () => {
  try {
    const tags = await getCategoryTags()
    categoryTags.value = tags.filter(t => t.active && t.name !== '全部')
  } catch {
    console.warn('标签加载失败')
  }
}

const toggleTag = (tagName) => {
  const idx = form.tags.indexOf(tagName)
  if (idx >= 0) {
    form.tags.splice(idx, 1)
  } else {
    form.tags.push(tagName)
  }
}

// ==================== 排查步骤 ====================
const addStep = () => {
  form.steps.push('')
}
const removeStep = (index) => {
  if (form.steps.length > 1) {
    form.steps.splice(index, 1)
  }
}

// ==================== 表单校验 ====================
const errors = ref({})
const validate = () => {
  const errs = {}
  if (!form.type.trim()) errs.type = '请输入设备类型或型号'
  if (!form.title.trim()) {
    errs.title = '请输入故障标题'
  } else if (form.title.trim().length < 4) {
    errs.title = '标题至少 4 个字'
  }
  if (!form.desc.trim()) {
    errs.desc = '请描述故障现象'
  } else if (form.desc.trim().length < 10) {
    errs.desc = '故障描述至少 10 个字'
  }
  const validSteps = form.steps.filter(s => s.trim())
  if (validSteps.length === 0) {
    errs.steps = '请至少填写一个排查步骤'
  }
  errors.value = errs
  return Object.keys(errs).length === 0
}

// ==================== 提交 ====================
const submitting = ref(false)

const handleSubmit = async () => {
  if (!validate()) return
  if (submitting.value) return

  submitting.value = true

  if (isEditMode.value) {
    // ===== 编辑模式：更新已有文章 =====
    const updates = {
      type: form.type.trim(),
      title: form.title.trim(),
      desc: form.desc.trim(),
      steps: form.steps.filter(s => s.trim()),
      tags: [...form.tags],
    }

    try {
      await updateArticle(editId, updates)
      toast?.('经验更新成功！', 'success')
      router.push('/profile/posts')
    } catch (err) {
      toast?.(err.message || '更新失败，请稍后重试', 'error')
      submitting.value = false
      return
    }
  } else {
    // ===== 新建模式：创建新文章 =====
    const newArticle = {
      type: form.type.trim(),
      title: form.title.trim(),
      desc: form.desc.trim(),
      steps: form.steps.filter(s => s.trim()),
      tags: [...form.tags],
    }

    try {
      await createArticle(newArticle)
      toast?.('经验发布成功！', 'success')
      router.push('/home')
    } catch (err) {
      toast?.(err.message || '发布失败，请稍后重试', 'error')
      submitting.value = false
      return
    }
  }

  submitting.value = false
}

// ==================== 返回 ====================
const goBack = () => {
  router.back()
}

onMounted(() => {
  loadTags()
  loadArticleForEdit()
})
</script>

<template>
  <main class="publish-page" aria-label="发布经验">

    <!-- 顶部导航 -->
    <header class="publish-header">
      <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack">← 返回</span>
      <span class="title">{{ isEditMode ? '编辑经验' : '发布经验' }}</span>
      <button
        class="publish-btn"
        :disabled="submitting"
        :aria-label="isEditMode ? '保存经验' : '发布经验'"
        @click="handleSubmit"
      >
        {{ submitting ? (isEditMode ? '保存中…' : '发布中…') : (isEditMode ? '保存' : '发布') }}
      </button>
    </header>

    <!-- 表单 -->
    <div class="form-body">

      <!-- 设备类型 -->
      <div class="form-card">
        <label class="form-label" for="field-type">设备类型 / 型号</label>
        <input
          id="field-type"
          v-model="form.type"
          type="text"
          class="form-input"
          :class="{ 'has-error': errors.type }"
          placeholder="如：西门子 S7-1200、汇川 MD380"
          aria-label="设备类型或型号"
          aria-required="true"
          :aria-describedby="errors.type ? 'type-error' : undefined"
        />
        <span v-if="errors.type" id="type-error" class="field-error">{{ errors.type }}</span>
      </div>

      <!-- 故障标题 -->
      <div class="form-card">
        <label class="form-label" for="field-title">故障标题</label>
        <input
          id="field-title"
          v-model="form.title"
          type="text"
          class="form-input"
          :class="{ 'has-error': errors.title }"
          placeholder="一句话概括故障现象"
          maxlength="60"
          aria-label="故障标题"
          aria-required="true"
          :aria-describedby="errors.title ? 'title-error' : undefined"
        />
        <span v-if="errors.title" id="title-error" class="field-error">{{ errors.title }}</span>
      </div>

      <!-- 故障描述 -->
      <div class="form-card">
        <label class="form-label" for="field-desc">故障描述</label>
        <textarea
          id="field-desc"
          v-model="form.desc"
          class="form-textarea"
          :class="{ 'has-error': errors.desc }"
          placeholder="详细描述故障发生的背景、现象、频率…"
          rows="4"
          maxlength="2000"
          aria-label="故障描述"
          aria-required="true"
          :aria-describedby="errors.desc ? 'desc-error' : undefined"
        ></textarea>
        <div class="field-footer">
          <span v-if="errors.desc" id="desc-error" class="field-error">{{ errors.desc }}</span>
          <span class="char-count">{{ form.desc.length }}/2000</span>
        </div>
      </div>

      <!-- 排查步骤 -->
      <div class="form-card">
        <label class="form-label">排查步骤</label>
        <div class="steps-list">
          <div
            v-for="(step, index) in form.steps"
            :key="index"
            class="step-row"
          >
            <span class="step-num">{{ index + 1 }}</span>
            <input
              v-model="form.steps[index]"
              type="text"
              class="form-input step-input"
              :placeholder="`第 ${index + 1} 步：描述操作…`"
              :aria-label="`步骤 ${index + 1}`"
            />
            <span
              v-if="form.steps.length > 1"
              class="step-remove"
              role="button"
              tabindex="0"
              aria-label="删除此步骤"
              @click="removeStep(index)"
              @keydown.enter.prevent="removeStep(index)"
              @keydown.space.prevent="removeStep(index)"
            >✕</span>
          </div>
        </div>
        <span v-if="errors.steps" class="field-error">{{ errors.steps }}</span>
        <button class="add-step-btn" @click="addStep">+ 添加步骤</button>
      </div>

      <!-- 分类标签 -->
      <div class="form-card">
        <label class="form-label">分类标签</label>
        <div class="tag-chips">
          <span
            v-for="tag in categoryTags"
            :key="tag.id"
            class="tag-chip"
            :class="{ 'selected': form.tags.includes(tag.name) }"
            role="checkbox"
            :aria-checked="form.tags.includes(tag.name)"
            tabindex="0"
            @click="toggleTag(tag.name)"
            @keydown.enter.prevent="toggleTag(tag.name)"
            @keydown.space.prevent="toggleTag(tag.name)"
          >
            {{ tag.name }}
          </span>
        </div>
        <p class="field-hint">选择 1~3 个标签，方便同事检索</p>
      </div>

    </div>
  </main>
</template>

<style scoped>
.publish-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding-bottom: 40px;
}

/* --- 顶部导航 --- */
.publish-header {
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
.publish-btn {
  font-size: 14px;
  color: #fff;
  background: var(--color-primary);
  border: none;
  padding: 7px 18px;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}
.publish-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.publish-btn:active:not(:disabled) {
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
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.03);
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
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 15px;
  color: var(--color-text-body);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.form-input:focus {
  border-color: var(--color-primary);
}
.form-input.has-error {
  border-color: var(--color-error);
}
.form-input::placeholder {
  color: var(--color-text-tertiary);
}
.form-textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 15px;
  color: var(--color-text-body);
  outline: none;
  box-sizing: border-box;
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
  transition: border-color 0.2s;
}
.form-textarea:focus {
  border-color: var(--color-primary);
}
.form-textarea.has-error {
  border-color: var(--color-error);
}
.form-textarea::placeholder {
  color: var(--color-text-tertiary);
}

/* --- 错误提示 & 计数字 --- */
.field-error {
  font-size: 12px;
  color: var(--color-error);
}
.field-footer {
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
.field-hint {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin: 8px 0 0 0;
}

/* --- 排查步骤 --- */
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 8px;
}
.step-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}
.step-input {
  flex: 1;
}
.step-remove {
  font-size: 14px;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px;
  flex-shrink: 0;
  transition: color 0.2s;
}
.step-remove:hover {
  color: var(--color-error);
}
.add-step-btn {
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: 8px;
  padding: 8px;
  width: 100%;
  font-size: 14px;
  color: var(--color-primary);
  cursor: pointer;
  transition: background 0.2s;
}
.add-step-btn:active {
  background: var(--color-primary-light);
}

/* --- 分类标签多选 --- */
.tag-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tag-chip {
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 13px;
  background: var(--color-divider);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}
.tag-chip:active {
  transform: scale(0.95);
}
.tag-chip.selected {
  background: var(--color-primary);
  color: #fff;
}
</style>
