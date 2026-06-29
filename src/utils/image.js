// src/utils/image.js
// 图片处理工具 — 校验、压缩、预览

/**
 * 支持的图片 MIME 类型
 */
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/**
 * 支持的图片扩展名
 */
export const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

/**
 * 最大文件大小 (5MB)
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024

/**
 * 最大图片数量
 */
export const MAX_IMAGE_COUNT = 9

/**
 * 压缩参数
 */
const COMPRESS_MAX_WIDTH = 1080
const COMPRESS_QUALITY = 0.8

/**
 * 校验图片文件
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImage(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: `不支持的格式 "${file.type || '未知'}"，仅支持 JPG/PNG/GIF/WebP` }
  }
  if (file.size > MAX_FILE_SIZE) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return { valid: false, error: `图片过大 (${mb}MB)，单张最大 5MB` }
  }
  return { valid: true }
}

/**
 * 从 File 读取为 data URL
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 从 data URL 加载为 HTMLImageElement
 * @param {string} dataUrl
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = dataUrl
  })
}

/**
 * 压缩图片（客户端 Canvas）
 * - 宽度超过 1080px 时等比缩放至 1080px
 * - JPEG/WebP 质量 80%
 * - PNG 保持格式但限制宽度
 * - GIF 不压缩（保留原样，Canvas 无法保留动画）
 *
 * @param {File} file - 原始文件
 * @returns {Promise<Blob>} 压缩后的 Blob
 */
export async function compressImage(file) {
  // GIF 跳过压缩（Canvas 无法保留 GIF 动画）
  if (file.type === 'image/gif') {
    return file
  }

  try {
    const dataUrl = await readAsDataURL(file)
    const img = await loadImage(dataUrl)

    // 宽度未超出限制，不需要缩放
    if (img.width <= COMPRESS_MAX_WIDTH) {
      // 但仍尝试压缩质量（JPEG/WebP）
      if (file.type === 'image/jpeg' || file.type === 'image/webp') {
        return await compressWithCanvas(img, img.width, img.height, file.type)
      }
      return file
    }

    // 等比缩放
    const ratio = COMPRESS_MAX_WIDTH / img.width
    const width = COMPRESS_MAX_WIDTH
    const height = Math.round(img.height * ratio)

    return await compressWithCanvas(img, width, height, file.type)
  } catch {
    // 压缩失败时返回原始文件
    console.warn('图片压缩失败，使用原始文件')
    return file
  }
}

/**
 * 使用 Canvas 压缩图片
 * @param {HTMLImageElement} img
 * @param {number} width
 * @param {number} height
 * @param {string} mimeType
 * @returns {Promise<Blob>}
 */
function compressWithCanvas(img, width, height, mimeType) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, width, height)

    // PNG 转 JPEG 输出（JPEG 更小）
    const outputType = mimeType === 'image/png' ? 'image/jpeg' : mimeType
    const quality = outputType === 'image/jpeg' || outputType === 'image/webp'
      ? COMPRESS_QUALITY
      : undefined

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Canvas toBlob 失败'))
        }
      },
      outputType,
      quality,
    )
  })
}

/**
 * 生成图片本地 ID（上传前临时标识）
 * @returns {string}
 */
export function generateLocalId() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 创建图片预览用的 blob URL
 * @param {Blob|File} blob
 * @returns {string}
 */
export function createPreviewUrl(blob) {
  return URL.createObjectURL(blob)
}

/**
 * 释放 blob URL
 * @param {string} url
 */
export function revokePreviewUrl(url) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}
