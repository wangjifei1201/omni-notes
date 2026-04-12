# Omni-Notes v2.0 技术实现计划

## 1. 项目结构规划

```
omni-notes-v2/
├── frontend/                 # Next.js 14 前端
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (main)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── history/page.tsx
│   │   │   ├── analysis/[id]/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/              # shadcn/ui 组件
│   │   ├── VideoInput.tsx
│   │   ├── AnalysisProgress.tsx
│   │   ├── VideoInfoBar.tsx
│   │   ├── SummaryTab.tsx
│   │   ├── KeyPointsTab.tsx
│   │   ├── ChaptersTab.tsx
│   │   ├── MindmapTab.tsx
│   │   ├── TranscriptTab.tsx
│   │   ├── HistoryList.tsx
│   │   ├── GroupManager.tsx
│   │   ├── LoginModal.tsx
│   │   ├── RegisterModal.tsx
│   │   └── Sidebar.tsx
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-analysis.ts
│   │   ├── use-analysis-progress.ts
│   │   ├── use-history.ts
│   │   └── use-groups.ts
│   ├── stores/
│   │   ├── auth-store.ts
│   │   ├── analysis-store.ts
│   │   └── ui-store.ts
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   ├── types/
│   │   └── index.ts
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                  # FastAPI 后端
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── video.py
│   │   │   ├── analysis.py
│   │   │   ├── group.py
│   │   │   └── schemas.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── videos.py
│   │   │   ├── analysis.py
│   │   │   ├── history.py
│   │   │   ├── groups.py
│   │   │   └── config.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── bilibili.py
│   │   │   ├── douyin.py
│   │   │   ├── whisper_service.py
│   │   │   ├── ai_service.py
│   │   │   ├── progress_service.py
│   │   │   └── queue_service.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── crypto.py
│   │       ├── sse.py
│   │       └── validators.py
│   ├── alembic/             # 数据库迁移
│   ├── temp/                # 临时音频文件
│   ├── tests/
│   ├── requirements.txt
│   └── run.py
│
├── .specify/
│   └── features/
│       └── omni-notes-v2/
│           ├── spec.md
│           ├── plan.md
│           └── tasks.md
│
├── docker-compose.yml
└── README.md
```

---

## 2. 技术栈确认

### 2.1 前端技术栈
| 技术 | 版本 | 用途 |
|-----|------|------|
| Next.js | 14+ | React 框架，App Router |
| TypeScript | 5+ | 类型安全 |
| Tailwind CSS | 3.4+ | 样式系统 |
| shadcn/ui | latest | UI 组件库 |
| Lucide React | latest | 图标库 |
| Zustand | 4+ | 全局状态管理 |
| TanStack Query | 5+ | 服务端状态管理 |
| Axios | 1.6+ | HTTP 客户端 |

### 2.2 后端技术栈
| 技术 | 版本 | 用途 |
|-----|------|------|
| Python | 3.10+ | 运行时 |
| FastAPI | 0.110+ | Web 框架 |
| SQLAlchemy | 2.0+ | ORM |
| asyncpg | 0.29+ | PostgreSQL 异步驱动 |
| Pydantic | 2+ | 数据验证 |
| passlib | 1.7+ | 密码哈希 (bcrypt) |
| cryptography | 42+ | Fernet 加密 |
| httpx | 0.27+ | 异步 HTTP 客户端 |
| aiofiles | 23+ | 异步文件操作 |

### 2.3 外部依赖
| 服务 | 用途 |
|-----|------|
| PostgreSQL 15+ | 主数据库 |
| yt-dlp | 视频/音频下载 |
| OpenAI Whisper | 语音转文字 |
| 通义千问/OpenAI | AI 内容分析 |

---

## 3. 数据库迁移计划

