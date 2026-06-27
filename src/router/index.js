// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { userStore, restoreSession } from '../store/user.js'

import HomeView from '../views/HomeView.vue'
import SearchView from '../views/SearchView.vue'
import MessageView from '../views/MessageView.vue'
import ProfileView from '../views/ProfileView.vue'
import ArticleDetail from '../views/ArticleDetail.vue'
import ProfileEdit from '../views/ProfileEdit.vue'
import PublishView from '../views/PublishView.vue'
import CollectionView from '../views/CollectionView.vue'
import HistoryView from '../views/HistoryView.vue'
import LoginView from '../views/LoginView.vue'
import FriendManage from '../views/FriendManage.vue'
import PostsView from '../views/PostsView.vue'
import AdminDashboard from '../views/AdminDashboard.vue'
import AccountManage from '../views/AccountManage.vue'
import ConfigView from '../views/ConfigView.vue'
import NotFound from '../views/NotFound.vue'
import { isAdmin as checkIsAdmin } from '../store/auth.js'

const routes = [
  { path: '/login', name: 'Login', component: LoginView },
  { path: '/', redirect: '/search' },

  { path: '/search', name: 'Search', component: SearchView },
  { path: '/home', name: 'Home', component: HomeView },
  { path: '/message', name: 'Message', component: MessageView },
  { path: '/profile', name: 'Profile', component: ProfileView },
  { path: '/profile/edit', name: 'ProfileEdit', component: ProfileEdit },
  { path: '/publish', name: 'Publish', component: PublishView },
  { path: '/collection', name: 'Collection', component: CollectionView },
  { path: '/history', name: 'History', component: HistoryView },
  { path: '/friend', name: 'FriendManage', component: FriendManage },
  { path: '/profile/posts', name: 'PostsView', component: PostsView },

  // 管理中心（管理员及以上）
  {
    path: '/admin',
    name: 'AdminDashboard',
    component: AdminDashboard,
    beforeEnter: (_to, _from, next) => {
      if (!checkIsAdmin(userStore.role)) {
        next('/profile')
        return
      }
      next()
    },
  },
  {
    path: '/admin/users',
    name: 'AccountManage',
    component: AccountManage,
    beforeEnter: (_to, _from, next) => {
      if (!checkIsAdmin(userStore.role)) {
        next('/profile')
        return
      }
      next()
    },
  },
  {
    path: '/admin/config',
    name: 'ConfigView',
    component: ConfigView,
    beforeEnter: (_to, _from, next) => {
      if (!checkIsAdmin(userStore.role)) {
        next('/profile')
        return
      }
      next()
    },
  },

  { path: '/article/:id', name: 'ArticleDetail', component: ArticleDetail },

  // 404 兜底 — 必须放在最后
  { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// ==================== 路由守卫：登录态保护 + 会话恢复 ====================
// 公开路由（无需登录即可访问）
const PUBLIC_ROUTES = ['/login']

let _sessionPromise = null

router.beforeEach(async (to, from, next) => {
  // 首次导航时启动会话恢复（后续导航复用同一个 Promise）
  if (!_sessionPromise) {
    _sessionPromise = restoreSession()
  }
  await _sessionPromise

  const isLoggedIn = userStore.isLoggedIn

  // 已登录用户访问 /login → 重定向到搜索页
  if (isLoggedIn && to.path === '/login') {
    next('/search')
    return
  }

  // 未登录用户访问非公开路由 → 重定向到登录页（带上 redirect 参数）
  if (!isLoggedIn && !PUBLIC_ROUTES.includes(to.path)) {
    next('/login?redirect=' + encodeURIComponent(to.fullPath))
    return
  }

  next()
})

export default router
