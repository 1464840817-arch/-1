<!-- src/views/PublishView.vue -->
<!-- 发布/编辑经验文章 — 支持 ?edit=<id> 编辑模式 + 图片系统 + 排查步骤图片 -->
<script setup>
import { ref, reactive, computed, onMounted, inject, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getCategoryTags } from '../api/tenant.js'
import { createArticle, updateArticle, getArticle } from '../api/article.js'
import { uploadImage } from '../api/upload.js'
import { userStore } from '../store/user.js'
import { formatDateTime } from '../utils/date.js'
import {
  validateImage, compressImage, readAsDataURL,
  createPreviewUrl, revokePreviewUrl, generateLocalId,
  MAX_IMAGE_COUNT, ALLOWED_TYPES,
} from '../utils/image.js'
import {
  PhArrowLeft, PhX, PhPlus, PhImage, PhTextB,
  PhTextItalic, PhLink, PhUploadSimple,
  PhCaretLeft, PhCaretRight, PhDotsSixVertical,
} from '@phosphor-icons/vue'

const router = useRouter()
const route = useRoute()
const toast = inject('showToast', null)

// ==================== 编辑模式检测 ====================
const editId = route.query.edit ? Number(route.query.edit) : null
const isEditMode = computed(() => editId != null)

// ==================== 表单数据 ====================
// 排查步骤: { text: string, image: null | { localId, file, previewUrl, url, serverId, uploading, error } }
const form = reactive({
  type: '',
  title: '',
  desc: '',
  steps: [{ text: '', image: null }],
  tags: [],
})

// ==================== 故障描述图片系统 ====================
const editorEl = ref(null)
const editorWrapper = ref(null)
const fileInput = ref(null)

// 图片列表: { localId, file, previewUrl, serverId, uploading }
const descImages = ref([])

// 从 contenteditable 提取纯文本长度
const plainTextLength = ref(0)

/**
 * 触发文件选择器
 */
function openImagePicker() {
  if (descImages.value.length >= MAX_IMAGE_COUNT) {
    toast?.('最多上传 9 张图片', 'warning')
    return
  }
  fileInput.value?.click()
}

/**
 * 处理文件选择
 */
async function handleImageFiles(e) {
  const files = Array.from(e.target.files || [])
  if (files.length === 0) return

  const remaining = MAX_IMAGE_COUNT - descImages.value.length
  if (files.length > remaining) {
    toast?.(`最多还能上传 ${remaining} 张图片`, 'warning')
  }

  const toProcess = files.slice(0, remaining)

  for (const file of toProcess) {
    // 校验
    const validation = validateImage(file)
    if (!validation.valid) {
      toast?.(validation.error, 'error')
      continue
    }

    const localId = generateLocalId()

    // 添加到图片列表（上传中状态）
    const imageEntry = {
      localId,
      file,
      previewUrl: '',
      serverId: null,
      uploading: true,
    }
    descImages.value.push(imageEntry)

    try {
      // 压缩
      const compressed = await compressImage(file)
      const previewUrl = createPreviewUrl(compressed)
      imageEntry.previewUrl = previewUrl
      imageEntry.file = compressed
      imageEntry.uploading = false

      // 插入到编辑器
      await nextTick()
      insertImageAtCursor(localId, previewUrl)
    } catch (err) {
      // 压缩失败，使用原图
      const previewUrl = createPreviewUrl(file)
      imageEntry.previewUrl = previewUrl
      imageEntry.uploading = false

      await nextTick()
      insertImageAtCursor(localId, previewUrl)
    }
  }

  // 重置 input
  if (fileInput.value) fileInput.value.value = ''
}

/**
 * 在 contenteditable 光标位置插入图片
 */
function insertImageAtCursor(localId, previewUrl) {
  const el = editorEl.value
  if (!el) return

  el.focus()

  // 确保光标在编辑器内
  const sel = window.getSelection()
  let range
  if (sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
    // 光标不在编辑器内，放到末尾
    range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    range = sel.getRangeAt(0)
  }

  const img = document.createElement('img')
  img.src = previewUrl
  img.setAttribute('data-image-id', localId)
  img.setAttribute('contenteditable', 'false')
  img.style.cssText =
    'display:block;width:100%;max-height:200px;border-radius:8px;background:#F1F5F9;object-fit:contain;margin:8px 0;cursor:pointer;'

  // 在图片前后加换行（用 br）
  const brBefore = document.createElement('br')
  const brAfter = document.createElement('br')

  range.insertNode(brAfter)
  range.insertNode(img)
  range.insertNode(brBefore)

  // 把光标放到图片后面
  range.setStartAfter(brAfter)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)

  updateCharCount()
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * 删除图片
 */
