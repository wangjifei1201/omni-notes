# Omni-Notes v2.0 任务列表

## 后端任务

### Phase 1: 基础设施

- [ ] **B1.1** 创建 FastAPI 项目结构
  - 创建 backend/app/ 目录结构
  - 创建 __init__.py 文件
  - 创建 requirements.txt

- [ ] **B1.2** 配置环境管理
  - 创建 app/config.py
  - 实现 Settings 类 (pydantic-settings)
  - 配置数据库 URL、加密密钥等

- [ ] **B1.3** 配置数据库连接
  - 创建 app/database.py
  - 配置 async SQLAlchemy 引擎
  - 创建 AsyncSessionLocal
  - 实现 get_db() 依赖

- [ ] **B1.4** 创建 SQLAlchemy ORM 模型
  - app/models/user.py - User 模型
  - app/models/video.py - Video 相关模型
  - app/models/analysis.py - AnalysisTask 模型
  - app/models/group.py - Group, TaskGroup 模型

- [ ] **B1.5** 创建 Pydantic Schemas
  - app/models/schemas.py
  - UserCreate, UserLogin, UserResponse
  - VideoInfo, AnalysisProgress, AnalysisResult
  - AnalysisTaskResponse, GroupCreate, GroupResponse

- [ ] **B1.6** 配置 Alembic 迁移
  - alembic init
  - 配置 alembic.ini
  - 配置 env.py 使用异步引擎
  - 创建初始迁移

- [ ] **B1.7** 实现工具函数
  - app/utils/crypto.py: bcrypt_hash, fernet_encrypt/decrypt, generate_uuid
  - app/utils/validators.py: validate_url, validate_username, validate_password
  - app/utils/sse.py: sse_event, sse_heartbeat

### Phase 2: 认证系统

- [ ] **B2.1** 实现用户服务
  - app/services/user_service.py
  - create_user(), get_user_by_username()
  - create_guest_user(), migrate_guest_data()

- [ ] **B2.2** 实现 Session 服务
  - app/services/session_service.py
  - create_session(), get_session(), delete_session()
  - session 过期清理

- [ ] **B2.3** 实现认证依赖
  - app/dependencies.py
  - get_current_user() - 从 Cookie 获取用户
  - require_auth() - 要求登录

- [ ] **B2.4** 实现认证路由
  - app/routers/auth.py
  - POST /api/auth/register
  - POST /api/auth/login (设置 HttpOnly Cookie)
  - POST /api/auth/logout
  - POST /api/auth/guest
  - GET /api/auth/me
  - POST /api/auth/migrate-guest-data

### Phase 3: 视频解析

- [ ] **B3.1** 实现 B站解析服务
  - app/services/bilibili.py
  - DouyinService 类
  - 短链解析 (b23.tv → 真实 URL)
  - 视频信息提取 (标题、作者、时长、封面)
  - Cookie 集成

- [ ] **B3.2** 实现抖音解析服务
  - app/services/douyin.py
  - 短链处理 (v.douyin.com)
  - SSR/RENDER_DATA/JSON-LD 解析
  - 移动端 User-Agent 模拟

- [ ] **B3.3** 实现视频解析路由
  - app/routers/videos.py
  - GET /api/resolve/bilibili-short
  - GET /api/resolve/douyin

### Phase 4: 分析核心

- [ ] **B4.1** 实现队列服务
  - app/services/queue_service.py
  - QueueService 类
  - asyncio.Queue 管理
  - 并发控制 (MAX_CONCURRENT=2)
  - 队列状态监控
  - 预估等待时间计算

- [ ] **B4.2** 实现进度服务
  - app/services/progress_service.py
  - ProgressService 类
  - 内存缓存: Dict[task_id, TaskProgress]
  - 更新进度, 获取进度
  - 自动清理策略

- [ ] **B4.3** 实现 Whisper 服务
  - app/services/whisper_service.py
  - WhisperService 类
  - yt-dlp 音频下载
  - Whisper 转文字
  - 临时文件管理

- [ ] **B4.4** 实现 AI 分析服务
  - app/services/ai_service.py
  - AIService 类
  - 通义千问 API 集成
  - OpenAI API 集成
  - Prompt 模板设计
  - 结果解析与格式化

- [ ] **B4.5** 实现分析任务服务
  - app/services/analysis_service.py
  - AnalysisService 类
  - create_task(), get_task(), list_tasks()
  - delete_task(), regenerate_task()
  - 任务状态管理