### 3.1 初始化 SQL
```sql
-- users 表
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_guest BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- user_cookies 表
CREATE TABLE user_cookies (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    cookie_encrypted BYTEA NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- sessions 表
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- analysis_tasks 表
CREATE TABLE analysis_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT CHECK(platform IN ('bilibili', 'douyin')),
    video_id TEXT NOT NULL,
    original_url TEXT NOT NULL,
    title TEXT,
    author TEXT,
    cover TEXT,
    duration INTEGER,
    status TEXT CHECK(status IN ('pending', 'queued', 'running', 'completed', 'failed')),
    queue_position INTEGER DEFAULT 0,
    estimated_wait_seconds INTEGER DEFAULT 0,
    error_message TEXT,
    result JSONB,
    transcript TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);
CREATE INDEX idx_tasks_user_id ON analysis_tasks(user_id);
CREATE INDEX idx_tasks_status ON analysis_tasks(status);
CREATE INDEX idx_tasks_created_at ON analysis_tasks(created_at DESC);

-- groups 表
CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_groups_user_id ON groups(user_id);

-- task_groups 关联表
CREATE TABLE task_groups (
    task_id TEXT REFERENCES analysis_tasks(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, group_id)
);
```

---

## 4. 后端实现计划

### Phase 1: 基础设施 (第 1-2 天)

#### 4.1.1 项目初始化
- [ ] 创建 FastAPI 项目结构
- [ ] 配置 requirements.txt
- [ ] 配置 config.py 环境变量管理
- [ ] 配置 logging

#### 4.1.2 数据库层
- [ ] 配置 database.py 异步连接池
- [ ] 创建 SQLAlchemy ORM 模型 (User, UserCookie, Session, AnalysisTask, Group, TaskGroup)
- [ ] 配置 Alembic 迁移工具
- [ ] 创建初始迁移脚本

#### 4.1.3 工具函数
- [ ] crypto.py: bcrypt 哈希, Fernet 加密/解密, UUID 生成
- [ ] validators.py: URL 验证, 用户名/密码验证
- [ ] sse.py: SSE 事件流工具

### Phase 2: 认证系统 (第 3 天)

#### 4.2.1 用户模型与 Schema
- [ ] Pydantic Schemas: UserCreate, UserLogin, UserResponse
- [ ] SQLAlchemy User 模型完善

#### 4.2.2 认证路由
- [ ] POST /api/auth/register - 注册
- [ ] POST /api/auth/login - 登录 (设置 HttpOnly Cookie)
- [ ] POST /api/auth/logout - 登出
- [ ] POST /api/auth/guest - 创建游客账号
- [ ] GET /api/auth/me - 获取当前用户
- [ ] POST /api/auth/migrate-guest-data - 数据迁移

#### 4.2.3 依赖注入
- [ ] get_current_user() 依赖
- [ ] require_auth() 依赖

### Phase 3: 视频解析服务 (第 4 天)

#### 4.3.1 B站解析服务
- [ ] 短链解析 (b23.tv)
- [ ] BV号提取与视频信息获取
- [ ] Cookie 集成支持

#### 4.3.2 抖音解析服务
- [ ] 短链处理 (v.douyin.com)
- [ ] SSR/RENDER_DATA/JSON-LD 解析
- [ ] 移动端 User-Agent 模拟

#### 4.3.3 解析路由
- [ ] GET /api/resolve/bilibili-short
- [ ] GET /api/resolve/douyin

### Phase 4: 视频分析核心 (第 5-7 天)

#### 4.4.1 队列服务
- [ ] QueueService: asyncio.Queue 管理
- [ ] 并发控制 (MAX_CONCURRENT=2)
- [ ] 队列状态监控
- [ ] 预估等待时间计算

#### 4.4.2 进度服务
- [ ] ProgressService: 内存缓存管理
- [ ] SSE 事件推送实现
- [ ] 心跳机制 (10秒间隔)

#### 4.4.3 Whisper 服务
- [ ] yt-dlp 音频下载
- [ ] Whisper 转文字集成
- [ ] 临时文件管理

#### 4.4.4 AI 分析服务
- [ ] 通义千问 API 集成
- [ ] OpenAI API 集成
- [ ] Prompt 模板设计
- [ ] 结果解析与格式化

#### 4.4.5 分析任务路由
- [ ] POST /api/analysis - 提交任务
- [ ] GET /api/analysis/{task_id}/progress - SSE 进度
- [ ] GET /api/analysis/{task_id} - 获取结果
- [ ] POST /api/analysis/{task_id}/regenerate - 重新生成