function removeImage(index) {
  const img = descImages.value[index]
  if (!img) return

  // 从 contenteditable 移除对应的 img 元素
  const el = editorEl.value
  if (el) {
    const imgEl = el.querySelector(`img[data-image-id="${img.localId}"]`)
    if (imgEl) {
      // 也移除相邻的 br
      const prev = imgEl.previousSibling
      const next = imgEl.nextSibling
      if (prev && prev.nodeName === 'BR') prev.remove()
      if (next && next.nodeName === 'BR') next.remove()
      imgEl.remove()
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  // 释放 blob URL
  revokePreviewUrl(img.previewUrl)
  descImages.value.splice(index, 1)
  updateCharCount()
}

/**
 * 滚动到指定图片
 */
function scrollToImage(localId) {
  const el = editorEl.value
  if (!el) return

  const imgEl = el.querySelector(`img[data-image-id="${localId}"]`)
  if (!imgEl) return

  // 滚动到图片位置
  imgEl.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // 高亮
  imgEl.style.outline = '2px solid #2563EB'
  imgEl.style.outlineOffset = '2px'
  setTimeout(() => {
    imgEl.style.outline = ''
    imgEl.style.outlineOffset = ''
  }, 1500)
}

/**
 * 从 contenteditable 序列化内容为纯文本 + [image:id] 标记
 */
function serializeContent() {
  const el = editorEl.value
  if (!el) return ''

  let result = ''
  walkNodes(el, (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
      const imageId = node.getAttribute('data-image-id')
      if (imageId) {
        // 查找对应的图片，获取 url 或 localId
        const imgData = descImages.value.find(i => i.localId === imageId)
        const marker = imgData?.url || imgData?.localId || imageId
        result += `[image:${marker}]`
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'BR') {
      result += '\n'
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'DIV') {
      result += '\n'
    }
  })

  return result.trim()
}

/**
 * 递归遍历 DOM 节点
 */
function walkNodes(node, callback) {
  if (!node) return
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE || child.tagName === 'IMG' || child.tagName === 'BR') {
      callback(child)
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      walkNodes(child, callback)
    }
  }
}

/**
 * 将文本 + [image:id] 标记反序列化到 contenteditable
 */
function deserializeContent(text, images) {
  const el = editorEl.value
  if (!el) return

  el.innerHTML = ''

  if (!text) {
    updateCharCount()
    return
  }

  // 按 [image:id] 分割文本
  const parts = text.split(/(\[image:[^\]]+\])/g)

  for (const part of parts) {
    const match = part.match(/^\[image:([^\]]+)\]$/)
    if (match) {
      const imageId = match[1]
      // 查找图片数据
      const imgData = images?.find(i => i.serverId === imageId || i.localId === imageId)
      const src = imgData?.previewUrl || imgData?.url || ''

      const img = document.createElement('img')
      img.src = src
      img.setAttribute('data-image-id', imageId)
      img.setAttribute('contenteditable', 'false')
      img.style.cssText =
        'display:block;width:100%;max-height:200px;border-radius:8px;background:#F1F5F9;object-fit:contain;margin:8px 0;cursor:pointer;'

      el.appendChild(img)
    } else if (part.trim()) {
      // 文本节点：按换行分割
      const lines = part.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
          el.appendChild(document.createElement('br'))
        }
        if (lines[i]) {
          el.appendChild(document.createTextNode(lines[i]))
        }
      }
    }
  }

  updateCharCount()
}

/**
 * 更新字数统计
 */
function updateCharCount() {
  const text = serializeContent()
  // 移除图片标记后计算纯文本长度
  const plainText = text.replace(/\[image:[^\]]+\]/g, '')
  plainTextLength.value = plainText.length
}

/**
 * 编辑器输入事件
 */
function onEditorInput() {
  updateCharCount()

  // 检测被删除的图片（清理 descImages）
  const el = editorEl.value
  if (!el) return

  const existingImgIds = new Set()
  el.querySelectorAll('img[data-image-id]').forEach(img => {
    existingImgIds.add(img.getAttribute('data-image-id'))
  })

  // 移除 DOM 中已不存在的图片
  descImages.value = descImages.value.filter(img => {
    if (!existingImgIds.has(img.localId)) {
      revokePreviewUrl(img.previewUrl)
      return false
    }
    return true
  })
}

