# Omni-Notes v2.0 产品需求文档 (PRD)

## 文档信息
- **版本**: v2.0
- **日期**: 2026-03-29
- **状态**: 已确认
- **产品名称**: Omni-Notes 智能视频笔记助手

---

## 1. 产品概述

### 1.1 产品定位
Omni-Notes 是一款基于 AI 的多平台视频内容分析工具，支持 B站、抖音等主流视频平台。用户通过粘贴视频链接，即可获得 AI 生成的视频摘要、章节划分、思维导图等智能笔记。

### 1.2 目标用户
- **学生群体**：快速获取课程/讲座核心内容
- **职场人士**：高效消化行业视频/培训材料
- **内容创作者**：分析竞品视频结构和文案
- **研究者**：整理学术演讲/会议记录

### 1.3 核心价值
| 价值点 | 描述 |
|-------|------|
| 节省时间 | 10分钟视频 → 30秒掌握核心 |
| 结构清晰 | AI自动划分章节，思维导图呈现 |
| 结构清晰 | AI自动划分章节，思维导图呈现 |
| 数据安全 | 本地部署，用户数据隔离 |

### 1.4 技术架构

```
┌─────────────────────────────────────────────────────────┐
│  前端 (Next.js 14 + TypeScript)                          │
│  ├── App Router                                          │
│  ├── Shadcn/UI + Tailwind CSS                            │
│  ├── Zustand (状态管理)                                  │
│  ├── TanStack Query (服务端状态)                         │
│  └── Lucide Icons                                        │
├─────────────────────────────────────────────────────────┤
│  后端 (FastAPI + Python 3.10+)                           │
│  ├── SQLAlchemy 2.0 (async)                              │
│  ├── asyncpg (PostgreSQL)                                │
│  ├── SSE (实时进度推送)                                  │
│  └── Simple Session + HttpOnly Cookie (认证)               │
├─────────────────────────────────────────────────────────┤
│  数据层                                                  │
│  ├── PostgreSQL (用户、历史记录、任务)                   │
│  ├── 内存缓存 (任务进度、队列状态)                       │
│  └── 临时文件 (音频，转录后删除)                         │
├─────────────────────────────────────────────────────────┤
│  外部服务                                                │
│  ├── yt-dlp - 视频/音频下载                              │
│  ├── OpenAI Whisper - 语音转文字                         │
│  └── 通义千问/OpenAI - AI内容分析                        │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈详情

### 2.1 前端技术栈
| 技术 | 版本 | 用途 |
|-----|------|------|
| Next.js | 14+ | React 框架，App Router |
| TypeScript | 5+ | 类型安全 |
| Tailwind CSS | 3.4+ | 样式 |
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
| passlib | 1.7+ | 密码哈希 |
| cryptography | 42+ | Cookie 加密 (Fernet) |
| httpx | 0.27+ | 异步 HTTP 客户端 |
| aiofiles | 23+ | 异步文件操作 |

---

## 3. 数据库设计

### 3.1 数据库选型
- **类型**: PostgreSQL 15+
- **驱动**: asyncpg
- **ORM**: SQLAlchemy 2.0 (async session)
- **连接**: `postgresql+asyncpg://user:password@localhost:5432/omni_notes`

### 3.2 表结构

