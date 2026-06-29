// src/api/upload.js
// 图片上传接口

import { request } from './client.js'

/**
 * 上传单张图片
 * @param {Blob|File} blob - 图片文件或 Blob
 * @param {string} [filename] - 文件名
 * @returns {Promise<{ id: string, url: string }>}
 */
export async function uploadImage(blob, filename = 'image.jpg') {
  const formData = new FormData()
  formData.append('file', blob, filename)
  const result = await request('/api/upload', {
    method: 'POST',
    body: formData,
  })
  return result.images[0]
}

/**
 * 批量上传多张图片
 * @param {Array<{ blob: Blob, filename: string }>} files
 * @returns {Promise<Array<{ id: string, url: string }>>}
 */
export async function uploadImages(files) {
  const formData = new FormData()
  files.forEach(({ blob, filename }) => {
    formData.append('files', blob, filename)
  })
  const result = await request('/api/upload', {
    method: 'POST',
    body: formData,
  })
  return result.images
}

/**
 * 删除已上传的图片
 * @param {string} id - 图片 ID
 * @returns {Promise<void>}
 */
export async function deleteImage(id) {
  await request(`/api/upload/${id}`, { method: 'DELETE' })
}