/**
 * 编辑器粘贴事件 — 仅允许纯文本
 */
function onEditorPaste(e) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') || ''
  if (text) {
    // 插入纯文本
    const sel = window.getSelection()
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(document.createTextNode(text))
      range.collapse(false)
    }
  }
}

/**
 * 工具栏：加粗
 */
function insertBold() {
  wrapSelection('**', '**')
}

/**
 * 工具栏：斜体
 */
function insertItalic() {
  wrapSelection('*', '*')
}

/**
 * 工具栏：插入链接
 */
function insertLink() {
  const url = prompt('请输入链接 URL：', 'https://')
  if (!url) return
  const sel = window.getSelection()
  const selectedText = sel?.toString() || '链接'
  wrapSelection('[', `](${url})`)
}

/**
 * 用标记包裹选中文本
 */
function wrapSelection(prefix, suffix) {
  const el = editorEl.value
  if (!el) return
  el.focus()

  const sel = window.getSelection()
  if (sel.rangeCount === 0 || !el.contains(sel.anchorNode)) return

  const range = sel.getRangeAt(0)
  const selectedText = range.toString()

  if (selectedText) {
    // 有选中文本：包裹
    range.deleteContents()
    const textNode = document.createTextNode(prefix + selectedText + suffix)
    range.insertNode(textNode)
    // 选中包裹后的文本
    range.selectNodeContents(textNode)
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    // 无选中文本：插入占位符
    const placeholder = prefix + '文本' + suffix
    const textNode = document.createTextNode(placeholder)
    range.insertNode(textNode)
    range.selectNodeContents(textNode)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  el.dispatchEvent(new Event('input', { bubbles: true }))
  updateCharCount()
}

// ==================== 排查步骤图片 ====================
const activeStepImageIndex = ref(-1)
const stepFileInput = ref(null)

/**
 * 触发步骤图片选择器
 */
function openStepImagePicker(index) {
  if (form.steps[index]?.image?.file) {
    // 已有图片，不重复添加（每步最多 1 张）
    return
  }
  activeStepImageIndex.value = index
  stepFileInput.value?.click()
}

/**
 * 处理步骤图片文件选择
 */
async function handleStepImageFile(e) {
  const files = e.target.files || []
  if (files.length === 0) {
    activeStepImageIndex.value = -1
    return
  }

  const index = activeStepImageIndex.value
  const file = files[0]

  // 重置
  activeStepImageIndex.value = -1
  if (stepFileInput.value) stepFileInput.value.value = ''

  if (index < 0 || index >= form.steps.length) return

  // 校验
  const validation = validateImage(file)
  if (!validation.valid) {
    toast?.(validation.error, 'error')
    return
  }

  const localId = generateLocalId()

  // 设置上传中状态
  form.steps[index].image = {
    localId,
    file,
    previewUrl: '',
    url: '',
    serverId: null,
    uploading: true,
    error: false,
  }

  try {
    // 压缩
    const compressed = await compressImage(file)
    const previewUrl = createPreviewUrl(compressed)
    form.steps[index].image = {
      ...form.steps[index].image,
      previewUrl,
      file: compressed,
      uploading: false,
    }
  } catch {
    // 压缩失败，使用原图
    const previewUrl = createPreviewUrl(file)
    form.steps[index].image = {
      ...form.steps[index].image,
      previewUrl,
      uploading: false,
    }
  }
}

/**
 * 删除步骤图片
 */
function removeStepImage(index) {
  const img = form.steps[index]?.image
  if (!img) return
  revokePreviewUrl(img.previewUrl)
  form.steps[index].image = null
}

/**
 * 重试步骤图片上传
 */
function retryStepImage(index) {
  const img = form.steps[index]?.image
  if (!img || !img.file) return
  img.uploading = true
  img.error = false

  compressImage(img.file)
    .then(compressed => {
      const previewUrl = createPreviewUrl(compressed)
      img.previewUrl = previewUrl
      img.file = compressed
      img.uploading = false
    })
    .catch(() => {
      const previewUrl = createPreviewUrl(img.file)
      img.previewUrl = previewUrl
      img.uploading = false
    })
}

// ==================== 步骤拖拽排序 ====================
const dragState = reactive({
  active: false,
  sourceIndex: -1,
  targetIndex: -1,
})

/**
 * 拖拽开始
 */
function onStepDragStart(e, index) {
  dragState.sourceIndex = index
  dragState.active = true
  // 设置拖拽数据（Firefox 需要）
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', String(index))
  // 延迟添加样式（让浏览器拍快照）
  requestAnimationFrame(() => {
    const el = e.target.closest('.step-block')
    if (el) el.classList.add('is-dragging')
  })
}

/**
 * 拖拽经过
 */
function onStepDragOver(e, index) {
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  if (index !== dragState.targetIndex) {
    // 移除旧指示线
    dragState.targetIndex = index
  }
}

/**
 * 拖拽离开
 */
function onStepDragLeave(e) {
  // no-op — targetIndex 由 dragover 覆盖
}

/**
 * 放置
 */
function onStepDrop(e, dropIndex) {
  e.preventDefault()
  const sourceIndex = dragState.sourceIndex
  if (sourceIndex < 0 || sourceIndex === dropIndex) {
    resetDragState()
    return
  }

  // 从数组中移动步骤
  const [moved] = form.steps.splice(sourceIndex, 1)
  form.steps.splice(dropIndex, 0, moved)

  resetDragState()
}

/**
 * 拖拽结束（清理）
 */
function onStepDragEnd(e) {
  const el = e.target.closest('.step-block')
  if (el) el.classList.remove('is-dragging')
  resetDragState()
}

function resetDragState() {
  dragState.active = false
  dragState.sourceIndex = -1
  dragState.targetIndex = -1
  // 清除所有 drop 指示器
  document.querySelectorAll('.step-block.is-drop-target').forEach(el => {
    el.classList.remove('is-drop-target')
  })
}

// ==================== 全屏灯箱 ====================
const lightbox = reactive({
  visible: false,
  url: '',
  index: 0,
})

// 收集所有步骤图片 URL
const allStepImages = computed(() => {
  return form.steps
    .map((s, i) => ({ index: i, src: s.image?.previewUrl || s.image?.url || null }))
    .filter(item => item.src)
})

function openLightbox(imageData) {
  const src = imageData?.previewUrl || imageData?.url
  if (!src) return

  const all = allStepImages.value
  const idx = all.findIndex(item => item.src === src)
  lightbox.url = src
  lightbox.index = idx >= 0 ? idx : 0
  lightbox.visible = true
}

function closeLightbox() {
  lightbox.visible = false
  lightbox.url = ''
  lightbox.index = 0
}

function navigateLightbox(direction) {
  const all = allStepImages.value
  if (all.length === 0) return
  lightbox.index = (lightbox.index + direction + all.length) % all.length
  lightbox.url = all[lightbox.index].src
}

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

    // 加载步骤 — 兼容字符串数组和对象数组
    if (article.steps && article.steps.length > 0) {
      form.steps = article.steps.map(s => {
        if (typeof s === 'string') {
          return { text: s, image: null }
        }
        return {
          text: s.text || '',
          image: s.image ? {
            localId: s.image,
            file: null,
            previewUrl: s.image,
            url: s.image,
            serverId: null,
            uploading: false,
            error: false,
          } : null,
        }
      })
    } else {
      form.steps = [{ text: '', image: null }]
    }

    form.tags = article.tags ? [...article.tags] : []

    // 解析 [image:url] 标记，构建图片列表
    if (article.desc) {
      const imageMatches = article.desc.match(/\[image:([^\]]+)\]/g)
      if (imageMatches) {
        const images = imageMatches.map(match => {
          const value = match.slice(7, -1) // 提取 [image:xxx] 中的 xxx
          // value 可能是: 完整 URL (/uploads/uuid.ext) 或仅 UUID 或 本地临时 ID
          const isUrl = value.startsWith('/uploads/')
          const isUuid = value.includes('-') && value.length > 30
          return {
            localId: value,
            file: null,
            previewUrl: isUrl ? value : '',
            url: isUrl ? value : (isUuid ? `/uploads/${value}` : ''),
            serverId: isUrl ? value.split('/').pop().split('.')[0] : (isUuid ? value : null),
            uploading: false,
          }
        })

        for (const img of images) {
          if (img.url) {
            img.previewUrl = img.url
          }
        }

        descImages.value = images
        await nextTick()
        deserializeContent(article.desc, images)
      } else {
        await nextTick()
        deserializeContent(article.desc, [])
      }
    }
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

