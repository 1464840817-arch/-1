import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // 这个配置是告诉 vite，遇到 @ 符号就替换成 src 目录的绝对路径
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      // 将前端 API 请求代理到后端（开发模式下前后端分离的桥梁）
      // bypass：浏览器页面导航（Accept: text/html）不走代理，由 Vite 提供 SPA 回退
      '/auth': {
        target: 'http://localhost:3000',
        bypass(req) {
          if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) return '/index.html'
        },
      },
      '/api': 'http://localhost:3000',
      '/user': {
        target: 'http://localhost:3000',
        bypass(req) {
          if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) return '/index.html'
        },
      },
      '/users': {
        target: 'http://localhost:3000',
        bypass(req) {
          if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) return '/index.html'
        },
      },
      '/articles': {
        target: 'http://localhost:3000',
        bypass(req) {
          if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) return '/index.html'
        },
      },
      '/chat': 'http://localhost:3000',
      '/comments': 'http://localhost:3000',
      '/admin': {
        target: 'http://localhost:3000',
        bypass(req) {
          if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) return '/index.html'
        },
      },
      '/tenant': {
        target: 'http://localhost:3000',
        bypass(req) {
          if (req.method === 'GET' && (req.headers.accept || '').includes('text/html')) return '/index.html'
        },
      },
    }
  }
})