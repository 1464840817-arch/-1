// src/main.js
import './style.css'  // Tailwind CSS 基础样式
import './assets/tokens.css'  // 全局设计 Token — 必须在 App 之前加载
import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // 引入标准化的路由

// ==================== 加载指示器 ====================
const loader = document.getElementById('app-loading')

/**
 * 隐藏首屏 loading，同时如果挂载失败则显示错误状态
 */
function hideLoader() {
  if (loader) {
    loader.classList.add('hide')
    // 过渡动画结束后移除 DOM
    setTimeout(() => loader.remove(), 400)
  }
}

function showLoadError(msg) {
  if (!loader) return
  loader.classList.add('error')
  const errEl = loader.querySelector('.loader-error')
  if (errEl) {
    errEl.innerHTML = `⚠️ 加载失败<br><small>${msg || '请检查网络后刷新重试'}</small>`
  }
}

// 超时保护：15 秒后仍未挂载则显示错误
const LOAD_TIMEOUT = setTimeout(() => {
  if (loader && !loader.classList.contains('hide')) {
    showLoadError('资源加载超时，请刷新页面重试')
  }
}, 15000)

const app = createApp(App)

// ==================== 全局错误处理 ====================
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error]', err, '\nComponent:', instance?.$.type?.__name || 'unknown', '\nInfo:', info)

  // 隐藏 loading 并显示错误（开发 + 生产均启用）
  const msg = err.message || String(err)
  const comp = instance?.$.type?.__name || 'unknown'
  showLoadError(`${comp}: ${msg}`)

  // 开发模式下额外在页面顶部显示技术细节
  if (import.meta.env.DEV) {
    const el = document.getElementById('app')
    if (el) {
      const box = document.createElement('div')
      box.style.cssText =
        'position:fixed;top:0;left:0;right:0;z-index:99999;' +
        'background:#fff3cd;color:#856404;padding:12px 16px;' +
        'font-size:13px;font-family:monospace;white-space:pre-wrap;' +
        'border-bottom:2px solid #ffc107;max-height:40vh;overflow:auto;'
      box.textContent = `[Vue Error] ${msg}\nComponent: ${comp}\nInfo: ${info}`
      el.prepend(box)
    }
  }
}

app.config.warnHandler = (msg, instance, trace) => {
  console.warn('[Vue Warn]', msg, '\nComponent:', instance?.$.type?.__name || 'unknown', '\nTrace:', trace)
}

// 将路由挂载到 Vue 实例上
app.use(router)

// ==================== 挂载 ====================
app.mount('#app')

// 挂载成功 — 隐藏 loading
clearTimeout(LOAD_TIMEOUT)
hideLoader()