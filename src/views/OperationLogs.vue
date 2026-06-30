<!-- src/views/OperationLogs.vue -->
<!-- 系统操作日志 — 管理员只读查看，表格形式，可按等级和时间排序 -->
<script setup>
import { ref, computed, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { ROLE_LABELS } from '../store/auth.js'
import { getOperationLogs } from '../api/admin.js'
import { PhArrowLeft, PhWarning, PhClipboardText } from '@phosphor-icons/vue'

const router = useRouter()
const toast = inject('showToast', null)
const goBack = () => router.back()

// ==================== 数据加载 ====================
const logs = ref([])
const loading = ref(false)
const error = ref('')

async function loadLogs() {
  loading.value = true
  error.value = ''
  try {
    const data = await getOperationLogs()
    logs.value = Array.isArray(data?.list) ? data.list : []
  } catch (err) {
    error.value = err.message || '加载失败'
    toast?.('加载操作日志失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => { loadLogs() })

// ==================== 排序 ====================
const ROLE_LEVEL = { '系统部署人员': 2, '管理员': 1, '一线工程师': 0 }

const sortField = ref('created_at')
const sortDir = ref('desc')

const sortedLogs = computed(() => {
  const list = [...logs.value]
  const dir = sortDir.value === 'asc' ? 1 : -1
  list.sort((a, b) => {
    if (sortField.value === 'created_at') {
      return dir * (new Date(a.created_at) - new Date(b.created_at))
    }
    if (sortField.value === 'operator_role') {
      const levelA = ROLE_LEVEL[a.operator_role] ?? -1
      const levelB = ROLE_LEVEL[b.operator_role] ?? -1
      return dir * (levelA - levelB)
    }
    return 0
  })
  return list
})

function toggleSort(field) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = 'desc'
  }
}

function sortIndicator(field) {
  if (sortField.value !== field) return ''
  return sortDir.value === 'asc' ? ' ▲' : ' ▼'
}

// ==================== 格式化 ====================
function formatTime(iso) {
  if (!iso) return ''
  return iso.replace('T', ' ').slice(0, 19)
}

function roleClass(role) {
  if (role === '系统部署人员') return 'role-super'
  if (role === '管理员') return 'role-admin'
  return 'role-engineer'
}
</script>

<template>
  <main class="log-page" aria-label="操作日志">
    <!-- 顶部导航栏 -->
    <header class="page-header">
      <span class="back-btn" @click="goBack"><PhArrowLeft :size="18" class="back-icon" /> 返回</span>
      <span class="title">操作日志</span>
      <span class="log-count">{{ logs.length }} 条记录</span>
    </header>

    <!-- 加载态 -->
    <div v-if="loading" class="loading-state">
      <span class="loading-spinner"></span>
    </div>

    <!-- 错误态 -->
    <div v-else-if="error" class="message-state">
      <span class="message-icon"><PhWarning :size="40" /></span>
      <p class="message-text">{{ error }}</p>
      <button class="retry-btn" @click="loadLogs">重试</button>
    </div>

    <!-- 空数据 -->
    <div v-else-if="logs.length === 0" class="message-state">
      <span class="message-icon"><PhClipboardText :size="40" /></span>
      <p class="message-text">暂无操作记录</p>
    </div>

    <!-- 日志表格 -->
    <div v-else class="table-wrapper">
      <table class="log-table">
        <thead>
          <tr>
            <th class="col-account">账号</th>
            <th class="col-role sortable" @click="toggleSort('operator_role')">
              账号等级{{ sortIndicator('operator_role') }}
            </th>
            <th class="col-detail">操作内容</th>
            <th class="col-time sortable" @click="toggleSort('created_at')">
              时间{{ sortIndicator('created_at') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in sortedLogs" :key="log.id">
            <td class="cell-account">{{ log.operator }}</td>
            <td>
              <span class="role-badge" :class="roleClass(log.operator_role)">
                {{ ROLE_LABELS[log.operator_role] || log.operator_role }}
              </span>
            </td>
            <td class="cell-detail">{{ log.detail }}</td>
            <td class="cell-time">{{ formatTime(log.created_at) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </main>
</template>

<style scoped>
.log-page {
  min-height: var(--app-height, 100dvh);
  background: var(--color-bg-page, #f5f5f5);
}

/* --- 顶部导航 --- */
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--color-bg-card, #fff);
  border-bottom: 1px solid var(--color-divider);
  position: sticky;
  top: 0;
  z-index: 10;
}
.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 15px;
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
}
.back-icon {
  display: block;
  flex-shrink: 0;
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.log-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* --- 加载态 --- */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 80px 0;
}
.loading-spinner {
  width: 28px; height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* --- 消息态（错误/空数据） --- */
.message-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 16px;
  gap: 12px;
}
.message-icon {
  display: flex;
  color: var(--color-text-tertiary);
}
.message-text {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
}
.retry-btn {
  font-size: 13px;
  color: #fff;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-btn);
  height: 44px;
  padding: 0 24px;
  cursor: pointer;
  font-family: inherit;
}

/* --- 表格容器 --- */
.table-wrapper {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  overflow-x: auto;
}

.log-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-bg-card, #fff);
  border-radius: var(--radius-card);
  overflow: hidden;
}

/* --- 表头 --- */
.log-table thead {
  background: var(--color-bg-page, #f5f5f5);
}
.log-table th {
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  border-bottom: 2px solid var(--color-divider);
  text-align: left;
  white-space: nowrap;
  user-select: none;
}
th.sortable {
  cursor: pointer;
}
th.sortable:hover {
  color: var(--color-primary);
}

/* --- 行 --- */
.log-table td {
  padding: 10px 12px;
  font-size: 13px;
  color: var(--color-text-primary);
  border-bottom: 1px solid var(--color-divider);
  vertical-align: middle;
}
.log-table tbody tr:hover {
  background: #fafafa;
}

/* --- 列宽 --- */
.col-account { min-width: 80px; width: 14%; }
.col-role   { min-width: 90px; width: 16%; }
.col-detail  { min-width: 200px; width: 40%; }
.col-time    { min-width: 130px; width: 20%; }

.cell-account {
  font-weight: 500;
}
.cell-detail {
  line-height: 1.5;
}
.cell-time {
  font-size: 12px;
  color: var(--color-text-tertiary);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* --- 角色标签（复用 AccountManage 风格） --- */
.role-badge {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: var(--radius-tag);
  font-weight: 500;
  white-space: nowrap;
}
.role-engineer { background: var(--color-primary-light); color: var(--color-primary); }
.role-admin { background: var(--color-warning-bg); color: var(--color-warning); }
.role-super { background: var(--color-primary-light); color: var(--color-primary); }
</style>