#### users - 用户表
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,                      -- UUID
    username TEXT UNIQUE NOT NULL,            -- 用户名
    password_hash TEXT NOT NULL,              -- bcrypt 哈希
    is_guest BOOLEAN DEFAULT FALSE,           -- 是否游客
    usage_count INTEGER DEFAULT 0,            -- 使用次数（游客用）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME
);
```

#### user_cookies - B站 Cookie 表（加密存储）
```sql
CREATE TABLE user_cookies (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,                   -- 'bilibili', 'douyin'
    cookie_encrypted BYTEA NOT NULL,          -- Fernet 加密后的 Cookie
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
**加密说明**:
- 使用 Fernet (AES-128-CBC) 对称加密
- 密钥存储在环境变量 `COOKIE_ENCRYPTION_KEY`
- 加密后的数据以 BYTEA 类型存储

#### sessions - Session 表
```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                      -- session_id (UUID)
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP NOT NULL,            -- 过期时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- 索引用于快速查询和过期清理
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
```

#### analysis_tasks - 分析任务表
```sql
CREATE TABLE analysis_tasks (
    id TEXT PRIMARY KEY,                      -- task_xxx
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT CHECK(platform IN ('bilibili', 'douyin')),
    video_id TEXT NOT NULL,                   -- BV号/抖音ID
    original_url TEXT NOT NULL,               -- 原始链接
    title TEXT,                               -- 视频标题
    author TEXT,                              -- 作者
    cover TEXT,                               -- 封面URL
    duration INTEGER,                         -- 时长(秒)
    status TEXT CHECK(status IN ('pending', 'queued', 'running', 'completed', 'failed')),
    queue_position INTEGER DEFAULT 0,         -- 队列位置（仅 queued 状态有效）
    estimated_wait_seconds INTEGER DEFAULT 0, -- 预计等待秒数
    error_message TEXT,                       -- 错误信息
    result JSONB,                             -- AI分析结果(JSONB)
    transcript TEXT,                          -- 完整字幕
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,                     -- 开始执行时间
    completed_at TIMESTAMP
);
-- 索引
CREATE INDEX idx_tasks_user_id ON analysis_tasks(user_id);
CREATE INDEX idx_tasks_status ON analysis_tasks(status);
CREATE INDEX idx_tasks_created_at ON analysis_tasks(created_at DESC);
```

#### groups - 分组表
```sql
CREATE TABLE groups (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                       -- 分组名称
    sort_order INTEGER DEFAULT 0,             -- 排序
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_groups_user_id ON groups(user_id);
```

#### task_groups - 任务分组关联表
```sql
CREATE TABLE task_groups (
    task_id TEXT REFERENCES analysis_tasks(id) ON DELETE CASCADE,
    group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, group_id)
);
```

### 3.3 内存存储设计

#### 任务进度缓存（内存 Dict + 定期清理）
```python
# 内存中存储任务实时进度，不持久化到数据库
# 结构: {task_id: TaskProgress}
task_progress_cache: dict[str, TaskProgress] = {}

class TaskProgress:
    task_id: str
    step: str           # extract/download/transcribe/analyze
    step_status: str    # pending/running/completed/error/skipped
    percent: int        # 0-100
    message: str
    updated_at: datetime

# 清理策略：任务完成后 1 小时删除，或最多保留 1000 条
```

#### 任务队列管理（内存 Queue）
```python
# Whisper 分析队列（限制并发数）
WHISPER_MAX_CONCURRENT = 1  # 同时只能有 1 个 Whisper 任务在执行
whisper_queue: asyncio.Queue = asyncio.Queue()
whisper_running: set[str] = set()  # 正在执行的任务ID

# 队列信息暴露给 API 用于计算等待时间
queue_stats: dict = {
    "queued_count": 0,
    "running_count": 0,
    "avg_task_duration": 300  # 平均任务耗时（秒），动态更新
}
```

---

## 4. API 接口设计

### 4.1 认证相关

#### POST /api/auth/register
用户注册
```typescript
// Request
{
  username: string;      // 3-20字符
  password: string;      // 最少6字符
}

// Response
{
  success: boolean;
  user: {
    id: string;
    username: string;
  };
}
```

#### POST /api/auth/login
用户登录（设置 HttpOnly Cookie）
```typescript
// Request
{
  username: string;
  password: string;
}

// Response
{
  success: boolean;
  user: {
    id: string;
    username: string;
  };
}
// 同时设置 Cookie: session_id=xxx; HttpOnly; Secure; SameSite=Lax
```

#### POST /api/auth/logout
登出（清除 Cookie）
```typescript
// Response
{ success: true }
```

#### POST /api/auth/guest
创建游客账号
```typescript
// Response
{
  success: boolean;
  user: {
    id: string;
    is_guest: true;
    usage_count: 0;
  };
}
```

#### GET /api/auth/me
获取当前用户信息
```typescript
// Response
{
  id: string;
  username: string;
  is_guest: boolean;
  usage_count: number;
}
```

### 4.2 视频解析

#### GET /api/resolve/douyin
抖音链接解析
```typescript
// Query: ?url=https://v.douyin.com/xxxxx

// Response
{
  platform: 'douyin';
  video_id: string;
  title: string;
  author: string;
  author_id: string;
  duration: number;
  cover: string;
  desc: string;
}
```

#### GET /api/resolve/bilibili-short
B站短链解析
```typescript
// Query: ?url=https://b23.tv/xxxxx

// Response
{
  platform: 'bilibili';
  type: 'video';
  id: string;           // BV号
  resolved_url: string;
}
```

### 4.3 视频分析

#### POST /api/analysis
提交分析任务
```typescript
// Request
{
  url: string;              // 视频链接
  use_whisper: boolean;     // 是否使用语音转文字
  whisper_model?: string;   // tiny/base/small/medium
}

// Response
{
  task_id: string;
  status: 'queued' | 'running';  // queued=在队列中等待, running=立即执行
  queue_info?: {                 // 仅在 status='queued' 时返回
    position: number;            // 队列位置（第几位）
    estimated_wait_seconds: number;  // 预计等待秒数
    ahead_count: number;         // 前面有多少个任务
  };
}

// 429 响应（队列已满）
{
  error: 'QUEUE_FULL';
  message: '当前分析任务过多，请稍后重试';
  retry_after: number;  // 建议多少秒后重试
}
```

#### GET /api/analysis/{task_id}/progress
获取分析进度（SSE）
```
Content-Type: text/event-stream

# 队列中等待时的心跳
event: queue
data: {"status":"queued","position":3,"estimated_wait_seconds":420,"message":"队列中，前面还有 3 个任务"}

# 开始执行
event: progress
data: {"step":"extract","status":"running","percent":0,"message":"正在获取视频信息..."}

data: {"step":"download","status":"running","percent":50,"message":"下载中..."}

data: {"step":"analyze","status":"running","percent":90,"message":"AI分析中..."}

data: {"step":"analyze","status":"completed","percent":100,"message":"分析完成"}
```

**心跳机制**：每 10 秒发送一次 ping，防止 nginx 超时
```
event: ping
data: {}
```

#### GET /api/analysis/{task_id}
获取分析结果
```typescript
// Response
{
  id: string;
  platform: 'bilibili' | 'douyin';
  video_id: string;
  title: string;
  author: string;
  cover: string;
  duration: number;
  status: 'completed';
  result: {
    summary: string;
    key_points: Array<{
      point: string;
      detail: string;
    }>;
    chapters: Array<{
      time: string;
      title: string;
      summary: string;
    }>;
    mindmap: {
      root: string;
      branches: Array<{
        title: string;
        items: string[];
      }>;
    };
  };
  transcript: Array<{
    time: string;
    text: string;
  }>;
  created_at: string;
}
```

#### POST /api/analysis/{task_id}/regenerate
重新生成分析
```typescript
// Response
{ task_id: string; status: 'pending' }
```

### 4.4 历史记录

#### GET /api/history
获取历史记录列表
```typescript
// Query: ?page=1&limit=20&group_id=xxx

// Response
{
  items: Array<{
    id: string;
    platform: string;
    title: string;
    author: string;
    cover: string;
    duration: number;
    status: string;
    created_at: string;
    group_ids: string[];
  }>;
  total: number;
}
```

#### DELETE /api/history/{task_id}
删除历史记录

### 4.5 分组管理

#### GET /api/groups
获取分组列表
```typescript
// Response
{
  groups: Array<{
    id: string;
    name: string;
    sort_order: number;
    item_count: number;
  }>;
}
```

#### POST /api/groups
创建分组
```typescript
// Request
{ name: string }

// Response
{ id: string; name: string; sort_order: number }
```

#### PUT /api/groups/{group_id}
更新分组

#### DELETE /api/groups/{group_id}
删除分组

#### POST /api/groups/{group_id}/tasks/{task_id}
添加任务到分组

#### DELETE /api/groups/{group_id}/tasks/{task_id}
从分组移除任务

### 4.6 配置

#### GET /api/config
获取配置
```typescript
// Response
{
  ai_provider: 'bailian' | 'openai';
  base_url: string;
  model: string;
  use_whisper: boolean;
  whisper_model: string;
  proxy_enabled: boolean;
  proxy_type: 'direct' | 'private';
  proxy_url?: string;
  proxy_api_url?: string;
}
```

#### PUT /api/config
更新配置
```typescript
// Request
{
  ai_provider?: string;
  api_key?: string;        // 仅保存，不回显
  base_url?: string;
  model?: string;
  use_whisper?: boolean;
  whisper_model?: string;
  proxy?: {
    enabled: boolean;
    type: string;
    url?: string;
    api_url?: string;
    username?: string;
    password?: string;
  };
}
```

#### GET /api/config/cookie
获取 Cookie 配置
```typescript
// Response
{
  bilibili_cookie?: string;
}
```

#### PUT /api/config/cookie
更新 Cookie

---

## 5. 前端设计

### 5.1 页面结构

```
app/
├── (auth)/                    # 认证相关页面组
│   ├── layout.tsx             # 无侧边栏布局
│   ├── login/
│   │   └── page.tsx
│   └── register/
│       └── page.tsx
│
├── (main)/                    # 主应用页面组
│   ├── layout.tsx             # 带侧边栏布局
│   ├── page.tsx               # 首页（视频输入）
│   ├── history/
│   │   └── page.tsx           # 历史记录
│   ├── analysis/
│   │   └── [id]/
│   │       └── page.tsx       # 分析结果页
│   └── settings/
│       └── page.tsx           # 设置页
│
├── api/                       # Next.js API Routes（可选代理）
│
├── layout.tsx                 # 根布局
└── globals.css                # 全局样式
```

### 5.2 组件清单

#### Shadcn/UI 基础组件
- Button, Input, Label
- Card, Dialog, Sheet
- Tabs, Accordion
- DropdownMenu, ContextMenu
- Select, Checkbox, Switch
- Skeleton, Spinner
- Toast (Sonner)

#### 业务组件
| 组件名 | 用途 |
|-------|------|
| VideoInput | 视频链接输入框 |
| AnalysisProgress | 分析进度展示 |
| PlatformBadge | 平台来源标识 |
| VideoInfoBar | 视频信息栏 |
| SummaryTab | 智能摘要标签 |
| KeyPointsTab | 核心要点标签 |
| ChaptersTab | 章节速览标签 |
| MindmapTab | 思维导图标签 |
| TranscriptTab | 完整字幕标签 |
| HistoryList | 历史记录列表 |

### 5.3 状态管理设计

#### Zustand Store
```typescript
// stores/auth-store.ts
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isLoginModalOpen: boolean;
  setUser: (user: User | null) => void;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

// stores/analysis-store.ts
interface AnalysisState {
  currentTaskId: string | null;
  progress: AnalysisProgress | null;
  isAnalyzing: boolean;
  setCurrentTask: (taskId: string) => void;
  setProgress: (progress: AnalysisProgress) => void;
  reset: () => void;
}

// stores/ui-store.ts
interface UIState {
  sidebarOpen: boolean;
  activeTab: string;
  toggleSidebar: () => void;
  setActiveTab: (tab: string) => void;
}
```

#### TanStack Query Hooks
```typescript
// hooks/use-auth.ts
export function useAuth() {
  return useQuery({
    queryKey: ['auth'],
    queryFn: fetchCurrentUser,
  });
}

// hooks/use-analysis.ts
export function useAnalysis(taskId: string) {
  return useQuery({
    queryKey: ['analysis', taskId],
    queryFn: () => fetchAnalysis(taskId),
    enabled: !!taskId,
  });
}

// hooks/use-analysis-progress.ts (SSE)
export function useAnalysisProgress(taskId: string) {
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    const eventSource = new EventSource(
      `${API_BASE}/api/analysis/${taskId}/progress`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data);
    };

    return () => eventSource.close();
  }, [taskId]);

  return progress;
}
```

### 5.4 关键页面原型

#### 登录页
```
┌─────────────────────────────────────────┐
│                                         │
│         📝 Omni-Notes                   │
│      智能视频笔记助手                   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  [📱 登录] [📝 注册]             │   │
│  │                                 │   │
│  │  用户名                         │   │
│  │  ┌─────────────────────────┐   │   │
│  │  │                         │   │   │
│  │  └─────────────────────────┘   │   │
│  │                                 │   │
│  │  密码                           │   │
│  │  ┌─────────────────────────┐   │   │
│  │  │                         │   │   │
│  │  └─────────────────────────┘   │   │
│  │                                 │   │
│  │  [ ] 记住我                     │   │
│  │                                 │   │
│  │  ┌─────────────────────────┐   │   │
│  │  │        登 录            │   │   │
│  │  └─────────────────────────┘   │   │
│  │                                 │   │
│  │  ───────── 或 ────────────      │   │
│  │                                 │   │
│  │  ┌─────────────────────────┐   │   │
│  │  │      👤 游客模式        │   │   │
│  │  └─────────────────────────┘   │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

#### 首页（视频输入）
```
┌─────────────────────────────────────────────────────────┐
│ 📝 Omni-Notes          [⚙️] [👤 用户名 ▼]               │ ← 顶部导航
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ [+ 新建] │           智能视频笔记助手                   │
│          │        粘贴视频链接，AI一键总结              │
│  历史    │                                              │
│  ─────   │    ┌──────────────────────────────────┐     │
│  记录1   │    │ 🔗 https://...              [粘贴]│     │
│  记录2   │    │                                  │     │
│  ─────   │    │ [     📺 开始分析            ]   │     │
│  记录3   │    └──────────────────────────────────┘     │
│          │                                              │
│  分组    │    支持平台：                                │
│  ├📁分组1│    [📺 B站] [🎵 抖音]                         │
│  └📁分组2│                                              │
│          │    ☑️ 无字幕时使用语音转文字                  │
│          │    模型：[base ▼]                            │
│          │                                              │
│          │    ─────── 功能特性 ───────                  │
│          │    📝 AI摘要  📑 章节  🧠 导图              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

#### 分析结果页
```
┌─────────────────────────────────────────────────────────┐
│ 📝 Omni-Notes                                           │
├──────────┬──────────────────────────────────────────────┤
│          │ [📺 B站] 视频标题...              [🔄]    │
│  侧边栏  │ 作者：XXX    时长：12:34                      │
│          │                                               │
│  历史    │ ┌────────┬────────┬────────┬────────┬─────┐ │
│  列表    │ │📋摘要  │⭐要点  │📑章节  │🧠导图  │ │
│          │ ├────────┴────────┴────────┴────────┴─────┤ │
│          │ │                                          │ │
│  分组    │ │  [标签内容区域]                          │ │
│  列表    │ │                                          │ │
│          │ │                                          │ │
│          │ └──────────────────────────────────────────┘ │
│          │                                               │
└──────────┴──────────────────────────────────────────────┘
```

---

## 6. 后端设计

### 6.1 项目结构
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI 入口
│   ├── config.py               # 配置管理
│   ├── database.py             # 数据库连接
│   ├── dependencies.py         # FastAPI Dependencies
│   ├── models/                 # Pydantic + SQLAlchemy Models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── video.py
│   │   ├── analysis.py
│   │   └── schemas.py          # Pydantic Schemas
│   ├── routers/                # API 路由
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── videos.py
│   │   ├── analysis.py
│   │   ├── history.py
│   │   ├── groups.py
│   │   └── config.py
│   ├── services/               # 业务逻辑
│   │   ├── __init__.py
│   │   ├── bilibili.py         # B站解析
│   │   ├── douyin.py           # 抖音解析
│   │   ├── whisper_service.py  # 语音转文字
│   │   ├── ai_service.py       # AI 分析
│   │   └── progress_service.py # 进度管理
│   └── utils/
│       ├── __init__.py
│       ├── crypto.py           # 密码/Token 工具
│       ├── sse.py              # SSE 工具
│       └── validators.py       # 验证工具
├── data/                       # SQLite 数据库目录
├── tests/                      # 测试
├── requirements.txt
└── run.py                      # 启动脚本
```

### 6.2 核心类型定义

```python
# app/models/schemas.py
from pydantic import BaseModel, Field
from typing import Literal, Optional, List
from datetime import datetime

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserResponse(UserBase):
    id: str
    is_guest: bool
    created_at: datetime

    class Config:
        from_attributes = True

class VideoInfo(BaseModel):
    platform: Literal["bilibili", "douyin"]
    video_id: str
    title: str
    author: str
    author_id: Optional[str] = None
    duration: int
    cover: str
    original_url: str

class AnalysisProgress(BaseModel):
    step: Literal["extract", "download", "transcribe", "analyze"]
    step_status: Literal["pending", "running", "completed", "error", "skipped"]
    percent: int = Field(..., ge=0, le=100)
    message: str

class AnalysisResult(BaseModel):
    summary: str
    key_points: List[dict]
    chapters: List[dict]
    mindmap: dict

class AnalysisTaskResponse(BaseModel):
    id: str
    platform: str
    video_id: str
    title: Optional[str]
    author: Optional[str]
    cover: Optional[str]
    duration: Optional[int]
    status: str
    result: Optional[AnalysisResult]
    created_at: datetime

    class Config:
        from_attributes = True
```

### 6.3 关键服务实现

#### 抖音解析服务
```python
# app/services/douyin.py
import httpx
import re
from typing import Optional
from app.models.schemas import VideoInfo

class DouyinService:
    MOBILE_HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 "
            "Mobile/15E148 Safari/604.1"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }

    @staticmethod
    async def resolve(url: str) -> VideoInfo:
        # 1. 处理短链，获取真实 URL
        async with httpx.AsyncClient(
            follow_redirects=False,
            timeout=10.0
        ) as client:
            try:
                resp = await client.head(url, headers=DouyinService.MOBILE_HEADERS)
                real_url = str(resp.headers.get("location", url))
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 302:
                    real_url = str(e.response.headers.get("location", url))
                else:
                    raise

        # 2. 获取页面内容
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                real_url,
                headers=DouyinService.MOBILE_HEADERS
            )
            html = resp.text

        # 3. 提取 SSR 数据
        video_info = DouyinService._extract_from_html(html, url)
        return video_info

    @staticmethod
    def _extract_from_html(html: str, original_url: str) -> VideoInfo:
        # 尝试 SSR_HYDRATED_DATA
        ssr_match = re.search(
            r'<script[^>]*>window\._SSR_HYDRATED_DATA\s*=\s*([^<]+)</script>',
            html
        )
        if ssr_match:
            # 解析 JSON 提取数据
            pass

        # 尝试 RENDER_DATA
        render_match = re.search(
            r'<script[^>]*>window\._RENDER_DATA\s*=\s*([^<]+)</script>',
            html
        )
        if render_match:
            pass

        # 尝试 JSON-LD
        jsonld_match = re.search(
            r'<script type="application/ld\+json">([^<]+)</script>',
            html
        )
        if jsonld_match:
            pass

        raise ValueError("无法解析视频信息")
