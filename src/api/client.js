// src/api/client.js
// fetch 封装层 — 统一 base URL、JSON 序列化、错误处理、自动附带 token

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * 从 localStorage 读取 token（避免循环依赖 userStore）
 */
function getToken() {
  try {
    const raw = localStorage.getItem('user')
    if (raw) {
      const parsed = JSON.parse(raw)
      return parsed.token || ''
    }
  } catch { /* ignore */ }
  return ''
}

/**
 * 发起 HTTP 请求
 * @param {string} path   - 接口路径，如 /user/profile
 * @param {object} options - fetch 选项（method, body, headers 等）
 * @returns {Promise<any>} 解析后的 JSON 数据
 */
export async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`

  const config = {
    headers: {},
    ...options,
  }

  // 自动附带 Bearer token（如果已登录）
  const token = getToken()
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }

  // JSON 请求：自动设置 Content-Type 并序列化 body
  if (!(config.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json'
    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body)
    }
  }

  let response
  try {
    response = await fetch(url, config)
  } catch (err) {
    // 网络中断 / 无法连接服务器
    throw { status: 0, message: '网络连接失败，请检查网络后重试。' }
  }

  // 尝试解析 JSON 响应体
  let data = null
  try {
    data = await response.json()
  } catch (_) {
    data = null
  }

  if (!response.ok) {
    // 统一错误格式
    const message =
      (data && data.message) ||
      (data && data.msg) ||
      `请求失败 (${response.status})`
    throw { status: response.status, message, data }
  }

  return data
}
