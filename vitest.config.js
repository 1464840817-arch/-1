import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    // 测试文件位置 — 后端 + 前端
    include: ['server/__tests__/**/*.test.js', 'src/__tests__/**/*.test.js'],
    testTimeout: 10000,
    globals: false,
    // 根据测试目录自动选择环境
    environmentMatchGlobs: [
      ['src/__tests__/**', 'jsdom'],
    ],
  },
})
