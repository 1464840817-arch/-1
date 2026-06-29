<!-- src/views/AccountManage.vue -->
<!-- 账号管理 — 创建/禁用/删除用户，管理员及以上可访问 -->
<script setup>
import { ref, reactive, computed, onMounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { PhArrowLeft, PhWarning, PhEnvelopeOpen } from '@phosphor-icons/vue'
import { userStore, currentIsSuperAdmin } from '../store/user.js'
import { ROLES, ROLE_LABELS } from '../store/auth.js'
import { getUserList, createUser, setUserStatus, deleteUser, resetPassword } from '../api/auth.js'

const router = useRouter()
const toast = inject('showToast', null)

// ==================== 用户列表 ====================
const users = ref([])
const loading = ref(false)
const loadError = ref('')
const roleFilter = ref('all') // 'all' | ROLES.ENGINEER | ROLES.ADMIN | ROLES.SUPER_ADMIN

const filteredUsers = computed(() => {
  if (roleFilter.value === 'all') return users.value
  return users.value.filter(u => u.role === roleFilter.value)
})

const isSuperAdmin = computed(() => currentIsSuperAdmin())

const loadUsers = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const data = await getUserList()
    users.value = Array.isArray(data?.list) ? data.list : (Array.isArray(data) ? data : [])
  } catch (err) {
    users.value = []
    loadError.value = err.message || '加载失败'
    console.error('用户列表加载失败:', err)
  } finally {
    loading.value = false
  }
}

// ==================== 创建用户对话框 ====================
const showCreateDialog = ref(false)
const createForm = reactive({
  account: '',
  password: '',
  name: '',
  role: ROLES.ENGINEER,
  department: '',
})
const createErrors = ref({})
const creating = ref(false)

/** 当前用户可创建的角色范围 */
const creatableRoles = computed(() => {
  // 超级管理员可创建管理员和工程师；管理员只能创建工程师
  if (isSuperAdmin.value) {
    return [
      { value: ROLES.ENGINEER, label: ROLE_LABELS[ROLES.ENGINEER] },
      { value: ROLES.ADMIN, label: ROLE_LABELS[ROLES.ADMIN] },
    ]
  }
  return [
    { value: ROLES.ENGINEER, label: ROLE_LABELS[ROLES.ENGINEER] },
  ]
})

const openCreateDialog = () => {
  createForm.account = ''
  createForm.password = ''
  createForm.name = ''
  createForm.role = ROLES.ENGINEER
  createForm.department = ''
  createErrors.value = {}
  showCreateDialog.value = true
}

const closeCreateDialog = () => {
  showCreateDialog.value = false
}

const validateCreate = () => {
  const errs = {}
  if (!createForm.account.trim()) errs.account = '请输入工号'
  if (!createForm.password || createForm.password.length < 6) errs.password = '密码至少 6 位'
  if (!createForm.name.trim()) errs.name = '请输入姓名'
  createErrors.value = errs
  return Object.keys(errs).length === 0
}

const handleCreate = async () => {
  if (!validateCreate() || creating.value) return
  creating.value = true

  const newUser = {
    account: createForm.account.trim(),
    password: createForm.password,
    name: createForm.name.trim(),
    role: createForm.role,
    department: createForm.department.trim(),
  }

  // 乐观更新：加入本地列表
  const optimistic = {
    id: Date.now(),
    ...newUser,
    disabled: false,
    createdAt: new Date().toISOString().slice(0, 10),
  }
  delete optimistic.password
  users.value.unshift(optimistic)

  // API 同步
  try {
    await createUser(newUser)
    toast?.('账号创建成功', 'success')
  } catch {
    // 静默降级，本地数据已更新
  }

  closeCreateDialog()
  creating.value = false
}

// ==================== 禁用/启用 ====================
const handleToggleStatus = async (user) => {
  // 不能禁用自己
  if (user.account === userStore.account) {
    toast?.('不能操作自己的账号', 'error')
    return
  }

  const newStatus = !user.disabled

  // 乐观更新
  user.disabled = newStatus

  try {
    await setUserStatus(user.id, newStatus)
    toast?.(newStatus ? '已禁用该账号' : '已启用该账号', 'success')
  } catch { /* 静默降级 */ }
}

