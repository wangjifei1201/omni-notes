# Omni-Notes 扩展设计文档

## 项目信息
- **项目**: Omni-Notes (bilibili-summarizer)
- **设计日期**: 2026-03-29
- **文档状态**: DRAFT

## 新增功能概述

### 1. 抖音视频解析
**需求**: 支持抖音分享口令链接自动解析

**技术方案**:
```
用户输入 v.douyin.com/xxxxx
    ↓
后端 /api/resolve/douyin
    ↓
axios GET 请求（带 User-Agent 模拟移动端）
    ↓
从 HTML 提取 render_data 或 SSR 数据
    ↓
返回 {title, author, duration, cover, desc, platform: 'douyin'}
```

**关键实现点**:
- 抖音分享页有反爬，需要模拟移动端浏览器 User-Agent
- 数据通常在 `window._SSR_HYDRATED_DATA` 或 `<script>window.render_data</script>` 中
- 需要处理 302 重定向

**返回数据结构**:
```json
{
  "platform": "douyin",
  "videoId": "xxxxx",
  "title": "视频标题",
  "author": "作者昵称",
  "authorId": "作者ID",
  "duration": 120,
  "cover": "https://...",
  "desc": "视频描述文案",
  "originalUrl": "https://v.douyin.com/xxxxx"
}
```

---

### 2. B站短链解析
**需求**: b23.tv 短链自动跳转获取真实 BV 号

**技术方案**:
```
用户输入 https://b23.tv/xxxxx
    ↓
后端 /api/resolve/bilibili-short
    ↓
axios HEAD 请求（允许重定向）
    ↓
获取最终 Location URL
    ↓
提取 BV 号
    ↓
复用现有 B站解析逻辑
```

**关键实现点**:
- 使用 `axios` 的 `maxRedirects: 0` 配合 `validateStatus` 捕获 302
- 从 `response.headers.location` 获取真实 URL
- 支持提取 BV 号、avid、ss/ep 等格式

**支持的链接格式**:
- `https://b23.tv/xxxxx`
- `https://bili2233.cn/xxxxx` (B站其他短链域名)
- `https://www.bilibili.com/video/BVxxxxx`
- `https://www.bilibili.com/video/avxxxxx`

---

### 3. 用户注册登录系统
**需求**: 本地简单账号系统，支持注册/登录

**技术方案**:
```
后端 (Node.js + 本地 JSON 文件):
- data/users.json 存储用户数据
- bcryptjs 密码哈希
- 简单的 JWT token 生成

前端:
- 登录/注册页面（CSS Grid 布局）
- localStorage 存储 token 和 username
- 全局登录状态管理
```

**API 设计**:
```javascript
// POST /api/auth/register
// Body: { username, password }
// Response: { success: true, token, username }

// POST /api/auth/login
// Body: { username, password }
// Response: { success: true, token, username }

// POST /api/auth/guest
// Response: { success: true, guestId: 'guest_xxx' }
```

**用户数据结构 (data/users.json)**:
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "testuser",
      "passwordHash": "bcrypt_hash",
      "createdAt": "2026-03-29T...",
      "lastLoginAt": "2026-03-29T..."
    }
  ]
}
```

---

### 4. 游客模式 + 10次限制
**需求**: 游客免登录使用，限10次后强制注册

**技术方案**:
```
游客访问:
    ↓
检查 localStorage: guestUsageCount
    ↓
if count >= 10:
    弹出强制登录弹窗，无法继续使用
else:
    count++
    生成临时 guestId (guest_xxxxxxxx)
    数据存储在 localStorage + IndexedDB（带 guest_ 前缀）
```

**关键实现点**:
- 游客数据隔离：所有 key 加 `guest_${guestId}_` 前缀
- 计数器持久化：localStorage `guestUsageCount`
- 强制登录弹窗：达到限制后禁用分析按钮，弹出模态框

**游客数据结构设计**:
```javascript
// localStorage
{
  "guestId": "guest_abc123",
  "guestUsageCount": 5,
  "guestHistory": [...] // 历史记录ID列表
}