```

#### SSE 进度推送
```python
# app/routers/analysis.py
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
import asyncio
import json

router = APIRouter()

@router.get("/api/analysis/{task_id}/progress")
async def analysis_progress(task_id: str):
    async def event_generator():
        while True:
            # 查询最新进度
            progress = await progress_service.get_latest(task_id)

            yield f"data: {json.dumps(progress)}\n\n"

            if progress["step_status"] in ("completed", "error"):
                break

            await asyncio.sleep(1)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
```

---

## 7. 业务逻辑

### 7.1 游客模式流程
```
用户访问首页
    ↓
检查 Cookie 是否有 session_id
    ↓
无 → 后端创建游客账号 (/api/auth/guest)
    → 返回 {user_id, is_guest: true, usage_count: 0}
    → 设置 Cookie
    ↓
用户点击"开始分析"
    ↓
检查 usage_count >= 10
    ↓
是 → 弹出强制登录 Modal
    → 禁用分析按钮
    ↓
否 → usage_count++
    → 继续分析流程
```

### 7.2 视频分析流程（含队列机制）
```
用户提交链接
    ↓
前端判断平台
    ├─ B站短链 → GET /api/resolve/bilibili-short
    ├─ B站长链 → 提取 BV/AV 号
    └─ 抖音链接 → GET /api/resolve/douyin
    ↓
