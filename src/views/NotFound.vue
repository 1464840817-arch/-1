<template>
  <main class="not-found-page" aria-label="页面未找到">
    <div class="not-found-card">
      <div class="error-code">404</div>
      <h2>页面未找到</h2>
      <p class="hint">您访问的页面不存在或已被移除</p>
      <button class="back-btn" aria-label="返回首页" @click="$router.push('/home')">返回首页</button>
    </div>
  </main>
</template>

<script setup>
</script>

<style scoped>
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 2rem;
}

.not-found-card {
  text-align: center;
  max-width: 400px;
}

.error-code {
  font-size: 5rem;
  font-weight: 700;
  color: var(--color-primary, #4a90d9);
  line-height: 1;
  margin-bottom: 1rem;
}

h2 {
  font-size: 1.25rem;
  color: var(--color-text, #333);
  margin-bottom: 0.5rem;
}

.hint {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #999);
  margin-bottom: 1.5rem;
}

.back-btn {
  padding: 0.625rem 1.5rem;
  background: var(--color-primary, #4a90d9);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  cursor: pointer;
  transition: opacity 0.2s;
}

.back-btn:hover {
  opacity: 0.85;
}
</style>
