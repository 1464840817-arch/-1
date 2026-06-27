// @vitest-environment jsdom
// src/__tests__/ToastMessage.test.js

import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ToastMessage from '../components/ToastMessage.vue'

// ToastMessage 使用 Teleport to="body"，需要查询 document.body
function findToast() {
  return document.body.querySelector('.toast-bar')
}

describe('ToastMessage — 渲染', () => {
  let wrapper

  afterEach(() => {
    // 清理 Teleported 内容，防止跨测试污染
    wrapper?.unmount()
    document.body.querySelectorAll('.toast-bar').forEach((el) => el.remove())
  })

  it('初始状态下不可见', () => {
    wrapper = mount(ToastMessage)
    expect(findToast()).toBeNull()
  })

  it('调用 showToast 后应该显示消息', async () => {
    wrapper = mount(ToastMessage)

    wrapper.vm.showToast('操作成功', 'success')
    await wrapper.vm.$nextTick()

    const bar = findToast()
    expect(bar).not.toBeNull()
    expect(bar.textContent).toContain('操作成功')
    expect(bar.classList.contains('success')).toBe(true)
  })

  it('错误类型应该显示 error 样式', async () => {
    wrapper = mount(ToastMessage)

    wrapper.vm.showToast('操作失败', 'error')
    await wrapper.vm.$nextTick()

    const bar = findToast()
    expect(bar.classList.contains('error')).toBe(true)
  })
})

describe('ToastMessage — A11y', () => {
  let wrapper

  afterEach(() => {
    wrapper?.unmount()
    document.body.querySelectorAll('.toast-bar').forEach((el) => el.remove())
  })

  it('Toast 应该有 role="alert" 和 aria-live="assertive"', async () => {
    wrapper = mount(ToastMessage)

    wrapper.vm.showToast('测试', 'success')
    await wrapper.vm.$nextTick()

    const bar = findToast()
    expect(bar.getAttribute('role')).toBe('alert')
    expect(bar.getAttribute('aria-live')).toBe('assertive')
  })

  it('图标应该有 aria-hidden', async () => {
    wrapper = mount(ToastMessage)

    wrapper.vm.showToast('通知', 'error')
    await wrapper.vm.$nextTick()

    const icon = document.body.querySelector('.toast-icon')
    expect(icon.getAttribute('aria-hidden')).toBe('true')
  })
})
