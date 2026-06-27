// src/store/auth.js
// 角色与权限体系 — 纯函数，零依赖，任何模块可安全导入
// 角色定义与后端 /api/auth/login 返回的 role 字段严格对齐

// ==================== 角色常量 ====================
export const ROLES = {
  ENGINEER: '一线工程师',
  ADMIN: '管理员',
  SUPER_ADMIN: '系统部署人员',
}

/** 角色等级（数字越大权限越高） */
const ROLE_LEVEL = {
  [ROLES.ENGINEER]: 0,
  [ROLES.ADMIN]: 1,
  [ROLES.SUPER_ADMIN]: 2,
}

// ==================== 角色标签 ====================
export const ROLE_LABELS = {
  [ROLES.ENGINEER]: '一线工程师',
  [ROLES.ADMIN]: '管理员',
  [ROLES.SUPER_ADMIN]: '超级管理员',
}

export const ROLE_BADGE_COLORS = {
  [ROLES.ENGINEER]: 'blue',
  [ROLES.ADMIN]: 'amber',
  [ROLES.SUPER_ADMIN]: 'purple',
}

// ==================== 初始超级管理员种子 ====================
/** 首次部署时写入数据库的超级管理员 */
export const SEED_SUPER_ADMIN = {
  account: 'admin',
  password: 'admin123',
  name: '系统部署员',
  role: ROLES.SUPER_ADMIN,
}

// ==================== 权限检查 ====================
/**
 * 获取角色等级
 * @param {string} role - userStore.role
 * @returns {number}
 */
export function getRoleLevel(role) {
  return ROLE_LEVEL[role] ?? -1
}

/**
 * 是否为一线工程师
 * @param {string} role
 */
export function isEngineer(role) {
  return getRoleLevel(role) >= ROLE_LEVEL[ROLES.ENGINEER]
}

/**
 * 是否为管理员及以上
 * @param {string} role
 */
export function isAdmin(role) {
  return getRoleLevel(role) >= ROLE_LEVEL[ROLES.ADMIN]
}

/**
 * 是否为超级管理员
 * @param {string} role
 */
export function isSuperAdmin(role) {
  return getRoleLevel(role) >= ROLE_LEVEL[ROLES.SUPER_ADMIN]
}

// ==================== 权限细分 ====================
/** 能否访问管理中心 */
export function canAccessAdmin(role) {
  return isAdmin(role)
}

/** 能否管理普通用户（创建/禁用/删除一线工程师） */
export function canManageUsers(role) {
  return isAdmin(role)
}

/** 能否管理管理员账号（增删改管理员）— 仅超级管理员 */
export function canManageAdmins(role) {
  return isSuperAdmin(role)
}

/** 能否管理标签 */
export function canManageTags(role) {
  return isAdmin(role)
}

/** 能否修改系统配置 */
export function canEditSystemConfig(role) {
  return isSuperAdmin(role)
}
