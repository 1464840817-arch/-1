# 工控技术库 (Industrial Control Tech Library)

> 经验沉淀 · 故障智搜 — 面向工控工程师的私有化知识管理平台。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Vue 3 (Composition API) + Vue Router 4 + Vite 8 |
| 样式 | Tailwind CSS 3 + 全局 Design Token |
| 后端 | Fastify 5 (Node.js ESM) |
| 数据库 | SQLite (sql.js / WebAssembly，零原生依赖) |
| 鉴权 | JWT (access + refresh token) |

## 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 同时启动前后端（推荐）
npm run dev:all

# 3. 或者分别启动
npm run dev          # 前端 → http://localhost:5173
npm run dev:server   # 后端 → http://localhost:3000
```

首次启动后端时会自动：
- 创建 `data/` 目录及 `database.db`
- 生成 JWT 密钥到 `server/.secrets.json`
- 写入种子数据（超级管理员账号）

## 默认账号

| 角色 | 账号 | 密码 |
|------|------|------|
| 系统部署人员 | super_admin | admin123 |
| 管理员 | admin_002 | admin123 |
| 一线工程师 | user_001 | admin123 |

## 项目结构

```
├── server/
│   ├── index.js          # Fastify 入口
│   ├── config.js         # 配置 & JWT 密钥管理
│   ├── db.js             # SQLite 数据库层
│   ├── seed.js           # 种子数据
│   ├── middleware/
│   │   ├── auth.js       # JWT 鉴权守卫
│   │   └── admin.js      # 管理员守卫
│   └── routes/
│       ├── auth.js       # 登录/注册/Token 刷新
│       ├── article.js    # 文章 CRUD + 评论 + 点赞
│       ├── search.js     # 搜索历史
│       ├── collection.js # 收藏
│       ├── history.js    # 浏览历史
│       ├── message.js    # 系统消息
│       ├── friend.js     # 好友管理 + 管理员列表
│       ├── profile.js    # 个人资料 + 头像上传
│       ├── tenant.js     # 租户配置 + 分类标签
│       └── admin.js      # 用户管理（超管）
├── src/
│   ├── main.js           # Vue 入口
│   ├── style.css         # Tailwind 基础样式
│   ├── App.vue           # 根组件
│   ├── api/              # 后端 API 封装
│   ├── store/            # 响应式状态 (user, auth)
│   ├── router/           # 路由配置 + 登录守卫
│   ├── assets/           # Design Token (tokens.css)
│   └── views/            # 16 个页面组件
└── data/                 # 运行时数据（自动生成，不提交）
    ├── database.db
    └── avatars/
```

## 角色权限

| 角色 | 权限 |
|------|------|
| 一线工程师 | 搜索、收藏、评论、好友、个人资料 |
| 管理员 | 以上全部 + 发布/编辑文章、分类标签管理、账号管理 |
| 系统部署人员 | 以上全部 + 租户配置、用户增删改 |

## API 概览

| 模块 | 端点 |
|------|------|
| 认证 | `POST /auth/login` `POST /auth/register` `POST /auth/refresh` `POST /auth/logout` |
| 文章 | `GET/POST /articles` `GET/PUT/DELETE /articles/:id` `POST /articles/:id/like` |
| 评论 | `GET /articles/:id/comments` `POST /comments` `DELETE /comments/:id` |
| 搜索 | `GET/POST/DELETE /user/search-history` |
| 收藏 | `GET/POST/DELETE /user/collections` |
| 历史 | `GET/POST/DELETE /user/history` |
| 好友 | `GET/POST/DELETE /user/friends` `GET /user/search` |
| 消息 | `GET /user/messages` `PUT /user/messages/:id/read` |
| 资料 | `GET/PUT /user/profile` `PUT /user/password` `GET /user/stats` |
| 租户 | `GET/PUT /tenant/config` `POST/PUT/DELETE /tenant/category-tags` `GET /tenant/admins` |
| 管理 | `GET /admin/users` `PUT/DELETE /admin/users/:id` |
| 其他 | `GET /api/health` `GET /avatars/:filename` |

## 前端路由

| 路径 | 页面 | 权限 |
|------|------|------|
| `/login` | 登录 | 公开 |
| `/search` | 搜索首页 | 需登录 |
| `/home` | 技术首页 | 需登录 |
| `/article/:id` | 文章详情 | 需登录 |
| `/publish` | 发布文章 | 管理员+ |
| `/profile` | 个人主页 | 需登录 |
| `/profile/edit` | 编辑资料 | 需登录 |
| `/profile/posts` | 我的文章 | 需登录 |
| `/collection` | 我的收藏 | 需登录 |
| `/history` | 浏览历史 | 需登录 |
| `/message` | 消息通知 | 需登录 |
| `/friend` | 好友管理 | 需登录 |
| `/admin` | 管理中心 | 管理员+ |
| `/admin/users` | 账号管理 | 管理员+ |
| `/admin/config` | 租户配置 | 系统部署人员 |
| `/:pathMatch(.*)*` | 404 页面 | 公开 |

## 配置项

通过环境变量覆盖默认配置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 后端端口 |
| `HOST` | `0.0.0.0` | 监听地址 |
| `JWT_SECRET` | 自动生成 | Access Token 密钥 |
| `JWT_REFRESH_SECRET` | 自动生成 | Refresh Token 密钥 |

密钥优先级：环境变量 > `server/.secrets.json` > 自动生成并持久化。

## License

私有化部署 — 仅供企业内部使用。