#### 4.4.6 后台任务
- [ ] 任务调度器实现
- [ ] 分析流程编排 (extract → download → transcribe → analyze)
- [ ] 错误处理与重试机制

### Phase 5: 历史记录与分组 (第 8 天)

#### 4.5.1 历史记录路由
- [ ] GET /api/history - 获取历史列表
- [ ] DELETE /api/history/{task_id} - 删除记录

#### 4.5.2 分组管理路由
- [ ] GET /api/groups - 获取分组
- [ ] POST /api/groups - 创建分组
- [ ] PUT /api/groups/{group_id} - 更新分组
- [ ] DELETE /api/groups/{group_id} - 删除分组
- [ ] POST /api/groups/{group_id}/tasks/{task_id} - 添加任务
- [ ] DELETE /api/groups/{group_id}/tasks/{task_id} - 移除任务

### Phase 6: 配置系统 (第 9 天)

#### 4.6.1 配置路由
- [ ] GET /api/config - 获取配置
- [ ] PUT /api/config - 更新配置 (AI、Whisper、代理)
- [ ] GET /api/config/cookie - 获取 Cookie
- [ ] PUT /api/config/cookie - 更新 Cookie

---

## 5. 前端实现计划

### Phase 1: 项目初始化 (第 1 天)

#### 5.1.1 Next.js 项目搭建
- [ ] 创建 Next.js 14 项目 (App Router)
- [ ] 配置 TypeScript
- [ ] 配置 Tailwind CSS
- [ ] 配置路径别名

#### 5.1.2 shadcn/ui 配置
- [ ] 初始化 shadcn/ui
- [ ] 安装基础组件: Button, Input, Card, Dialog, Sheet, Tabs, Accordion, DropdownMenu, Select, Checkbox, Switch, Skeleton, Sonner
- [ ] 配置主题与样式

#### 5.1.3 项目结构
- [ ] 创建目录结构 (app, components, hooks, stores, lib, types)
- [ ] 配置环境变量 (.env.local)

### Phase 2: 全局状态与工具 (第 2 天)

#### 5.2.1 API 客户端
- [ ] 配置 Axios 实例
- [ ] 请求/响应拦截器 (Cookie 处理)
- [ ] API 错误统一处理

#### 5.2.2 Zustand Store
- [ ] auth-store: 用户认证状态
- [ ] analysis-store: 分析任务状态
- [ ] ui-store: UI 状态 (侧边栏、主题)

#### 5.2.3 TanStack Query
- [ ] QueryClient 配置
- [ ] 默认选项设置

### Phase 3: 认证页面 (第 3 天)

#### 5.3.1 布局
- [ ] (auth)/layout.tsx - 无侧边栏布局

#### 5.3.2 登录页
- [ ] 登录表单 (用户名/密码)
- [ ] 游客模式按钮
- [ ] 记住我功能
- [ ] 跳转注册链接

#### 5.3.3 注册页
- [ ] 注册表单
- [ ] 表单验证
- [ ] 跳转登录链接

### Phase 4: 主布局与组件 (第 4 天)

#### 5.4.1 主布局
- [ ] (main)/layout.tsx - 带侧边栏布局
- [ ] Sidebar 组件
- [ ] Header/导航组件

#### 5.4.2 Sidebar 组件
- [ ] 用户信息显示
- [ ] 新建分析按钮
- [ ] 历史记录列表
- [ ] 分组列表管理
- [ ] 设置入口

#### 5.4.3 通用组件
- [ ] VideoInput: 视频链接输入
- [ ] PlatformBadge: 平台标识
- [ ] LoadingSpinner: 加载状态

### Phase 5: 首页与分析流程 (第 5-6 天)

#### 5.5.1 首页
- [ ] VideoInput 集成
- [ ] 粘贴按钮
- [ ] Whisper 选项 (开关、模型选择)
- [ ] 开始分析按钮
- [ ] 支持平台展示

#### 5.5.2 分析进度组件
- [ ] AnalysisProgress: 进度条展示
- [ ] SSE 连接管理
- [ ] 队列状态显示 (位置、等待时间)
- [ ] 步骤进度展示