// IndexedDB 表名
"guest_abc123_history"
"guest_abc123_groups"
```

---

### 5. 用户数据隔离
**需求**: 多用户数据完全隔离，游客与登录用户隔离

**技术方案**:
```
登录用户:
    IndexedDB: 表名带 user_${username}_ 前缀
    localStorage: user_${username}_* keys
    服务端 API 可选（当前方案纯本地）

游客:
    IndexedDB: 表名带 guest_${guestId}_ 前缀
    localStorage: guest_* keys
```

**数据切换逻辑**:
```javascript
function switchUser(username) {
    // 清空当前 IndexedDB 连接
    // 重新初始化带前缀的 IndexedDB
    // 加载该用户的历史数据
}
```

---

### 6. 平台来源标识
**需求**: 视频结果页显示来源平台（B站/抖音）

**UI 设计**:
```
视频信息栏新增平台标识:
┌────────────────────────────────────────┐
│ [📺 B站]  视频标题在这里...            │
│          作者: XXX  时长: 12:34        │
└────────────────────────────────────────┘
│ [🎵 抖音] 视频标题在这里...            │
│          作者: XXX  时长: 00:45        │
└────────────────────────────────────────┘
```

**实现**:
- 历史记录数据结构增加 `platform` 字段（'bilibili' | 'douyin'）
- 前端根据 platform 显示不同图标和文字
- CSS 类名区分不同平台样式

---

### 7. 历史数据同步（登录后）
**需求**: 注册登录后，游客数据迁移到用户账号

**技术方案**:
```
用户点击注册/登录:
    ↓
认证成功后
    ↓
检测是否有 guestId 和游客数据
    ↓
询问用户: "是否将当前游客数据迁移到账号?"
    ↓
if yes:
    读取 guest_${guestId}_* 所有 IndexedDB 数据
    写入 user_${username}_* 表
    删除游客数据
    清空 localStorage guest 相关 keys
```

---

## 实施顺序

1. **Step 1**: 抖音分享口令解析接口
2. **Step 2**: B站短链解析接口
3. **Step 3**: 平台标识显示（前端 UI）
4. **Step 4**: 用户注册登录后端 API
5. **Step 5**: 登录/注册页面 UI
6. **Step 6**: 游客模式实现
7. **Step 7**: 数据隔离机制
8. **Step 8**: 游客数据迁移

## 文件修改清单

### 后端 (server.js)
- [ ] 添加 `/api/resolve/douyin` 接口
- [ ] 添加 `/api/resolve/bilibili-short` 接口
- [ ] 添加 `/api/auth/register` 接口
- [ ] 添加 `/api/auth/login` 接口
- [ ] 添加 `/api/auth/guest` 接口
- [ ] 添加用户数据存储逻辑（data/users.json）

### 前端 (index.html)
- [ ] 添加登录/注册页面 HTML/CSS
- [ ] 添加强制登录弹窗组件
- [ ] 修改视频信息栏，添加平台标识
- [ ] 添加用户状态显示（右上角）

### 前端 (JavaScript)
- [ ] 添加用户认证状态管理
- [ ] 添加游客计数逻辑
- [ ] 修改 IndexedDB 初始化，支持前缀隔离
- [ ] 添加数据迁移逻辑

### 依赖
- [ ] 添加 `bcryptjs` 用于密码哈希

---

## 设计确认

**待确认问题**:
1. 抖音解析是否需要支持下载视频？（当前设计仅提取元数据）
2. 用户登录后数据同步是自动还是手动？（当前设计：登录时询问）
3. 是否支持邮箱验证？（当前设计：本地账号，无需验证）
4. 游客次数限制是否按设备/IP？（当前设计：按浏览器 localStorage）

**状态**: 待用户确认后进入实施阶段
