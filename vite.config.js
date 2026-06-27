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
      '/auth': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/user': 'http://localhost:3000',
      '/articles': 'http://localhost:3000',
      '/comments': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
      '/tenant': 'http://localhost:3000',
    }
  }
})