// ==================== 排查步骤操作 ====================
const addStep = () => {
  form.steps.push({ text: '', image: null })
}

const removeStep = (index) => {
  if (form.steps.length > 1) {
    // 清理图片 blob URL
    revokePreviewUrl(form.steps[index]?.image?.previewUrl)
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

  // 校验 desc：序列化后的内容（去掉图片标记）
  const plainText = serializeContent().replace(/\[image:[^\]]+\]/g, '').trim()
  if (!plainText) {
    errs.desc = '请描述故障现象'
  } else if (plainText.length < 10) {
    errs.desc = '故障描述至少 10 个字'
  }

  const validSteps = form.steps.filter(s => s.text.trim())
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

  try {
    // 1. 上传所有未上传的故障描述图片
    for (const img of descImages.value) {
      if (!img.serverId && img.file) {
        img.uploading = true
        try {
          const result = await uploadImage(img.file, 'image.jpg')
          img.serverId = result.id
          img.url = result.url
          // 更新 contenteditable 中 img 的 data-image-id 为 URL
          const el = editorEl.value
          if (el) {
            const oldImg = el.querySelector(`img[data-image-id="${img.localId}"]`)
            if (oldImg) {
              oldImg.setAttribute('data-image-id', result.url)
            }
          }
          // 更新 localId 为 URL 用于后续序列化
          img.localId = result.url
        } catch (err) {
          toast?.(`图片上传失败: ${err.message}`, 'error')
          img.uploading = false
          submitting.value = false
          return
        }
        img.uploading = false
      }
    }

    // 2. 上传所有未上传的步骤图片
    for (const step of form.steps) {
      if (step.image && !step.image.serverId && step.image.file) {
        step.image.uploading = true
        step.image.error = false
        try {
          const result = await uploadImage(step.image.file, 'step.jpg')
          step.image.serverId = result.id
          step.image.url = result.url
          step.image.localId = result.url
          step.image.uploading = false
        } catch (err) {
          step.image.uploading = false
          step.image.error = true
          toast?.(`步骤图片上传失败: ${err.message}`, 'error')
          submitting.value = false
          return
        }
      }
    }

    // 3. 序列化内容（使用 serverId）
    const desc = serializeContent()

    // 4. 构建提交数据 — 步骤序列化为 { text, image: url|null }
    const payloadSteps = form.steps
      .filter(s => s.text.trim())
      .map(s => ({
        text: s.text.trim(),
        image: s.image?.url || s.image?.localId || null,
      }))

    const payload = {
      type: form.type.trim(),
      title: form.title.trim(),
      desc,
      steps: payloadSteps,
      tags: [...form.tags],
    }

    if (isEditMode.value) {
      await updateArticle(editId, payload)
      toast?.('经验更新成功！', 'success')
      router.push('/profile/posts')
    } else {
      await createArticle(payload)
      toast?.('经验发布成功！', 'success')
      router.push('/home')
    }
  } catch (err) {
    toast?.(err.message || '操作失败，请稍后重试', 'error')
    submitting.value = false
  }
}