POST /api/analysis
    → 检查当前运行任务数 >= MAX_CONCURRENT?
    ├─ 是 → 任务入队 (status: queued)
    │        → 计算队列位置 & 预计等待时间
    │        → 返回 {task_id, status: queued, queue_info: {...}}
    └─ 否 → 立即执行 (status: running)
             → 返回 {task_id, status: running}
    ↓
前端连接 SSE: /api/analysis/{task_id}/progress
    → 如果 queued: 每 10 秒推送 queue 事件（位置、等待时间）
    → 如果 running: 推送 progress 事件（步骤进度）
    ↓
队列调度器（当有空闲槽位时）
    → 从队列取出下一个任务
    → 更新状态: queued → running
    → 启动后台任务
    ↓
后端后台任务:
    1. extract: 获取视频信息
    2. download: yt-dlp 下载音频（如果需要）
    3. transcribe: Whisper 转文字（如果需要）
    4. analyze: AI 分析生成摘要/要点/章节/导图
    ↓
分析完成 → SSE 推送 completed → 前端跳转结果页
    ↓
触发队列调度 → 检查是否有 queued 任务
```

**并发控制配置**:
```python
MAX_CONCURRENT_TASKS = 2  # 同时最多 2 个任务在执行
MAX_QUEUE_SIZE = 10       # 队列最多 10 个任务等待
```

### 7.3 数据迁移流程（游客→注册用户）
```
游客点击"注册/登录"
    ↓
