// src/api/client.js
// fetch 封装层 — 统一 base URL、JSON 序列化、错误处理、自动附带 token
import { load } from '../utils/storage.js'
// 静态导入 userStore — 存在循环依赖（client→user→auth→client），但 getToken()
// 仅在 request() 被调用时执行（运行时），此时所有模块已初始化完毕，绑定有效
import { userStore } from '../store/user.js'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

/**
 * 获取当前用户的 token
 * 优先从内存中的 userStore 读取，防止多标签页场景下 localStorage 被其他账号覆盖
 * 导致当前标签页发送错误的 token（跨账号状态污染）
 *
 * 降级：userStore.token 为空时（极早期初始化阶段），回退到 localStorage
 */
function getToken() {
  if (userStore && userStore.token) return userStore.token
  // 降级：从 localStorage 读取（用于 userStore 尚未初始化的极早期阶段）
  const stored = load('user', {})
  return stored.token || ''
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

  // JSON 请求：仅在有 body 时设置 Content-Type 并序列化
  if (config.body != null && !(config.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json'
    if (typeof config.body === 'object') {
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