// ==================== 返回 ====================
const goBack = () => {
  router.back()
}

// ==================== 清理 ====================
onMounted(() => {
  loadTags()
  loadArticleForEdit()
})

// 组件卸载时释放所有 blob URL
import { onBeforeUnmount } from 'vue'
onBeforeUnmount(() => {
  descImages.value.forEach(img => revokePreviewUrl(img.previewUrl))
  form.steps.forEach(s => revokePreviewUrl(s.image?.previewUrl))
})
</script>

<template>
  <main class="publish-page" aria-label="发布经验">

    <!-- 顶部导航 -->
    <header class="publish-header">
      <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter.prevent="goBack" @keydown.space.prevent="goBack"><PhArrowLeft :size="18" class="back-icon" /> 返回</span>
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

      <!-- ==================== 故障描述（图片系统） ==================== -->
      <div class="form-card">
        <label class="form-label">故障描述</label>

        <!-- 编辑器容器 -->
        <div class="editor-wrapper" ref="editorWrapper">
          <div
            ref="editorEl"
            class="editor-content"
            contenteditable="true"
            :data-placeholder="'详细描述故障发生的背景、现象、频率…'"
            @input="onEditorInput"
            @paste="onEditorPaste"
            aria-label="故障描述"
            aria-required="true"
            :aria-describedby="errors.desc ? 'desc-error' : undefined"
          ></div>
        </div>

        <!-- 底部缩略图预览区 -->
        <div v-if="descImages.length > 0" class="thumbnail-strip">
          <div
            v-for="(img, index) in descImages"
            :key="img.localId"
            class="thumbnail-item"
            :class="{ 'is-uploading': img.uploading }"
            @click="scrollToImage(img.localId)"
          >
            <img
              v-if="img.previewUrl"
              :src="img.previewUrl"
              class="thumbnail-img"
              alt="缩略图"
            />
            <div v-else class="thumbnail-skeleton"></div>
            <span class="thumbnail-delete" @click.stop="removeImage(index)">
              <PhX :size="10" />
            </span>
          </div>
          <!-- 添加按钮 -->
          <div
            v-if="descImages.length < MAX_IMAGE_COUNT"
            class="thumbnail-add"
            role="button"
            tabindex="0"
            aria-label="添加图片"
            @click="openImagePicker"
            @keydown.enter.prevent="openImagePicker"
            @keydown.space.prevent="openImagePicker"
          >
            <PhPlus :size="20" />
          </div>
        </div>

        <!-- 底部工具栏 -->
        <div class="editor-toolbar">
          <div class="toolbar-left">
            <button class="tool-btn" type="button" title="加粗 (Ctrl+B)" @click="insertBold">
              <PhTextB :size="16" />
            </button>
            <button class="tool-btn" type="button" title="斜体 (Ctrl+I)" @click="insertItalic">
              <PhTextItalic :size="16" />
            </button>
            <button class="tool-btn" type="button" title="插入链接" @click="insertLink">
              <PhLink :size="16" />
            </button>
          </div>
          <div class="toolbar-right">
            <button
              class="insert-img-btn"
              type="button"
              :disabled="descImages.length >= MAX_IMAGE_COUNT"
              @click="openImagePicker"
            >
              <PhImage :size="14" />
              <span>插入图片</span>
            </button>
          </div>
        </div>

        <!-- 隐藏的文件输入 (故障描述) -->
        <input
          ref="fileInput"
          type="file"
          :accept="ALLOWED_TYPES.join(',')"
          multiple
          class="file-input-hidden"
          @change="handleImageFiles"
        />

        <!-- 错误 + 字数统计 -->
        <div class="field-footer">
          <span v-if="errors.desc" id="desc-error" class="field-error">{{ errors.desc }}</span>
          <span class="char-count">{{ plainTextLength }}/2000</span>
        </div>
      </div>

      <!-- ==================== 排查步骤（图片系统） ==================== -->
      <div class="form-card">
        <label class="form-label">排查步骤</label>
        <div class="steps-list">
          <div
            v-for="(step, index) in form.steps"
            :key="index"
            class="step-block"
            :class="{ 'is-drop-target': dragState.active && dragState.targetIndex === index }"
            draggable="true"
            @dragstart="onStepDragStart($event, index)"
            @dragover="onStepDragOver($event, index)"
            @dragleave="onStepDragLeave($event)"
            @drop="onStepDrop($event, index)"
            @dragend="onStepDragEnd($event)"
          >
            <!-- 步骤行：拖拽手柄 + 序号 + 输入框 + 删除 -->
            <div class="step-row">
              <span
                v-if="form.steps.length > 1"
                class="step-grip"
                aria-label="拖拽排序"
                title="长按拖拽排序"
              >
                <PhDotsSixVertical :size="16" />
              </span>
              <span class="step-num">{{ index + 1 }}</span>
              <input
                v-model="step.text"
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
              ><PhX :size="14" /></span>
            </div>

            <!-- 步骤图片区域 -->
            <div class="step-image-area" :style="{ paddingLeft: form.steps.length > 1 ? '68px' : '36px' }">
              <!-- 无图片：上传入口 -->
              <div
                v-if="!step.image"
                class="step-upload-entry"
                role="button"
                tabindex="0"
                :aria-label="`为步骤 ${index + 1} 添加图片`"
                @click="openStepImagePicker(index)"
                @keydown.enter.prevent="openStepImagePicker(index)"
                @keydown.space.prevent="openStepImagePicker(index)"
              >
                <PhUploadSimple :size="22" />
              </div>

              <!-- 上传中：骨架屏 -->
              <div
                v-else-if="step.image.uploading"
                class="step-thumb step-thumb--loading"
              >
                <div class="step-thumb-skeleton"></div>
              </div>

              <!-- 上传失败：红色边框 + 重试 -->
              <div
                v-else-if="step.image.error"
                class="step-thumb step-thumb--error"
                role="button"
                tabindex="0"
                aria-label="重新上传图片"
                @click="retryStepImage(index)"
                @keydown.enter.prevent="retryStepImage(index)"
                @keydown.space.prevent="retryStepImage(index)"
              >
                <img
                  v-if="step.image.previewUrl"
                  :src="step.image.previewUrl"
                  class="step-thumb-img"
                  alt="上传失败"
                />
                <div v-else class="step-thumb-skeleton"></div>
                <span class="step-thumb-retry">重试</span>
              </div>

              <!-- 有图片：缩略图 + 删除按钮 -->
              <div
                v-else
                class="step-thumb"
                @click="openLightbox(step.image)"
              >
                <img
                  :src="step.image.previewUrl || step.image.url"
                  class="step-thumb-img"
                  :alt="`步骤 ${index + 1} 图片`"
                />
                <span
                  class="step-thumb-delete"
                  role="button"
                  tabindex="0"
                  :aria-label="`删除步骤 ${index + 1} 图片`"
                  @click.stop="removeStepImage(index)"
                  @keydown.enter.prevent.stop="removeStepImage(index)"
                  @keydown.space.prevent.stop="removeStepImage(index)"
                >
                  <PhX :size="10" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 隐藏的文件输入 (步骤图片) -->
        <input
          ref="stepFileInput"
          type="file"
          :accept="ALLOWED_TYPES.join(',')"
          class="file-input-hidden"
          @change="handleStepImageFile"
        />

        <span v-if="errors.steps" class="field-error">{{ errors.steps }}</span>
        <button class="add-step-btn" @click="addStep"><PhPlus :size="14" /> 添加步骤</button>
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

    <!-- ==================== 全屏灯箱 ==================== -->
    <teleport to="body">
      <transition name="lightbox-fade">
        <div
          v-if="lightbox.visible"
          class="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          @click.self="closeLightbox"
        >
          <!-- 关闭按钮 -->
          <button class="lightbox-close" @click="closeLightbox" aria-label="关闭">
            <PhX :size="24" />
          </button>

          <!-- 左箭头 -->
          <button
            v-if="allStepImages.length > 1"
            class="lightbox-arrow lightbox-arrow--left"
            aria-label="上一张"
            @click="navigateLightbox(-1)"
          >
            <PhCaretLeft :size="32" />
          </button>

          <!-- 图片 -->
          <img :src="lightbox.url" class="lightbox-image" alt="预览图片" />

          <!-- 右箭头 -->
          <button
            v-if="allStepImages.length > 1"
            class="lightbox-arrow lightbox-arrow--right"
            aria-label="下一张"
            @click="navigateLightbox(1)"
          >
            <PhCaretRight :size="32" />
          </button>

          <!-- 计数器 -->
          <span v-if="allStepImages.length > 1" class="lightbox-counter">
            {{ lightbox.index + 1 }} / {{ allStepImages.length }}
          </span>
        </div>
      </transition>
    </teleport>

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
.publish-btn {
  font-size: 14px;
  color: #fff;
  background: var(--color-primary);
  border: none;
  padding: 8px 18px;
  border-radius: var(--radius-btn);
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
  border-radius: var(--radius-card);
  padding: 16px;
  box-shadow: var(--shadow-card);
}
.form-label {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: #0F172A;
  margin-bottom: 12px;
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

/* --- 编辑器容器 --- */
.editor-wrapper {
  border: none;
  border-radius: 8px;
  background: #F8FAFC;
  min-height: 120px;
  overflow: hidden;
}
.editor-content {
  min-height: 120px;
  max-height: 400px;
  overflow-y: auto;
  padding: 12px;
  font-size: 14px;
  color: #334155;
  line-height: 1.7;
  outline: none;
  word-break: break-word;
}
.editor-content:empty::before {
  content: attr(data-placeholder);
  color: #94A3B8;
  pointer-events: none;
}
.editor-content :deep(img) {
  display: block;
  width: 100%;
  max-height: 200px;
  border-radius: 8px;
  background: #F1F5F9;
  object-fit: contain;
  margin: 8px 0;
  cursor: pointer;
  transition: outline 0.15s;
}

/* --- 底部缩略图预览区 --- */
.thumbnail-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  padding: 0;
}
.thumbnail-item {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity 0.2s;
}
.thumbnail-item:active {
  opacity: 0.8;
}
.thumbnail-item.is-uploading {
  opacity: 0.5;
}
.thumbnail-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.thumbnail-skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.thumbnail-delete {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}
.thumbnail-item:hover .thumbnail-delete {
  opacity: 1;
}
.thumbnail-add {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  border: 1px dashed #CBD5E1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94A3B8;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color 0.2s, color 0.2s;
}
.thumbnail-add:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* --- 底部工具栏 --- */
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  background: #FFFFFF;
  border-top: 1px solid #F1F5F9;
  padding: 0 12px;
  margin-top: 0;
}
.toolbar-left {
  display: flex;
  align-items: center;
  gap: 2px;
}
.tool-btn {
  width: 32px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: #475569;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.tool-btn:hover {
  background: #F1F5F9;
}
.tool-btn:active {
  background: #E2E8F0;
}
.toolbar-right {
  display: flex;
  align-items: center;
}
.insert-img-btn {
  height: 28px;
  padding: 0 10px;
  background: #F1F5F9;
  border: none;
  border-radius: 4px;
  color: #64748B;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s;
}
.insert-img-btn:hover {
  background: #E2E8F0;
}
.insert-img-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* --- 隐藏文件输入 --- */
.file-input-hidden {
  display: none;
}

