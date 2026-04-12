# Omni-Notes v2.0 功能规格说明

## 功能概述

基于 PRD-Omni-Notes-v2-Final.md 实现的智能视频笔记助手，支持 B站、抖音等主流视频平台的 AI 内容分析。

---

## 功能清单

### 1. 用户认证系统
- **注册**: 用户名(3-20字符) + 密码(最少6字符)
- **登录**: 用户名/密码验证，设置 HttpOnly Cookie
- **登出**: 清除 Session Cookie
- **游客模式**: 自动创建游客账号，限制 10 次使用
- **数据迁移**: 游客注册时迁移历史数据

### 2. 视频解析服务
- **B站短链解析**: `/api/resolve/bilibili-short`
- **抖音链接解析**: `/api/resolve/douyin`
- **视频信息提取**: 标题、作者、时长、封面

### 3. 视频分析核心
- **任务提交**: 支持选择 Whisper 语音转文字
- **队列管理**: 最大并发 2 任务，队列上限 10 任务
- **实时进度**: SSE 推送 extract/download/transcribe/analyze 各阶段
- **AI 分析结果**:
  - 智能摘要 (summary)
  - 核心要点 (key_points)
  - 章节速览 (chapters)
  - 思维导图 (mindmap)
  - 完整字幕 (transcript)
- **重新生成**: 支持重新分析同一视频

### 4. 历史记录管理
- **列表查询**: 分页加载，支持按分组筛选
- **单条删除**: 软删除或硬删除
- **分组管理**: 创建/编辑/删除分组，任务分组关联

### 5. 系统配置
- **AI 配置**: 通义千问/OpenAI 切换，API Key 加密存储
- **Whisper 配置**: 开关、模型选择 (tiny/base/small/medium)
- **代理配置**: 直连/私有代理，支持认证
- **Cookie 配置**: B站 Cookie 加密存储

---

## 技术架构

### 前端
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript 5+
- **样式**: Tailwind CSS 3.4+
- **组件**: shadcn/ui + Lucide Icons
- **状态**: Zustand (客户端) + TanStack Query (服务端)

### 后端
- **框架**: FastAPI 0.110+
- **语言**: Python 3.10+
- **数据库**: PostgreSQL 15+ (asyncpg + SQLAlchemy 2.0)
- **认证**: Simple Session + HttpOnly Cookie (Fernet 加密)

### 外部服务
- **视频下载**: yt-dlp
- **语音转文字**: OpenAI Whisper
- **AI 分析**: 通义千问 / OpenAI

---

## 数据库表结构

### users - 用户表
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT PK | UUID |
| username | TEXT UNIQUE | 用户名 |
| password_hash | TEXT | bcrypt 哈希 |
| is_guest | BOOLEAN | 是否游客 |
| usage_count | INTEGER | 使用次数 |
| created_at | TIMESTAMP | 创建时间 |

### user_cookies - Cookie 加密存储
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | SERIAL PK | 自增ID |
| user_id | TEXT FK | 用户ID |
| platform | TEXT | bilibili/douyin |
| cookie_encrypted | BYTEA | Fernet 加密数据 |

### analysis_tasks - 分析任务表
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT PK | task_xxx |
| user_id | TEXT FK | 用户ID |
| platform | TEXT | bilibili/douyin |
| video_id | TEXT | BV号/抖音ID |
| title/author/cover | TEXT | 视频信息 |
| duration | INTEGER | 时长(秒) |
| status | TEXT | pending/queued/running/completed/failed |
| queue_position | INTEGER | 队列位置 |
| result | JSONB | AI分析结果 |
| transcript | TEXT | 完整字幕 |

### groups - 分组表
| 字段 | 类型 | 说明 |
|-----|------|------|
| id | TEXT PK | 分组ID |
| user_id | TEXT FK | 用户ID |
| name | TEXT | 分组名称 |
| sort_order | INTEGER | 排序 |

### task_groups - 任务分组关联
| 字段 | 类型 | 说明 |
|-----|------|------|
| task_id | TEXT FK | 任务ID |
| group_id | TEXT FK | 分组ID |

---

## API 接口清单

