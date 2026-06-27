// src/utils/storage.js
// localStorage 持久化工具 — 统一处理序列化/反序列化/异常兜底

const PREFIX = 'ic_'

/**
 * 从 localStorage 读取并解析 JSON
 * @param {string} key - 不带前缀的存储键名
 * @param {*} fallback - 解析失败或不存在时的默认值
 * @returns {*}
 */
export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

/**
 * 将数据序列化为 JSON 写入 localStorage
 * @param {string} key - 不带前缀的存储键名
 * @param {*} data - 要存储的数据
 */
export function save(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(data))
  } catch (err) {
    // 存储空间满或隐私模式下写入被拒，静默降级
    console.warn(`[storage] 写入 "${key}" 失败:`, err.message || err)
  }
}

/**
 * 删除指定键
 * @param {string} key
 */
export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // 静默
  }
}