- [ ] **B4.6** 实现分析路由
  - app/routers/analysis.py
  - POST /api/analysis - 提交任务
  - GET /api/analysis/{task_id}/progress - SSE
  - GET /api/analysis/{task_id} - 获取结果
  - POST /api/analysis/{task_id}/regenerate

- [ ] **B4.7** 实现后台任务调度
  - app/services/task_runner.py
  - 任务调度器
  - 分析流程编排
  - 队列调度循环

- [ ] **B4.8** 实现 SSE 进度推送
  - SSE 事件生成器
  - 心跳机制 (10秒)
  - 队列状态推送
  - 进度状态推送

### Phase 5: 历史记录与分组

- [ ] **B5.1** 实现历史记录服务
  - app/services/history_service.py
  - list_history(), delete_history()
  - 分页查询, 分组筛选

- [ ] **B5.2** 实现分组服务
  - app/services/group_service.py
  - create_group(), update_group(), delete_group()
  - list_groups(), add_task_to_group(), remove_task_from_group()

- [ ] **B5.3** 实现历史记录路由
  - app/routers/history.py
  - GET /api/history
  - DELETE /api/history/{task_id}

- [ ] **B5.4** 实现分组路由
  - app/routers/groups.py
  - GET /api/groups
  - POST /api/groups
  - PUT /api/groups/{group_id}
  - DELETE /api/groups/{group_id}
  - POST /api/groups/{group_id}/tasks/{task_id}
  - DELETE /api/groups/{group_id}/tasks/{task_id}

### Phase 6: 配置系统

- [ ] **B6.1** 实现配置服务
  - app/services/config_service.py
  - get_config(), update_config()
  - get_cookie(), update_cookie()
  - 配置加密存储

- [ ] **B6.2** 实现配置路由
  - app/routers/config.py
  - GET /api/config
  - PUT /api/config
  - GET /api/config/cookie
  - PUT /api/config/cookie

### Phase 7: 主应用集成

- [ ] **B7.1** 创建 FastAPI 主应用
  - app/main.py
  - 创建 FastAPI 实例
  - 配置 CORS
  - 配置异常处理器
  - 注册所有路由

- [ ] **B7.2** 创建启动脚本
  - run.py
  - 启动配置
  - uvicorn 运行

- [ ] **B7.3** 创建数据库初始化脚本
  - init_db.py
  - 创建所有表

---

## 前端任务

### Phase 1: 项目初始化

- [ ] **F1.1** 创建 Next.js 项目
  - npx shadcn@latest init
  - 选择 Next.js, TypeScript, Tailwind

- [ ] **F1.2** 安装 shadcn/ui 组件
  - npx shadcn add button input card dialog sheet tabs accordion dropdown-menu select checkbox switch skeleton sonner

- [ ] **F1.3** 安装依赖
  - npm install zustand @tanstack/react-query axios lucide-react

- [ ] **F1.4** 配置环境变量
  - .env.local
  - NEXT_PUBLIC_API_URL=http://localhost:8000

### Phase 2: 全局状态与工具

- [ ] **F2.1** 配置 API 客户端
  - lib/api.ts
  - Axios 实例配置
  - 请求/响应拦截器
  - 错误处理

- [ ] **F2.2** 创建类型定义
  - types/index.ts
  - User, VideoInfo, AnalysisTask, AnalysisResult
  - Group, Progress 等类型

- [ ] **F2.3** 创建 Zustand Store
  - stores/auth-store.ts
  - stores/analysis-store.ts
  - stores/ui-store.ts

- [ ] **F2.4** 配置 TanStack Query
  - 创建 QueryProvider
  - 配置 QueryClient

### Phase 3: 认证页面

- [ ] **F3.1** 创建认证布局
  - app/(auth)/layout.tsx
  - 无侧边栏布局
  - 居中卡片样式

- [ ] **F3.2** 创建登录页
  - app/(auth)/login/page.tsx
  - 登录表单
  - 游客模式按钮
  - 表单验证

- [ ] **F3.3** 创建注册页
  - app/(auth)/register/page.tsx
  - 注册表单
  - 表单验证

### Phase 4: 主布局与组件

- [ ] **F4.1** 创建主布局
  - app/(main)/layout.tsx
  - 带侧边栏布局
  - 响应式设计

- [ ] **F4.2** 创建 Sidebar 组件
  - components/Sidebar.tsx
  - 用户信息显示
  - 新建分析按钮
  - 历史记录列表
  - 分组列表
  - 设置入口

- [ ] **F4.3** 创建通用组件
  - components/VideoInput.tsx
  - components/PlatformBadge.tsx
  - components/LoadingSpinner.tsx

### Phase 5: 首页与分析流程

