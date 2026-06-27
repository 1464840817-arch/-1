// @vitest-environment jsdom
// src/__tests__/BottomNav.test.js

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import BottomNav from '../components/BottomNav.vue'

function createRouterAt(path = '/search') {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/search', name: 'Search', component: { template: '<div>Search</div>' } },
      { path: '/home', name: 'HomeView', component: { template: '<div>Home</div>' } },
      { path: '/message', name: 'Message', component: { template: '<div>Msg</div>' } },
      { path: '/profile', name: 'Profile', component: { template: '<div>Profile</div>' } },
    ],
  })
}

describe('BottomNav — 渲染', () => {
  it('应该渲染 4 个导航项', async () => {
    const router = createRouterAt('/search')
    router.push('/search')
    await router.isReady()

    const wrapper = mount(BottomNav, {
      global: { plugins: [router] },
    })

    const items = wrapper.findAll('.nav-item')
    expect(items).toHaveLength(4)
    expect(items[0].text()).toContain('搜索')
    expect(items[1].text()).toContain('首页')
    expect(items[2].text()).toContain('消息')
    expect(items[3].text()).toContain('我的')
  })

  it('应该在当前路由对应的项上设置 active 类', async () => {
    const router = createRouterAt('/home')
    router.push('/home')
    await router.isReady()

    const wrapper = mount(BottomNav, {
      global: { plugins: [router] },
    })

    const items = wrapper.findAll('.nav-item')
    expect(items[1].classes()).toContain('active')
  })
})

describe('BottomNav — A11y', () => {
  it('nav 元素应该有 aria-label', async () => {
    const router = createRouterAt('/search')
    router.push('/search')
    await router.isReady()

    const wrapper = mount(BottomNav, {
      global: { plugins: [router] },
    })

    const nav = wrapper.find('nav')
    expect(nav.attributes('aria-label')).toBe('主导航')
  })

  it('每个导航项应该有 role="link" 和 tabindex', async () => {
    const router = createRouterAt('/search')
    router.push('/search')
    await router.isReady()

    const wrapper = mount(BottomNav, {
      global: { plugins: [router] },
    })

    const items = wrapper.findAll('.nav-item')
    items.forEach((item) => {
      expect(item.attributes('role')).toBe('link')
      expect(item.attributes('tabindex')).toBeDefined()
      expect(item.attributes('aria-label')).toBeTruthy()
    })
  })

  it('当前活跃项应该有 aria-current="page"', async () => {
    const router = createRouterAt('/search')
    router.push('/search')
    await router.isReady()

    const wrapper = mount(BottomNav, {
      global: { plugins: [router] },
    })

    const items = wrapper.findAll('.nav-item')
    expect(items[0].attributes('aria-current')).toBe('page')
  })
})
