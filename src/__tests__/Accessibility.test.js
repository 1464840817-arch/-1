// @vitest-environment jsdom
// src/__tests__/Accessibility.test.js
// 全局可访问性回归测试 — 验证关键 a11y 属性

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import BottomNav from '../components/BottomNav.vue'
import ToastMessage from '../components/ToastMessage.vue'
import LoginView from '../views/LoginView.vue'
import NotFound from '../views/NotFound.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import HomeView from '../views/HomeView.vue'
import CollectionView from '../views/CollectionView.vue'
import HistoryView from '../views/HistoryView.vue'

function createRouterFor(component, path) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, name: 'test', component },
      { path: '/search', name: 'Search', component: { template: '<div>S</div>' } },
      { path: '/home', name: 'HomeView', component: { template: '<div>H</div>' } },
      { path: '/message', name: 'Message', component: { template: '<div>M</div>' } },
      { path: '/profile', name: 'Profile', component: { template: '<div>P</div>' } },
      { path: '/login', name: 'Login', component: LoginView },
    ],
  })
  return router
}

// ==================== 语义化 HTML ====================

describe('语义化 HTML — 页面使用 <main>', () => {
  it('LoginView 应该使用 <main>', async () => {
    const router = createRouterFor(LoginView, '/login')
    router.push('/login')
    await router.isReady()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })
    expect(wrapper.find('main').exists()).toBe(true)
  })

  it('NotFound 应该使用 <main>', () => {
    const router = createRouterFor(NotFound, '/404')
    const wrapper = mount(NotFound, { global: { plugins: [router] } })
    expect(wrapper.find('main').exists()).toBe(true)
  })

  it('AdminDashboard 应该使用 <main>', () => {
    const router = createRouterFor(AdminDashboard, '/admin')
    const wrapper = mount(AdminDashboard, { global: { plugins: [router] } })
    expect(wrapper.find('main').exists()).toBe(true)
  })

  it('HomeView 应该使用 <main>', () => {
    const router = createRouterFor(HomeView, '/home-view')
    const wrapper = mount(HomeView, { global: { plugins: [router] } })
    expect(wrapper.find('main').exists()).toBe(true)
  })

  it('CollectionView 应该使用 <main>', () => {
    const router = createRouterFor(CollectionView, '/collection')
    const wrapper = mount(CollectionView, { global: { plugins: [router] } })
    expect(wrapper.find('main').exists()).toBe(true)
  })

  it('HistoryView 应该使用 <main>', () => {
    const router = createRouterFor(HistoryView, '/history')
    const wrapper = mount(HistoryView, { global: { plugins: [router] } })
    expect(wrapper.find('main').exists()).toBe(true)
  })
})

// ==================== BottomNav A11y ====================

describe('BottomNav — 键盘可访问性', () => {
  async function mountBottomNavAt(path) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/search', name: 'Search', component: { template: '<div>S</div>' } },
        { path: '/home', name: 'HomeView', component: { template: '<div>H</div>' } },
        { path: '/message', name: 'Message', component: { template: '<div>M</div>' } },
        { path: '/profile', name: 'Profile', component: { template: '<div>P</div>' } },
      ],
    })
    router.push(path)
    await router.isReady()
    return mount(BottomNav, { global: { plugins: [router] } })
  }

  it('所有导航项应该有完整的键盘可访问属性', async () => {
    const wrapper = await mountBottomNavAt('/search')
    const items = wrapper.findAll('.nav-item')
    items.forEach((item) => {
      expect(item.attributes('role')).toBe('link')
      expect(item.attributes('tabindex')).toBeDefined()
      expect(item.attributes('aria-label')).toBeTruthy()
    })
  })

  it('活跃项应该有 aria-current="page"', async () => {
    const wrapper = await mountBottomNavAt('/search')
    const firstItem = wrapper.findAll('.nav-item')[0]
    expect(firstItem.attributes('aria-current')).toBe('page')
  })
})

// ==================== Toast A11y ====================

function findToast() {
  return document.body.querySelector('.toast-bar')
}

describe('ToastMessage — ARIA 通知', () => {
  it('可见时应该有 role="alert"', async () => {
    const wrapper = mount(ToastMessage)
    wrapper.vm.showToast('通知内容', 'success')
    await wrapper.vm.$nextTick()

    const bar = findToast()
    expect(bar.getAttribute('role')).toBe('alert')
    expect(bar.getAttribute('aria-live')).toBe('assertive')
  })

  it('图标应该有 aria-hidden', async () => {
    const wrapper = mount(ToastMessage)
    wrapper.vm.showToast('通知', 'error')
    await wrapper.vm.$nextTick()

    const icon = document.body.querySelector('.toast-icon')
    expect(icon.getAttribute('aria-hidden')).toBe('true')
  })
})