完成注册/登录
    ↓
后端检测到该设备有游客数据
    ↓
返回响应中包含 has_guest_data: true
    ↓
前端显示提示："是否将游客数据迁移到账号？"
    ↓
用户确认
    ↓
POST /api/auth/migrate-guest-data
    → 将游客 task 更新 user_id
    → 将游客 group 更新 user_id
    → 删除游客账号
    → 刷新页面
```

---

## 8. 部署方案

### 8.1 手动部署步骤

#### 1. 环境准备
```bash
# 系统要求
- Python 3.10+
- Node.js 18+
- ffmpeg (用于 Whisper)
- yt-dlp (pip install yt-dlp)
```

#### 2. 后端部署
```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
export DATABASE_URL="postgresql+asyncpg://user:password@localhost:5432/omni_notes"
export COOKIE_ENCRYPTION_KEY="your-secret-key-here"  # Fernet 密钥

# 初始化数据库（自动创建表）
python -m app.init_db

# 启动服务
python run.py
# 或 uvicorn app.main:app --host 0.0.0.0 --port 8000
```

#### 3. 前端部署
```bash
cd frontend

# 安装依赖
npm install

# 配置 API 地址
# 创建 .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000

# 构建
npm run build

# 启动
npm start
# 或开发模式: npm run dev
```

### 8.2 生产环境建议
```bash
# 安装 PostgreSQL（如未安装）
# Ubuntu/Debian: sudo apt install postgresql
# macOS: brew install postgresql
# 然后创建数据库和用户