- [ ] **F5.1** 创建首页
  - app/(main)/page.tsx
  - 标题和描述
  - VideoInput 集成
  - Whisper 选项
  - 开始分析按钮

- [ ] **F5.2** 创建分析进度组件
  - components/AnalysisProgress.tsx
  - 进度条展示
  - 队列状态显示
  - 步骤进度

- [ ] **F5.3** 创建 Hooks
  - hooks/use-auth.ts
  - hooks/use-analysis.ts
  - hooks/use-analysis-progress.ts (SSE)

### Phase 6: 分析结果页

- [ ] **F6.1** 创建结果页布局
  - app/(main)/analysis/[id]/page.tsx
  - VideoInfoBar 组件
  - Tab 导航

- [ ] **F6.2** 创建标签组件
  - components/SummaryTab.tsx
  - components/KeyPointsTab.tsx
  - components/ChaptersTab.tsx
  - components/MindmapTab.tsx
  - components/TranscriptTab.tsx

- [ ] **F6.3** 创建视频信息栏
  - components/VideoInfoBar.tsx
  - 视频标题、作者、时长
  - 重新生成按钮

### Phase 7: 历史记录与分组

- [ ] **F7.1** 创建历史记录页
  - app/(main)/history/page.tsx
  - 历史列表
  - 分页加载
  - 分组筛选

- [ ] **F7.2** 创建历史列表组件
  - components/HistoryList.tsx
  - 历史项卡片
  - 删除操作
  - 添加到分组

- [ ] **F7.3** 创建分组管理组件
  - components/GroupManager.tsx
  - 创建/编辑/删除分组
  - 分组列表

- [ ] **F7.4** 创建分组 Hooks
  - hooks/use-history.ts
  - hooks/use-groups.ts

### Phase 8: 设置页

- [ ] **F8.1** 创建设置页
  - app/(main)/settings/page.tsx
  - Tab 分组: AI/Whisper/代理/Cookie

- [ ] **F8.2** 创建 AI 配置组件
  - AI 服务商选择
  - API Key 输入
  - Base URL 配置
  - 模型选择

- [ ] **F8.3** 创建 Whisper 配置组件
  - 启用开关
  - 模型选择

- [ ] **F8.4** 创建代理配置组件
  - 启用开关
  - 类型选择
  - URL、认证信息

- [ ] **F8.5** 创建 Cookie 配置组件
  - B站 Cookie 输入
  - 保存按钮

---

## Docker & 部署

- [ ] **D1** 创建 Docker Compose 配置
  - docker-compose.yml
  - PostgreSQL 服务
  - 后端服务
  - 前端服务

- [ ] **D2** 创建 Dockerfile (后端)
  - backend/Dockerfile
  - Python 3.10+ 基础镜像
  - 依赖安装
  - 启动命令

- [ ] **D3** 创建 Dockerfile (前端)
  - frontend/Dockerfile
  - Node 18+ 基础镜像
  - 构建和启动

- [ ] **D4** 更新文档
  - README.md
  - 部署说明
  - 环境变量清单

---

## 测试任务

- [ ] **T1** 后端单元测试
  - tests/test_services/
  - tests/test_routers/

- [ ] **T2** 后端集成测试
  - 完整分析流程测试
  - 认证流程测试

- [ ] **T3** 前端组件测试
  - 关键组件测试

- [ ] **T4** E2E 测试
  - 关键用户流程

---

## 任务统计

| 类型 | 数量 |
|-----|------|
| 后端任务 | 47 |
| 前端任务 | 42 |
| Docker & 部署 | 4 |
| 测试任务 | 4 |
| **总计** | **97** |

---

## 依赖关系

```
B1.x 基础设施
    ↓
B2.x 认证系统 + F3.x 认证页面
    ↓
B3.x 视频解析
    ↓
B4.x 分析核心 + F5.x 首页/进度
    ↓
B5.x 历史分组 + F7.x 历史页面
    ↓
F6.x 结果页
    ↓
B6.x 配置系统 + F8.x 设置页
    ↓
D.x Docker & 部署
    ↓
T.x 测试
```

---

## 执行建议

### 并行执行策略
1. **Week 1**: B1.x + B2.x + F1.x + F2.x + F3.x (基础设施 + 认证)
2. **Week 2**: B3.x + B4.1-4 + F4.x + F5.x (解析 + 队列 + 首页)
3. **Week 3**: B4.5-8 + F6.x + F7.x (分析服务 + 结果页 + 历史)
4. **Week 4**: B5.x + B6.x + F8.x + D.x + T.x (历史/分组/配置/部署/测试)