/* --- 错误提示 & 字数统计 --- */
.field-error {
  font-size: 12px;
  color: var(--color-error);
}
.field-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
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
  gap: 12px;
  margin-bottom: 8px;
}
.step-block {
  transition: opacity 0.2s, transform 0.2s;
  position: relative;
}
.step-block.is-dragging {
  opacity: 0.4;
}
.step-block.is-drop-target::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--color-primary);
  border-radius: 1px;
  z-index: 1;
}
.step-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.step-grip {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94A3B8;
  cursor: grab;
  flex-shrink: 0;
  padding: 2px 0;
  transition: color 0.15s;
  user-select: none;
  -webkit-user-select: none;
}
.step-grip:active {
  cursor: grabbing;
  color: var(--color-primary);
}
.step-num {
  width: 24px;
  text-align: right;
  font-size: 16px;
  color: #2563EB;
  font-weight: 600;
  flex-shrink: 0;
}
.step-input {
  flex: 1;
}
.step-remove {
  display: flex;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 4px;
  flex-shrink: 0;
  transition: color 0.2s;
}
.step-remove:hover {
  color: var(--color-error);
}

/* --- 步骤图片区域 --- */
.step-image-area {
  margin-top: 8px;
}

/* 上传入口 */
.step-upload-entry {
  width: 80px;
  height: 80px;
  border: 1px dashed #CBD5E1;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94A3B8;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}
.step-upload-entry:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.step-upload-entry:active {
  background: #F8FAFC;
}

/* 缩略图 */
.step-thumb {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
}
.step-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.step-thumb-delete {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  cursor: pointer;
}
.step-thumb:hover .step-thumb-delete {
  opacity: 1;
}

/* 上传中骨架 */
.step-thumb--loading {
  opacity: 0.5;
  cursor: default;
}
.step-thumb-skeleton {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* 上传失败 */
.step-thumb--error {
  border: 2px solid var(--color-error);
}
.step-thumb-retry {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.7);
  color: var(--color-error);
  font-size: 12px;
  font-weight: 600;
}

/* 添加步骤按钮 */
.add-step-btn {
  background: none;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-btn);
  padding: 8px;
  width: 100%;
  font-size: 14px;
  color: var(--color-primary);
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
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
  border-radius: var(--radius-tag);
  font-size: 13px;
  background: var(--color-divider);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}
.tag-chip.selected {
  background: var(--color-primary);
  color: #fff;
}

/* ==================== 全屏灯箱 ==================== */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
}
.lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: background 0.2s;
}
.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.25);
}
.lightbox-image {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 4px;
  user-select: none;
}
.lightbox-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  transition: background 0.2s;
}
.lightbox-arrow:hover {
  background: rgba(255, 255, 255, 0.25);
}
.lightbox-arrow--left {
  left: 16px;
}
.lightbox-arrow--right {
  right: 16px;
}
.lightbox-counter {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 500;
}
.lightbox-fade-enter-active,
.lightbox-fade-leave-active {
  transition: opacity 0.25s ease;
}
.lightbox-fade-enter-from,
.lightbox-fade-leave-to {
  opacity: 0;
}
</style>