# 使用进程管理器
pip install gunicorn

# 启动 FastAPI (单进程，因为任务队列在内存)
# 如需多 worker，需改用 Redis 等外部队列
gunicorn app.main:app -w 1 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

# 使用 PM2 管理 Next.js
npm install -g pm2
pm2 start npm --name "omni-notes" -- start
```

**注意**：当前设计使用内存队列管理 Whisper 任务，如需多 worker 部署，需改用 Redis/RabbitMQ 作为外部队列。

### 8.3 目录权限
```
backend/
├── temp/               # 临时文件目录（音频），需要读写权限
├── logs/               # 日志目录
└── .env                # 环境变量文件（包含密钥，需 600 权限）
```
└── logs/               # 日志目录
```

---

## 9. 安全考虑

### 9.1 认证安全
- 密码使用 bcrypt 哈希
- Session 设置合理过期时间（如 7 天）
- HttpOnly Cookie 防止 XSS
- SameSite=Lax 防止 CSRF

### 9.2 输入验证
- 所有接口使用 Pydantic 模型验证
- 文件名/路径清理防止目录遍历
- URL 白名单限制

### 9.3 资源限制
- 分析任务并发数限制
- 音频文件大小限制
- 请求频率限制（可选）

---

## 10. 错误处理

### 10.1 错误码定义
| 错误码 | 含义 | 前端处理 |
|-------|------|---------|
| 400 | 请求参数错误 | 显示具体错误信息 |
| 401 | 未认证 | 跳转登录页或显示登录弹窗 |
| 403 | 游客次数用尽 | 显示强制登录弹窗 |
| 404 | 资源不存在 | 显示 404 页面 |
| 429 | 请求过于频繁 | 提示稍后重试 |
| 500 | 服务器错误 | 提示"服务异常，请稍后重试" |

