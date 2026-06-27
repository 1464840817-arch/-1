// src/utils/date.js
// 统一日期时间格式化

/**
 * 格式化为 YYYY/MM/DD HH:mm（24h 制）
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return String(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}/${m}/${day} ${h}:${min}`
}
