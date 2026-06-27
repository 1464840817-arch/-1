// server/seed.js
// 种子数据 — 首次启动时写入数据库

import bcrypt from 'bcryptjs'
import { queryOne, execute } from './db.js'

export default async function seed() {
  // ==================== 种子用户 ====================
  const adminExists = queryOne("SELECT id FROM users WHERE account = 'admin'")
  if (!adminExists) {
    const hashed = await bcrypt.hash('admin123', 10)
    execute(
      'INSERT INTO users (account, password, name, role, department, desc) VALUES (?, ?, ?, ?, ?, ?)',
      ['admin', hashed, '系统部署员', '系统部署人员', '信息技术部', '平台超级管理员，负责系统配置与用户管理。'],
    )
    console.log('[seed] 超级管理员已创建 (admin / admin123)')
  }

  const engExists = queryOne("SELECT id FROM users WHERE account = 'ENG_20240601'")
  if (!engExists) {
    const hashed = await bcrypt.hash('123456', 10)
    execute(
      'INSERT INTO users (account, password, name, role, department, desc) VALUES (?, ?, ?, ?, ?, ?)',
      ['ENG_20240601', hashed, '张工', '一线工程师', '自动化部', '专注于西门子 PLC 与变频器调试，乐于分享工业自动化经验。'],
    )
    console.log('[seed] 测试工程师已创建 (ENG_20240601 / 123456)')
  }

  // 添加额外种子用户（用于好友和评论功能）
  const liExists = queryOne("SELECT id FROM users WHERE account = 'ENG_20230512'")
  if (!liExists) {
    const hashed = await bcrypt.hash('123456', 10)
    execute(
      'INSERT INTO users (account, password, name, role, department, desc) VALUES (?, ?, ?, ?, ?, ?)',
      ['ENG_20230512', hashed, '李工', '一线工程师', '自动化部', '擅长汇川变频器与伺服驱动调试。'],
    )
  }
  const wangExists = queryOne("SELECT id FROM users WHERE account = 'ENG_20240108'")
  if (!wangExists) {
    const hashed = await bcrypt.hash('123456', 10)
    execute(
      'INSERT INTO users (account, password, name, role, department, desc) VALUES (?, ?, ?, ?, ?, ?)',
      ['ENG_20240108', hashed, '王工', '一线工程师', '设备维护部', '三菱 PLC 与触摸屏通讯专家。'],
    )
  }
  const zhaoExists = queryOne("SELECT id FROM users WHERE account = 'ENG_20231105'")
  if (!zhaoExists) {
    const hashed = await bcrypt.hash('123456', 10)
    execute(
      'INSERT INTO users (account, password, name, role, department, desc) VALUES (?, ?, ?, ?, ?, ?)',
      ['ENG_20231105', hashed, '赵工', '一线工程师', '设备部', '汇川 MD500 系列变频器应用经验丰富。'],
    )
  }

  // ==================== 种子文章 ====================
  const articleExists = queryOne("SELECT id FROM articles WHERE id = 1")
  if (!articleExists) {
    const articles = [
      {
        type: '西门子 S7-1200',
        title: 'PLC 输出点无信号排查',
        desc: '西门子 S7-1200 PLC 的一个输出点（Q0.0）无法正常输出 24V 信号，导致外部继电器无法吸合。',
        author: '张工',
        date: '2026/06/23 14:30',
        likes: 120,
        comments: 23,
        views: 1280,
        tags: JSON.stringify(['元器件故障', 'PLC类']),
        steps: JSON.stringify([
          '检查负载电源是否正常接入。',
          '检查外部继电器线圈是否存在短路现象。',
          '查看 PLC 程序逻辑，确认 Q0.0 是否被强制或者被互锁。',
          '使用万用表测量 PLC 输出端子的电压。',
        ]),
      },
      {
        type: '汇川 变频器',
        title: '过压故障 Err.03 处理办法',
        desc: '汇川 MD380 变频器在减速停机时频繁报 Err.03（过压），检查母线电压在停机瞬间超过 800V。',
        author: '李工',
        date: '2026/06/22 09:15',
        likes: 85,
        comments: 12,
        views: 960,
        tags: JSON.stringify(['变频器', '元器件故障']),
        steps: JSON.stringify([
          '检查制动电阻是否损坏或阻值变大。',
          '适当延长减速时间（P8.11 参数）。',
          '检查输入电源电压是否偏高。',
          '如频繁出现，考虑加装能耗制动单元。',
        ]),
      },
      {
        type: '三菱 FX3U',
        title: 'PLC 与触摸屏通讯中断',
        desc: '三菱 FX3U-48MR 与威纶通触摸屏通过 RS485 通讯，运行中频繁出现通讯中断报警。',
        author: '王工',
        date: '2026/06/15 08:30',
        likes: 45,
        comments: 6,
        views: 540,
        tags: JSON.stringify(['通讯', 'PLC类']),
        steps: JSON.stringify([
          '检查 RS485 接线是否牢固，A/B 端子有无接反。',
          '检查站号设置，确保 PLC 与触摸屏站号不冲突。',
          '检查通讯参数（波特率、数据位、停止位、校验）是否两端一致。',
          '测量终端电阻是否接入，长距离通讯需加 120Ω 终端电阻。',
        ]),
      },
    ]

    for (const a of articles) {
      execute(
        `INSERT INTO articles (type, title, "desc", author, date, likes, comments, views, tags, steps)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [a.type, a.title, a.desc, a.author, a.date, a.likes, a.comments, a.views, a.tags, a.steps],
      )
    }
    console.log(`[seed] ${articles.length} 篇种子文章已创建`)
  }

  // ==================== 种子评论 ====================
  const commentExists = queryOne("SELECT id FROM comments WHERE id = 1")
  if (!commentExists) {
    execute(
      "INSERT INTO comments (id, article_id, author, content, created_at) VALUES (1, 1, '李工', '这个方法太实用了！我们产线上也有一台 S7-1200 出现过类似问题，按你的步骤查果然是继电器线圈短路，换了个继电器就好了。', '2026-06-24 16:50')"
    )
    execute(
      "INSERT INTO comments (id, article_id, author, content, created_at) VALUES (2, 1, '王工', '排查步骤写得很清楚！请教一下，Q0.0 如果被强制了，在博图里怎么看？', '2026-06-23 20:15')"
    )
    execute(
      `INSERT INTO comments (id, article_id, author, content, reply_to, created_at) VALUES (3, 1, '张工', '在博图里打开在线监控，右键 Q0.0 查看“强制表”就能看到。如果被强制会有黄色标记。', 2, '2026-06-23 20:40')`
    )
    execute(
      `INSERT INTO comments (id, article_id, author, content, reply_to, created_at) VALUES (4, 1, '赵工', '补充一点：如果是高频动作的继电器，建议选用固态继电器替代，寿命更长。', 1, '2026-06-24 18:05')`
    )
    execute(
      `INSERT INTO comments (id, article_id, author, content, created_at) VALUES (5, 2, '赵工', '我们用的是汇川 MD500 系列，参数设置上有些差异，请教一下 P8.11 对应的是哪个功能码？', '2026-06-23 15:30')`
    )
    execute(
      `INSERT INTO comments (id, article_id, author, content, reply_to, created_at) VALUES (6, 2, '张工', 'MD500 的减速时间参数是 P6.11，选“斜坡减速时间”就可以了。', 5, '2026-06-23 16:10')`
    )
    execute(
      "INSERT INTO comments (id, article_id, author, content, created_at) VALUES (7, 3, '李工', '我们车间也遇到过通讯干扰的问题，后来发现是变频器电缆和通讯电缆走同一个桥架，分开后就好了。', '2026-06-22 09:30')"
    )
    execute(
      "INSERT INTO comments (id, article_id, author, content, reply_to, created_at) VALUES (8, 3, '张工', '电磁干扰确实是通讯中断的头号元凶，强弱电分离是基本原则。', 7, '2026-06-22 10:15')"
    )
    console.log('[seed] 8 条评论已创建')
  }

  // ==================== 种子消息（发送给张工 userId=2） ====================
  const msgExists = queryOne("SELECT id FROM messages WHERE id = 1")
  if (!msgExists) {
    execute(
      "INSERT INTO messages (id, user_id, type, sender, action, content, target_id, unread, created_at) VALUES (1, 2, 'comment', '李工', '评论了你的文章', '这个方法太实用了！我们产线上也有一台 S7-1200 出现过类似问题，按你的步骤查果然是继电器线圈短路。', 1, 1, '2026-06-25 16:50')"
    )
    execute(
      "INSERT INTO messages (id, user_id, type, sender, action, content, target_id, unread, created_at) VALUES (2, 2, 'collect', '王工', '收藏了你的文章', '《PLC 输出点无信号排查》', 1, 1, '2026-06-25 15:10')"
    )
    execute(
      "INSERT INTO messages (id, user_id, type, sender, action, content, target_id, unread, created_at) VALUES (3, 2, 'reply', '李工', '回复了你的评论', '电磁干扰确实是通讯中断的头号元凶，强弱电分离是基本原则。', 3, 1, '2026-06-25 13:30')"
    )
    execute(
      "INSERT INTO messages (id, user_id, type, sender, action, content, target_id, unread, created_at) VALUES (4, 2, 'like', '赵工', '赞了你的文章', '《过压故障 Err.03 处理办法》', 2, 0, '2026-06-24 18:20')"
    )
    execute(
      "INSERT INTO messages (id, user_id, type, sender, action, content, target_id, unread, created_at) VALUES (5, 2, 'system', '系统通知', '', '平台已更新至 v2.1 版本，新增故障标签筛选与全文搜索功能，欢迎使用。', null, 0, '2026-06-24 09:00')"
    )
    console.log('[seed] 5 条消息已创建')
  }

  // ==================== 种子好友关系（张三<->李四 互加好友） ====================
  const friendExists = queryOne("SELECT user_id FROM user_friends WHERE user_id = 2 AND friend_id = 3")
  if (!friendExists) {
    execute('INSERT INTO user_friends (user_id, friend_id) VALUES (2, 3)')
    execute('INSERT INTO user_friends (user_id, friend_id) VALUES (3, 2)')
    execute('INSERT INTO user_friends (user_id, friend_id) VALUES (2, 4)')
    execute('INSERT INTO user_friends (user_id, friend_id) VALUES (4, 2)')
    console.log('[seed] 好友关系已创建')
  }

  // ==================== 种子标签 ====================
  const tagExists = queryOne("SELECT id FROM category_tags WHERE name = '元器件故障'")
  if (!tagExists) {
    const tags = ['PLC类', '变频器', '通讯', '元器件故障', '故障排查']
    for (const t of tags) {
      execute('INSERT INTO category_tags (name) VALUES (?)', [t])
    }
    console.log(`[seed] ${tags.length} 个分类标签已创建`)
  }
}
