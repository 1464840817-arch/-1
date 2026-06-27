<!-- src/components/ToastMessage.vue -->
<!-- 全局轻量 toast 提示组件 — 通过 provide/inject 在 App.vue 中挂载 -->

<script setup>
import { ref } from 'vue'

const visible = ref(false)
const message = ref('')
const type = ref('success') // 'success' | 'error'

let timer = null

function showToast(msg, t = 'success') {
  // 清除上一个定时器，防止快速连点 toast 残留
  if (timer) clearTimeout(timer)

  message.value = msg
  type.value = t
  visible.value = true

  timer = setTimeout(() => {
    visible.value = false
  }, 3000)
}

// 暴露给父组件 provide 使用
defineExpose({ showToast })
</script>

<template>
  <Teleport to="body">
    <Transition name="toast-slide">
      <div
        v-if="visible"
        class="toast-bar"
        :class="type"
        role="alert"
        aria-live="assertive"
      >
        <span class="toast-icon" aria-hidden="true">{{ type === 'success' ? '✓' : '✕' }}</span>
        <span class="toast-text">{{ message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-bar {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  max-width: 90vw;
}
.toast-bar.success {
  background: var(--color-success);
  color: #fff;
}
.toast-bar.error {
  background: var(--color-error);
  color: #fff;
}
.toast-icon {
  font-size: 16px;
  font-weight: bold;
  flex-shrink: 0;
}
.toast-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* --- 进出动画 --- */
.toast-slide-enter-active {
  transition: all 0.3s ease-out;
}
.toast-slide-leave-active {
  transition: all 0.25s ease-in;
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-20px);
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-12px);
}
</style>