### 10.2 业务错误提示
| 场景 | 提示文案 |
|-----|---------|
| 未配置 AI Key | "请先完成 AI 配置" |
| Whisper 未安装 | "未检测到 Whisper，请在设置中配置" |
| 视频无字幕 | "该视频无字幕，已自动使用语音转文字" |
| 抖音解析失败 | "无法解析抖音链接，请检查链接是否有效" |
| 分析超时 | "分析超时，请稍后重试或调整视频长度" |
| 队列已满 | "当前分析任务过多，建议 {retry_after} 秒后重试" |
| 排队等待中 | "前方还有 {position} 个任务，预计等待 {minutes} 分钟" |

---

## 11. 性能指标

| 指标 | 目标值 |
|-----|-------|
| 页面首屏加载 | < 2s |
| 抖音解析时间 | < 3s |
| B站短链解析 | < 1s |
| 登录/注册响应 | < 500ms |
| 历史记录加载 | < 500ms (100条) |
| 分析任务完成 | 视频时长/4 |

---

## 12. 版本规划

### v2.0.0 (当前)
- [x] Next.js 14 + FastAPI 重构
- [x] PostgreSQL 数据存储
- [x] 抖音视频解析
- [x] 用户注册登录
- [x] 游客模式 + 10次限制
- [x] SSE 实时进度（内存存储）
- [x] Whisper 任务队列（限制并发）
- [x] 分组管理
- [x] Cookie 加密存储

### v2.1.0 (未来)
- [ ] 多语言界面
- [ ] 更多平台（YouTube、快手）
- [ ] 批量分析
- [ ] 插件系统

### v2.2.0 (未来)
- [ ] 云端同步
- [ ] 团队协作
- [ ] 移动端 App

---

## 13. 待确认清单（已确认）

| 问题 | 方案 |
|-----|------|
| 数据库 | PostgreSQL 15+ (asyncpg + SQLAlchemy 2.0) |
| 前端状态管理 | Zustand + TanStack Query |
| 实时进度 | SSE (内存存储，非数据库) |
| 认证方式 | Simple Session + HttpOnly Cookie |
| 部署方式 | 手动部署 |
| 前端框架 | Next.js 14 + App Router |
| UI 组件 | Shadcn/UI + Tailwind CSS |
| 图标 | Lucide Icons |
| 音频文件 | 转录后立即删除 |
| 任务队列 | 内存队列，限制并发数 MAX_CONCURRENT=2 |
| Cookie 加密 | Fernet (AES-128-CBC) 对称加密 |
| 分组功能 | v2.0 保留实现 |
| 分组管理入口 | 分组标签栏右侧"⋮"按钮，点击打开分组管理面板 |

