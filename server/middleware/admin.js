// server/middleware/admin.js
// 管理员角色检查（后端自包含，不依赖前端 store）

const ROLE_LEVEL = {
  '一线工程师': 0,
  '管理员': 1,
  '系统部署人员': 2,
}

/** 角色等级 */
function getRoleLevel(role) {
  return ROLE_LEVEL[role] ?? -1
}

/** 是否为管理员及以上 */
export function isAdmin(role) {
  return getRoleLevel(role) >= 1
}

/** 是否为超级管理员 */
export function isSuperAdmin(role) {
  return getRoleLevel(role) >= 2
}

/**
 * 管理员权限守卫（preHandler）
 * 必须在 authGuard 之后使用
 */
export async function adminGuard(request, reply) {
  if (!request.user || !isAdmin(request.user.role)) {
    return reply.status(403).send({ message: '权限不足，仅管理员可操作' })
  }
}

/**
 * 超级管理员权限守卫（preHandler）
 */
export async function superAdminGuard(request, reply) {
  if (!request.user || !isSuperAdmin(request.user.role)) {
    return reply.status(403).send({ message: '权限不足，仅超级管理员可操作' })
  }
}
