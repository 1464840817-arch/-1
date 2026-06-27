// src/__tests__/helpers.js
// 前端组件测试工具库

import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'

/**
 * 创建测试用 Vue Router 实例
 * @param {Array} extraRoutes - 额外的路由配置
 */
export function createTestRouter(extraRoutes = []) {
  const routes = [
    { path: '/', name: 'Home', component: { template: '<div>Home</div>' } },
    { path: '/search', name: 'Search', component: { template: '<div>Search</div>' } },
    { path: '/home', name: 'HomeView', component: { template: '<div>HomeView</div>' } },
    { path: '/message', name: 'Message', component: { template: '<div>Message</div>' } },
    { path: '/profile', name: 'Profile', component: { template: '<div>Profile</div>' } },
    { path: '/article/:id', name: 'ArticleDetail', component: { template: '<div>Article</div>' } },
    { path: '/publish', name: 'Publish', component: { template: '<div>Publish</div>' } },
    { path: '/login', name: 'Login', component: { template: '<div>Login</div>' } },
    ...extraRoutes,
  ]

  return createRouter({
    history: createWebHistory(),
    routes,
  })
}

/**
 * 挂载组件并注入标准依赖（router + toast）
 * @param {object} component - Vue 组件
 * @param {object} options - 额外 mount 选项
 */
export function mountComponent(component, options = {}) {
  const router = options.router || createTestRouter()

  return mount(component, {
    global: {
      plugins: [router],
      provide: {
        showToast: options.showToast || (() => {}),
      },
      stubs: options.stubs || {},
    },
    ...options,
  })
}

/**
 * 验证元素具有键盘可访问性属性
 * @param {object} wrapper - Vue Test Utils wrapper
 * @param {object} options
 */
export function expectKeyboardAccessible(wrapper, options = {}) {
  const { role = 'button', tabindex = '0' } = options
  expect(wrapper.attributes('role')).toBe(role)
  expect(wrapper.attributes('tabindex')).toBe(tabindex)
}

/**
 * 验证输入具有可访问标签
 * @param {object} wrapper - input/textarea wrapper
 */
export function expectHasLabel(wrapper) {
  const ariaLabel = wrapper.attributes('aria-label')
  const ariaLabelledby = wrapper.attributes('aria-labelledby')
  const id = wrapper.attributes('id')
  expect(ariaLabel || ariaLabelledby || id).toBeTruthy()
}
