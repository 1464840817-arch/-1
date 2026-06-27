// @vitest-environment jsdom
// src/__tests__/NotFound.test.js

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import NotFound from '../views/NotFound.vue'

function mountNotFound() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound },
      { path: '/', name: 'Home', component: { template: '<div>Home</div>' } },
    ],
  })
  return mount(NotFound, {
    global: { plugins: [router] },
  })
}

describe('NotFound — 渲染', () => {
  it('应该使用 <main> 元素', () => {
    const wrapper = mountNotFound()
    expect(wrapper.find('main').exists()).toBe(true)
    expect(wrapper.find('main').attributes('aria-label')).toBeTruthy()
  })

  it('应该有返回首页的按钮', () => {
    const wrapper = mountNotFound()
    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('aria-label')).toBeTruthy()
  })
})
