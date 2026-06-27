// src/main.js
import './style.css'  // Tailwind CSS 基础样式
import './assets/tokens.css'  // 全局设计 Token — 必须在 App 之前加载
import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // 引入标准化的路由

const app = createApp(App)

// 全局错误处理 — 捕获组件渲染/设置期间的异常，避免白屏且无提示
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error]', err, '\nComponent:', instance?.$.type?.__name || 'unknown', '\nInfo:', info)
  // 在页面上直接显示错误信息（仅开发阶段使用）
  const el = document.getElementById('app')
  if (el && import.meta.env.DEV) {
    const box = document.createElement('div')
    box.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999;' +
      'background:#fff3cd;color:#856404;padding:12px 16px;' +
      'font-size:13px;font-family:monospace;white-space:pre-wrap;' +
      'border-bottom:2px solid #ffc107;max-height:40vh;overflow:auto;'
    box.textContent = `[Vue Error] ${err.message || String(err)}\nComponent: ${instance?.$.type?.__name || 'unknown'}\nInfo: ${info}`
    el.prepend(box)
  }
}

app.config.warnHandler = (msg, instance, trace) => {
  console.warn('[Vue Warn]', msg, '\nComponent:', instance?.$.type?.__name || 'unknown', '\nTrace:', trace)
}

// 将路由挂载到 Vue 实例上
app.use(router)

app.mount('#app')