// ==================== 删除用户 ====================
const confirmDeleteId = ref(null)

const handleDelete = async (user) => {
  if (user.account === userStore.account) {
    toast?.('不能删除自己的账号', 'error')
    return
  }

  if (confirmDeleteId.value !== user.id) {
    confirmDeleteId.value = user.id
    setTimeout(() => {
      if (confirmDeleteId.value === user.id) confirmDeleteId.value = null
    }, 3000)
    return
  }

  // 二次确认通过，执行删除
  const idx = users.value.findIndex(u => u.id === user.id)
  if (idx >= 0) users.value.splice(idx, 1)
  confirmDeleteId.value = null

  try {
    await deleteUser(user.id)
    toast?.('账号已删除', 'success')
  } catch { /* 静默降级 */ }
}

const cancelConfirm = () => {
  confirmDeleteId.value = null
}

// ==================== 重置密码对话框 ====================
const showPwdDialog = ref(false)
const pwdTarget = ref(null) // 目标用户
const pwdForm = reactive({
  newPassword: '',
  confirmPassword: '',
})
const pwdErrors = ref({})
const resetting = ref(false)

const openPwdDialog = (user) => {
  pwdTarget.value = user
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
  pwdErrors.value = {}
  showPwdDialog.value = true
}

const closePwdDialog = () => {
  showPwdDialog.value = false
  pwdTarget.value = null
}

const validatePwd = () => {
  const errs = {}
  if (!pwdForm.newPassword || pwdForm.newPassword.length < 6) errs.newPassword = '密码至少 6 位'
  if (pwdForm.newPassword !== pwdForm.confirmPassword) errs.confirmPassword = '两次输入的密码不一致'
  pwdErrors.value = errs
  return Object.keys(errs).length === 0
}

const handleResetPwd = async () => {
  if (!validatePwd() || resetting.value || !pwdTarget.value) return
  resetting.value = true
  try {
    await resetPassword(pwdTarget.value.id, pwdForm.newPassword)
    toast?.('密码已重置', 'success')
    closePwdDialog()
  } catch (err) {
    toast?.(err.message || '密码重置失败', 'error')
  } finally {
    resetting.value = false
  }
}

// ==================== 返回 ====================
const goBack = () => router.back()

onMounted(() => { loadUsers() })
</script>