### 认证相关
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/logout` - 用户登出
- `POST /api/auth/guest` - 创建游客账号
- `GET /api/auth/me` - 获取当前用户
- `POST /api/auth/migrate-guest-data` - 迁移游客数据

### 视频解析
- `GET /api/resolve/douyin?url=` - 抖音链接解析
- `GET /api/resolve/bilibili-short?url=` - B站短链解析

### 视频分析
- `POST /api/analysis` - 提交分析任务
- `GET /api/analysis/{task_id}/progress` - SSE 进度推送
- `GET /api/analysis/{task_id}` - 获取分析结果
- `POST /api/analysis/{task_id}/regenerate` - 重新生成

### 历史记录
- `GET /api/history?page=&limit=&group_id=` - 获取历史列表
- `DELETE /api/history/{task_id}` - 删除历史记录

### 分组管理
- `GET /api/groups` - 获取分组列表
- `POST /api/groups` - 创建分组
- `PUT /api/groups/{group_id}` - 更新分组
- `DELETE /api/groups/{group_id}` - 删除分组
- `POST /api/groups/{group_id}/tasks/{task_id}` - 添加任务到分组
- `DELETE /api/groups/{group_id}/tasks/{task_id}` - 从分组移除任务

### 配置
- `GET /api/config` - 获取配置
- `PUT /api/config` - 更新配置
- `GET /api/config/cookie` - 获取 Cookie 配置
- `PUT /api/config/cookie` - 更新 Cookie

---

## 页面结构

```
app/
├── (auth)/
│   ├── layout.tsx          # 无侧边栏布局
│   ├── login/page.tsx      # 登录页
│   └── register/page.tsx   # 注册页
├── (main)/
│   ├── layout.tsx          # 带侧边栏布局
│   ├── page.tsx            # 首页（视频输入）
│   ├── history/page.tsx    # 历史记录
│   ├── analysis/[id]/page.tsx  # 分析结果页
│   └── settings/page.tsx   # 设置页
├── layout.tsx              # 根布局
└── globals.css             # 全局样式
```

---

## 核心业务逻辑

### 游客模式流程
1. 用户访问首页
2. 检查 Cookie 是否有 session_id
3. 无则创建游客账号，设置 Cookie
4. 使用时检查 usage_count >= 10
5. 是则弹出强制登录 Modal

### 视频分析流程
1. 用户提交链接
2. 前端判断平台并解析
3. POST /api/analysis 提交任务
4. 检查并发数，决定立即执行或入队
5. 前端连接 SSE 获取实时进度
6. 队列调度器按序执行任务
7. 后台执行: extract → download → transcribe → analyze
8. 分析完成推送 completed 事件

### 队列机制
- MAX_CONCURRENT_TASKS = 2
- MAX_QUEUE_SIZE = 10
- 队列满时返回 429 QUEUE_FULL
- SSE 推送队列位置和预计等待时间

---

## 安全要求

1. **认证安全**: bcrypt 哈希密码，HttpOnly Cookie，SameSite=Lax
2. **输入验证**: Pydantic 模型验证所有接口
3. **权限校验**: 所有 task 接口验证用户权限
4. **加密存储**: Cookie 和 API Key 使用 Fernet 加密
5. **资源限制**: 并发数、文件大小、请求频率限制

---

## 性能指标

| 指标 | 目标值 |
|-----|-------|
| 页面首屏加载 | < 2s |
| 抖音解析时间 | < 3s |
| B站短链解析 | < 1s |
| 登录/注册响应 | < 500ms |
| 历史记录加载 | < 500ms (100条) |
| 分析任务完成 | 视频时长/4 |

---

## 错误处理

| 错误码 | 场景 | 前端处理 |
|-------|------|---------|
| 400 | 请求参数错误 | 显示具体错误信息 |
| 401 | 未认证 | 跳转登录页或显示登录弹窗 |
| 403 | 游客次数用尽 | 显示强制登录弹窗 |
| 404 | 资源不存在 | 显示 404 页面 |
| 429 | 请求过于频繁/队列已满 | 提示稍后重试 |
| 500 | 服务器错误 | 提示"服务异常，请稍后重试" |
