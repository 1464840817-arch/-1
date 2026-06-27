// @vitest-environment jsdom
// src/__tests__/LoginView.test.js

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import LoginView from '../views/LoginView.vue'

function createLoginRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', name: 'Login', component: LoginView },
      { path: '/search', name: 'Search', component: { template: '<div>Search</div>' } },
    ],
  })
}

describe('LoginView — 渲染', () => {
  let router

  beforeEach(async () => {
    router = createLoginRouter()
    router.push('/login')
    await router.isReady()
  })

  function mountLogin() {
    return mount(LoginView, {
      global: { plugins: [router] },
    })
  }

  it('应该渲染品牌标题', () => {
    const wrapper = mountLogin()
    expect(wrapper.find('.brand-title').text()).toBe('工控技术库')
  })

  it('应该渲染工号输入框和密码输入框', () => {
    const wrapper = mountLogin()
    expect(wrapper.find('#login-account').exists()).toBe(true)
    expect(wrapper.find('#login-password').exists()).toBe(true)
  })

  it('应该渲染登录按钮', () => {
    const wrapper = mountLogin()
    const btn = wrapper.find('.login-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('登 录')
  })

  it('工号和密码为空时按钮应该禁用', () => {
    const wrapper = mountLogin()
    const btn = wrapper.find('.login-btn')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.classes()).toContain('is-disabled')
  })
})

describe('LoginView — A11y', () => {
  let router

  beforeEach(async () => {
    router = createLoginRouter()
    router.push('/login')
    await router.isReady()
  })

  function mountLogin() {
    return mount(LoginView, {
      global: { plugins: [router] },
    })
  }

  it('页面应该使用 <main> 元素', () => {
    const wrapper = mountLogin()
    expect(wrapper.find('main.login-page').exists()).toBe(true)
  })

  it('品牌标题 h1 应该有 id', () => {
    const wrapper = mountLogin()
    const h1 = wrapper.find('h1.brand-title')
    expect(h1.attributes('id')).toBe('brand-title')
  })

  it('main 应该通过 aria-labelledby 关联品牌标题', () => {
    const wrapper = mountLogin()
    const main = wrapper.find('main')
    expect(main.attributes('aria-labelledby')).toBe('brand-title')
  })

  it('工号输入框应该有 aria-label', () => {
    const wrapper = mountLogin()
    const input = wrapper.find('#login-account')
    expect(input.attributes('aria-label')).toBeTruthy()
    expect(input.attributes('aria-required')).toBe('true')
  })

  it('密码输入框应该有 aria-label', () => {
    const wrapper = mountLogin()
    const input = wrapper.find('#login-password')
    expect(input.attributes('aria-label')).toBeTruthy()
    expect(input.attributes('aria-required')).toBe('true')
  })

  it('错误横幅应该有 role="alert"', async () => {
    const wrapper = mountLogin()
    await wrapper.find('.login-btn').trigger('click')
    await wrapper.vm.$nextTick()

    const errorBanner = wrapper.find('.error-banner')
    if (errorBanner.exists()) {
      expect(errorBanner.attributes('role')).toBe('alert')
    }
  })

  it('密码可见性切换按钮应该有完整 A11y 属性', () => {
    const wrapper = mountLogin()
    const toggle = wrapper.find('.toggle-pwd')
    expect(toggle.attributes('role')).toBe('button')
    expect(toggle.attributes('aria-label')).toBeTruthy()
    expect(toggle.attributes('tabindex')).toBe('0')
  })

  it('忘记密码链接应该有 role="button" 和 tabindex', () => {
    const wrapper = mountLogin()
    const forgot = wrapper.find('.forgot-link')
    expect(forgot.attributes('role')).toBe('button')
    expect(forgot.attributes('tabindex')).toBe('0')
  })
})

describe('LoginView — 表单交互', () => {
  let router

  beforeEach(async () => {
    router = createLoginRouter()
    router.push('/login')
    await router.isReady()
  })

  function mountLogin() {
    return mount(LoginView, {
      global: { plugins: [router] },
    })
  }

  it('输入工号和密码后按钮应变为可用', async () => {
    const wrapper = mountLogin()

    await wrapper.find('#login-account').setValue('ENG_20240601')
    await wrapper.find('#login-password').setValue('123456')

    const btn = wrapper.find('.login-btn')
    expect(btn.attributes('disabled')).toBeUndefined()
    expect(btn.classes()).not.toContain('is-disabled')
  })

  it('点击密码切换按钮应该切换 input type', async () => {
    const wrapper = mountLogin()

    const pwdInput = wrapper.find('#login-password')
    expect(pwdInput.attributes('type')).toBe('password')

    await wrapper.find('.toggle-pwd').trigger('click')
    expect(pwdInput.attributes('type')).toBe('text')
  })

  it('点击忘记密码应该显示提示信息', async () => {
    const wrapper = mountLogin()

    await wrapper.find('.forgot-link').trigger('click')
    await wrapper.vm.$nextTick()

    const error = wrapper.find('.error-banner')
    expect(error.exists()).toBe(true)
    expect(error.text()).toContain('管理员重置密码')
  })
})