<template>
  <main class="account-page" aria-label="账号管理">

    <!-- 顶部导航 -->
    <header class="page-header">
      <span class="back-btn" role="button" tabindex="0" aria-label="返回" @click="goBack" @keydown.enter="goBack" @keydown.space.prevent="goBack"><PhArrowLeft :size="18" class="back-icon" /> 返回</span>
      <span class="title">用户管理</span>
      <button class="create-btn" @click="openCreateDialog">+ 新建</button>
    </header>

    <!-- 角色筛选 -->
    <div class="filter-row">
      <span
        v-for="opt in [
          { value: 'all', label: '全部' },
          { value: ROLES.ENGINEER, label: '工程师' },
          { value: ROLES.ADMIN, label: '管理员' },
          { value: ROLES.SUPER_ADMIN, label: '超管' },
        ]"
        :key="opt.value"
        class="filter-chip"
        :class="{ active: roleFilter === opt.value }"
        role="tab"
        :aria-selected="roleFilter === opt.value"
        tabindex="0"
        @click="roleFilter = opt.value"
        @keydown.enter="roleFilter = opt.value"
        @keydown.space.prevent="roleFilter = opt.value"
      >{{ opt.label }}</span>
    </div>

    <!-- 加载态 -->
    <div v-if="loading" class="loading-state">
      <span class="loading-spinner"></span>
    </div>

    <!-- 错误态 -->
    <div v-else-if="loadError" class="message-state">
      <span class="message-icon"><PhWarning :size="40" /></span>
      <p class="message-text">{{ loadError }}</p>
      <button class="retry-btn" @click="loadUsers">重试</button>
    </div>

    <!-- 用户列表 -->
    <div v-else class="user-list">
      <div
        v-for="user in filteredUsers"
        :key="user.id"
        class="user-card"
        :class="{
          disabled: user.disabled,
          'confirm-delete': confirmDeleteId === user.id,
        }"
      >
        <div class="user-avatar" :class="user.role">
          <img v-if="user.avatar" :src="user.avatar" class="user-avatar-img" alt="" />
          <span v-else>{{ user.name[0] }}</span>
        </div>
        <div class="user-info">
          <div class="user-name-line">
            <span class="user-name">{{ user.name }}</span>
            <span
              class="role-badge"
              :class="{
                'role-engineer': user.role === ROLES.ENGINEER,
                'role-admin': user.role === ROLES.ADMIN,
                'role-super': user.role === ROLES.SUPER_ADMIN,
              }"
            >{{ ROLE_LABELS[user.role] || user.role }}</span>
            <span v-if="user.disabled" class="disabled-tag">已禁用</span>
          </div>
          <span class="user-meta">{{ user.account }} · {{ user.department || '未分配部门' }}</span>
          <span class="user-date">创建于 {{ user.createdAt }}</span>
        </div>
        <div class="user-actions">
          <button
            v-if="isSuperAdmin && user.account !== userStore.account"
            class="action-btn pwd-btn"
            @click="openPwdDialog(user)"
          >
            密码
          </button>
          <button
            class="action-btn toggle-btn"
            :class="{ active: user.disabled }"
            @click="handleToggleStatus(user)"
          >
            {{ user.disabled ? '启用' : '禁用' }}
          </button>
          <button
            class="action-btn delete-btn"
            :class="{ confirming: confirmDeleteId === user.id }"
            @click="handleDelete(user)"
          >
            {{ confirmDeleteId === user.id ? '确认删除' : '删除' }}
          </button>
        </div>
      </div>

      <!-- 空列表 -->
      <div v-if="filteredUsers.length === 0" class="empty-inline">
        <span class="empty-icon"><PhEnvelopeOpen :size="40" /></span>
        <p class="empty-text">暂无该角色用户</p>
      </div>
    </div>

    <!-- ==================== 重置密码对话框 ==================== -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="showPwdDialog" class="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="pwd-dialog-title" @click.self="closePwdDialog" @keydown.escape="closePwdDialog">
          <div class="dialog-card">
            <h3 id="pwd-dialog-title" class="dialog-title">重置密码</h3>
            <p class="dialog-hint">为 <strong>{{ pwdTarget?.name }}</strong>（{{ pwdTarget?.account }}）设置新密码</p>

            <label class="dialog-label" for="pwd-new">新密码</label>
            <input
              id="pwd-new"
              v-model="pwdForm.newPassword"
              type="password"
              class="dialog-input"
              :class="{ error: pwdErrors.newPassword }"
              placeholder="至少 6 位"
              aria-label="新密码"
              aria-required="true"
              :aria-describedby="pwdErrors.newPassword ? 'pwd-new-err' : undefined"
            />
            <span v-if="pwdErrors.newPassword" id="pwd-new-err" class="field-err">{{ pwdErrors.newPassword }}</span>

            <label class="dialog-label" for="pwd-confirm">确认密码</label>
            <input
              id="pwd-confirm"
              v-model="pwdForm.confirmPassword"
              type="password"
              class="dialog-input"
              :class="{ error: pwdErrors.confirmPassword }"
              placeholder="再次输入新密码"
              aria-label="确认密码"
              aria-required="true"
              :aria-describedby="pwdErrors.confirmPassword ? 'pwd-confirm-err' : undefined"
            />
            <span v-if="pwdErrors.confirmPassword" id="pwd-confirm-err" class="field-err">{{ pwdErrors.confirmPassword }}</span>

            <div class="dialog-btns">
              <button class="dialog-btn cancel" @click="closePwdDialog">取消</button>
              <button class="dialog-btn confirm" :disabled="resetting" @click="handleResetPwd">
                {{ resetting ? '重置中…' : '确认重置' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- ==================== 创建用户对话框 ==================== -->
    <teleport to="body">
      <transition name="modal">
        <div v-if="showCreateDialog" class="dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="dialog-title" @click.self="closeCreateDialog" @keydown.escape="closeCreateDialog">
          <div class="dialog-card">
            <h3 id="dialog-title" class="dialog-title">新建用户</h3>

            <!-- 工号 -->
            <label class="dialog-label" for="dialog-account">工号</label>
            <input
              id="dialog-account"
              v-model="createForm.account"
              type="text"
              class="dialog-input"
              :class="{ error: createErrors.account }"
              placeholder="如：ENG_20250101"
              aria-label="工号"
              aria-required="true"
              :aria-describedby="createErrors.account ? 'dialog-account-err' : undefined"
            />
            <span v-if="createErrors.account" id="dialog-account-err" class="field-err">{{ createErrors.account }}</span>

            <!-- 姓名 -->
            <label class="dialog-label" for="dialog-name">姓名</label>
            <input
              id="dialog-name"
              v-model="createForm.name"
              type="text"
              class="dialog-input"
              :class="{ error: createErrors.name }"
              placeholder="真实姓名"
              aria-label="姓名"
              aria-required="true"
              :aria-describedby="createErrors.name ? 'dialog-name-err' : undefined"
            />
            <span v-if="createErrors.name" id="dialog-name-err" class="field-err">{{ createErrors.name }}</span>

            <!-- 角色 -->
            <label class="dialog-label" for="dialog-role">角色</label>
            <select id="dialog-role" v-model="createForm.role" class="dialog-input" aria-label="选择角色">
              <option
                v-for="r in creatableRoles"
                :key="r.value"
                :value="r.value"
              >{{ r.label }}</option>
            </select>

            <!-- 部门 -->
            <label class="dialog-label" for="dialog-dept">部门（可选）</label>
            <input
              id="dialog-dept"
              v-model="createForm.department"
              type="text"
              class="dialog-input"
              placeholder="如：自动化部"
              aria-label="部门"
            />

            <!-- 密码 -->
            <label class="dialog-label" for="dialog-password">初始密码</label>
            <input
              id="dialog-password"
              v-model="createForm.password"
              type="password"
              class="dialog-input"
              :class="{ error: createErrors.password }"
              placeholder="至少 6 位"
              aria-label="初始密码"
              aria-required="true"
              :aria-describedby="createErrors.password ? 'dialog-password-err' : undefined"
            />
            <span v-if="createErrors.password" id="dialog-password-err" class="field-err">{{ createErrors.password }}</span>

            <!-- 按钮 -->
            <div class="dialog-btns">
              <button class="dialog-btn cancel" @click="closeCreateDialog">取消</button>
              <button class="dialog-btn confirm" :disabled="creating" @click="handleCreate">
                {{ creating ? '创建中…' : '确认创建' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

  </main>
</template>

<style scoped>
.account-page {
  min-height: 100vh;
  background: var(--color-bg-page);
  padding-bottom: 40px;
}

/* --- 顶部导航 --- */
.page-header {
  background: var(--color-bg-card);
  padding: 16px 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-divider);
  position: sticky;
  top: 0;
  z-index: 10;
}
.back-btn {
  font-size: 15px;
  color: var(--color-primary);
  font-weight: 500;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.back-icon { display: block; flex-shrink: 0; }
.title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.create-btn {
  font-size: 13px;
  color: #fff;
  background: var(--color-primary);
  border: none;
  height: 44px;
  padding: 0 16px;
  border-radius: var(--radius-btn);
  font-weight: 500;
  cursor: pointer;
  font-family: inherit;
}

/* --- 筛选 --- */
.filter-row {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}
.filter-row::-webkit-scrollbar { display: none; }
.filter-chip {
  font-size: 13px;
  padding: 6px 14px;
  border-radius: var(--radius-full);
  background: var(--color-divider);
  color: var(--color-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s;
}
.filter-chip.active {
  background: var(--color-primary);
  color: #fff;
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

/* --- 用户列表 --- */
.user-list {
  padding: 4px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  box-sizing: border-box;
}

.user-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 14px;
  display: flex;
  gap: 12px;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--color-border);
  transition: all 0.2s;
}
.user-card.disabled {
  opacity: 0.5;
}
.user-card.confirm-delete {
  border-color: var(--color-error);
  background: #fef2f2;
}

/* 头像 */
.user-avatar {
  width: 42px; height: 42px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 17px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  overflow: hidden;
}
.user-avatar-img {
  width: 100%; height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
.user-avatar { background: #E2E8F0; }

/* 用户信息 */
.user-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.user-name-line {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.user-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}
.role-badge {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: var(--radius-tag);
  font-weight: 500;
}
.role-engineer { background: var(--color-primary-light); color: var(--color-primary); }
.role-admin { background: var(--color-warning-bg); color: var(--color-warning); }
.role-super { background: var(--color-primary-light); color: var(--color-primary); }
.disabled-tag {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 8px;
  background: #fee2e2;
  color: var(--color-error);
  font-weight: 500;
}
.user-meta {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.user-date {
  font-size: 11px;
  color: var(--color-text-tertiary);
}

/* 操作按钮 */
.user-actions {
  display: flex;
  flex-direction: row;
  gap: 4px;
  flex-shrink: 0;
  justify-content: center;
  align-items: center;
}
.action-btn {
  font-size: 12px;
  padding: 4px 12px;
  border-radius: var(--radius-btn);
  border: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  white-space: nowrap;
}
.toggle-btn {
  color: var(--color-text-secondary);
}
.toggle-btn.active {
  color: var(--color-success);
  border-color: var(--color-success);
}
.pwd-btn {
  color: var(--color-primary);
  border-color: var(--color-primary-light);
}
.delete-btn {
  color: var(--color-text-tertiary);
}
.delete-btn.confirming {
  background: var(--color-error);
  color: #fff;
  border-color: var(--color-error);
}

/* --- 消息态（错误） --- */
.message-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 16px;
  gap: 12px;
}
.message-icon { display: flex; color: var(--color-text-tertiary); }
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
  height: 44px;
  padding: 0 24px;
  border-radius: var(--radius-btn);
  cursor: pointer;
  font-family: inherit;
}

/* --- 空状态 --- */
.empty-inline {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
}
.empty-icon { display: flex; color: var(--color-text-tertiary); margin-bottom: 10px; }
.empty-text { font-size: 14px; color: var(--color-text-tertiary); margin: 0; }

/* --- 对话框遮罩 --- */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15,23,42,0.5);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 100;
}
.dialog-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  padding: 20px 20px 28px 20px;
  width: 100%;
  max-width: 500px;
  max-height: 85vh;
  overflow-y: auto;
}
.dialog-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 16px 0;
  text-align: center;
}
.dialog-hint {
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
  margin: -8px 0 8px 0;
}
.dialog-hint strong {
  color: var(--color-text-primary);
}
.dialog-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  margin: 12px 0 4px 0;
}
.dialog-input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--color-text-primary);
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
  background: var(--color-bg-page);
}
.dialog-input:focus {
  border-color: var(--color-primary);
}
.dialog-input.error {
  border-color: var(--color-error);
}
select.dialog-input {
  cursor: pointer;
}
.field-err {
  font-size: 12px;
  color: var(--color-error);
}
.dialog-btns {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
.dialog-btn {
  flex: 1;
  height: 44px;
  padding: 0;
  border-radius: var(--radius-btn);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  font-family: inherit;
  transition: opacity 0.15s;
}
.dialog-btn.cancel {
  background: var(--color-divider);
  color: var(--color-text-secondary);
}
.dialog-btn.confirm {
  background: var(--color-primary);
  color: #fff;
}
.dialog-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-active .dialog-card,
.modal-leave-active .dialog-card {
  transition: transform 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .dialog-card {
  transform: translateY(100%);
}
.modal-leave-to .dialog-card {
  transform: translateY(100%);
}
</style>