#### 5.5.3 Hooks
- [ ] use-auth: 认证查询
- [ ] use-analysis: 分析结果查询
- [ ] use-analysis-progress: SSE 进度监听

### Phase 6: 分析结果页 (第 7-8 天)

#### 5.6.1 结果页布局
- [ ] VideoInfoBar: 视频信息展示
- [ ] Tab 导航栏

#### 5.6.2 标签组件
- [ ] SummaryTab: 智能摘要
- [ ] KeyPointsTab: 核心要点列表
- [ ] ChaptersTab: 章节速览 (时间戳可点击)
- [ ] MindmapTab: 思维导图展示
- [ ] TranscriptTab: 完整字幕

#### 5.6.3 操作功能
- [ ] 重新生成按钮
- [ ] 导出功能 (可选)
- [ ] 添加到分组

### Phase 7: 历史记录页 (第 9 天)

#### 5.7.1 历史列表
- [ ] HistoryList 组件
- [ ] 分页加载
- [ ] 分组筛选
- [ ] 删除操作

#### 5.7.2 分组管理
- [ ] GroupManager 组件
- [ ] 创建/编辑/删除分组
- [ ] 拖拽排序 (可选)

### Phase 8: 设置页 (第 10 天)

#### 5.8.1 AI 配置
- [ ] 服务商选择 (通义千问/OpenAI)
- [ ] API Key 输入 (加密显示)
- [ ] Base URL 配置
- [ ] 模型选择

#### 5.8.2 Whisper 配置
- [ ] 启用开关
- [ ] 模型选择 (tiny/base/small/medium)

#### 5.8.3 代理配置
- [ ] 启用开关
- [ ] 代理类型选择
- [ ] URL、用户名、密码输入

#### 5.8.4 Cookie 配置
- [ ] B站 Cookie 输入
- [ ] 加密存储提示

---

## 6. 依赖关系图

```
基础设施 (数据库、配置、工具)
    ↓
认证系统 (注册/登录/游客)
    ↓
视频解析 (B站/抖音)
    ↓
分析核心 (队列/进度/AI)
    ↓
历史记录与分组
    ↓
配置系统
```

---

## 7. 关键实现要点

### 7.1 认证安全
- Session ID 使用 UUID4
- Cookie: HttpOnly, Secure, SameSite=Lax
- 密码使用 bcrypt 哈希 (12 rounds)
- Cookie 加密使用 Fernet (AES-128-CBC)

### 7.2 队列管理
- 内存队列: asyncio.Queue
- 最大并发: 2 个任务
- 队列上限: 10 个任务
- SSE 推送队列状态更新

### 7.3 进度跟踪
- 内存缓存: Dict[task_id, TaskProgress]
- 自动清理: 任务完成后 1 小时删除
- SSE 心跳: 10 秒间隔防止超时

### 7.4 错误处理
- 全局异常处理器
- 业务错误码标准化
- 前端友好错误提示

---

## 8. 测试计划

### 8.1 后端测试
- [ ] 单元测试: services/
- [ ] API 测试: routers/
- [ ] 集成测试: 完整分析流程

### 8.2 前端测试
- [ ] 组件测试
- [ ] E2E 测试: 关键用户流程

---

## 9. 部署准备

### 9.1 Docker Compose
- [ ] PostgreSQL 服务
- [ ] 后端服务
- [ ] 前端服务 (可选 Nginx)

### 9.2 环境变量清单
- DATABASE_URL
- COOKIE_ENCRYPTION_KEY
- AI_API_KEY
- AI_BASE_URL
- AI_MODEL
- PROXY_URL (可选)

---

## 10. 预计时间线

| 阶段 | 后端 | 前端 | 并行度 |
|-----|-----|------|-------|
| 基础设施 | 2天 | 1天 | 可并行 |
| 认证系统 | 1天 | 1天 | 可并行 |
| 视频解析 | 1天 | - | 后端先行 |
| 分析核心 | 3天 | 2天 | 部分并行 |
| 历史分组 | 1天 | 1天 | 可并行 |
| 配置系统 | 1天 | 1天 | 可并行 |
| 结果展示 | - | 2天 | 前端 |
| 集成测试 | 1天 | 1天 | 联合测试 |

**总预计: 10-12 个工作日**