---

## 14. 小程序历史页面交互设计

### 14.1 页面结构

```
┌─────────────────────────────────────────────────────────┐
│  分析历史                                    [空]       │ ← 导航栏（无右侧按钮）
├─────────────────────────────────────────────────────────┤
│  🔍 搜索历史记录...                               ✕    │ ← 搜索栏
├─────────────────────────────────────────────────────────┤
│  [全部25] [未分组8] [技术教程12] [产品课程5] ... [⋮]   │ ← 分组标签栏
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 2024年AI发展趋势...        [移入分组]  ✓已完成  │  │ ← 历史卡片
│  │  1. 多模态大模型...                              │  │
│  │  2. AI Agent应用...                              │  │
│  │  科技频道 · B站 · 今天 14:30                      │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ Python编程入门...              ⟳进行中        │  │
│  │  1. Python环境搭建...                              │  │
│  │  编程课堂 · B站 · 今天 10:15                      │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│   [首页]      [历史]      [我的]                       │ ← TabBar
└─────────────────────────────────────────────────────────┘
```

### 14.2 导航栏设计
- 标题：分析历史
- 左侧：无（或系统返回键）
- 右侧：空（避免被小程序系统返回键遮挡）
- 分组管理入口：移至分组标签栏最右侧"⋮"按钮

### 14.3 分组标签栏
- 横向滚动，支持多个分组标签
- 标签项：全部、未分组、自定义分组
- 最右侧：管理按钮"⋮"，点击打开分组管理面板

### 14.4 历史卡片结构
```
┌─────────────────────────────────────────────────────┐
│ [标题-最多2行]              [移入分组] [状态标签]   │
│ [要点1: xxx]                                      │
│ [要点2: xxx]                                      │
│ [作者] · [平台] · [时间]                          │
└─────────────────────────────────────────────────────┘
```
- 标题行：标题（flex:1）+ 移入分组按钮 + 状态标签
- 要点列表：最多显示3个要点，带序号
- 元信息行：作者 · 平台 · 时间

### 14.5 分组选择面板
```
┌─────────────────────────────┐
│         ○ (手柄)            │
│      选择分组    [取消]     │
├─────────────────────────────┤
│  ● 技术教程    12 个视频   │
│  ● 产品课程     5 个视频   │
│  ⊕ 新建分组（紫色文字）   │
└─────────────────────────────┘
```
- 面板从底部弹出
- 分组项带彩色圆点标识
- 底部"新建分组"项使用虚线圆圈

### 14.6 分组管理面板
```
┌─────────────────────────────┐
│         ○ (手柄)            │
│      管理分组    [完成]     │
├─────────────────────────────┤
│  + 新建分组                 │
├─────────────────────────────┤
│  ● 技术教程    12 个视频   │
│     [编辑] [删除]          │
│  ● 产品课程     5 个视频   │
│     [编辑] [删除]          │
└─────────────────────────────┘
```
- 面板从底部弹出
- 顶部"新建分组"按钮
- 分组列表：圆点 + 分组信息 + 操作按钮
- 编辑/删除按钮在同一行

---

**PRD 已确认完毕，可以进入开发阶段。**

---

## 14. CEO 评审决策记录

### 评审日期
2026-03-29

### 关键决策

| # | 决策项 | 选择 | 理由 |
|---|--------|------|------|
| 1 | 后端技术栈 | **完整重写为 FastAPI** | 追求长期技术栈统一，Python 生态更适合 AI 功能 |
| 2 | 数据库 | **立即迁移到 PostgreSQL** | 为后续扩展和多用户场景做准备 |
| 3 | 任务队列 | **v2.0 内存队列，v2.1 Redis** | 快速交付 v2.0，接受单实例限制 |
| 4 | 安全修复 | **接受并实施** | 任务 ID 权限校验 + AI 密钥加密 |

### 已知风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 服务重启导致队列任务丢失 | 高 | v2.1 迁移到 Redis；v2.0 文档说明限制 |
| 重写引入新的解析 Bug | 中 | 保留现有测试用例；灰度发布 |
| PostgreSQL 运维复杂度 | 低 | 提供 Docker Compose 一键启动 |

### v2.1 规划
- [ ] Redis 任务队列（持久化 + 多实例支持）
- [ ] YouTube 视频解析支持
- [ ] 导出功能（Notion/Obsidian 格式）

### 安全修复清单（v2.0 必须完成）
- [ ] 所有 `/api/analysis/{task_id}` 接口添加用户权限校验
- [ ] AI API 密钥使用 Fernet 加密存储
- [ ] 添加 `task_groups` 表的 RLS 策略或应用层校验
