# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 语言要求
- 一直使用简体中文回答。
- 输出代码时，如需新增注释，使用清晰的中文注释。

## 项目概览
Omni-Notes 是一个 AI 驱动的视频分析平台，支持 Bilibili 和抖音链接解析、字幕/语音转写、AI 摘要分析、历史记录、分组收藏、游客/注册/微信小程序登录。

仓库包含三端：
- `backend/`：FastAPI + async SQLAlchemy 后端，暴露 `/api/v1/*` API。
- `frontend/`：Next.js 14 App Router Web 前端。
- `miniprogram/`：微信小程序端，通过 `utils/api.js` 调用同一套后端 API。

## 常用命令

### 后端
```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
python run.py
```

后端默认监听 `http://localhost:8000`，API 文档在 `/docs` 和 `/redoc`。

数据库迁移：
```bash
cd backend
alembic revision --autogenerate -m "描述"
alembic upgrade head
```

### 前端
```bash
cd frontend
npm install
npm run dev      # 实际端口为 3001
npm run build
npm run start
npm run lint
```

注意：`frontend/next.config.mjs` 将 `/api/:path*` 代理到 `http://localhost:8000/api/:path*`；前端 API 客户端默认使用相对路径以保持同源 cookie。

### Docker
```bash
docker-compose up -d
```

该命令启动 PostgreSQL、后端和前端。Compose 前端端口是 `3000`，后端端口是 `8000`。

### 测试现状
仓库当前没有专用测试脚本或 pytest/vitest 配置。修改后优先运行相关构建/检查：后端至少启动或导入验证，前端运行 `npm run lint` 与 `npm run build`。

## 架构要点

### 后端结构
- `backend/app/main.py` 创建 FastAPI 应用，配置 CORS、全局异常处理、健康检查，并挂载 `auth/videos/analysis/history/groups/config` 路由。
- `backend/app/config.py` 使用 `pydantic-settings` 从 `.env` 读取数据库、CORS、AI、Whisper、代理、队列和微信小程序配置。
- `backend/app/database.py` 使用 async SQLAlchemy，`init_db()` 在应用启动时 `create_all`；Alembic 迁移位于 `backend/versions/`，配置在 `backend/alembic.ini`。
- `backend/app/models/` 是 ORM 模型：用户/会话/cookie、分析任务、分组等；`models/schemas.py` 是 API 请求响应模型。
- `backend/app/routers/` 只处理 HTTP 入参、鉴权和响应编排；业务逻辑集中在 `backend/app/services/`。
- `backend/app/dependencies.py` 提供数据库会话、当前用户、登录要求和游客次数限制。

### 视频分析主流程
1. 前端或小程序提交 URL 到 `/api/v1/analysis`。
2. `routers/analysis.py` 校验 URL，调用 `BilibiliService` 或 `DouyinService` 解析视频信息。
3. `analysis_service.create_task()` 写入分析任务。
4. `queue_service` 控制并发和排队；可立即执行时通过 `asyncio.create_task(task_runner.run_task(...))` 后台运行。
5. `task_runner.py` 根据字幕情况决定是否下载音频并用 Whisper 转写，再调用 `ai_service` 生成摘要、要点、章节和思维导图。
6. `progress_service` 维护任务进度；`/api/v1/analysis/{task_id}/progress` 使用 SSE 推送，`/status` 提供轮询状态。
7. 转写结果会进入 `transcript_cache`，避免重复下载/转写。

### 前端结构
- `frontend/app/` 使用 App Router，`(auth)` 放登录/注册页面，`(main)` 放主应用页面、分析详情、历史、分组、设置等。
- `frontend/lib/api.ts` 是 Web 端唯一 API 封装，使用 axios、`withCredentials: true`，按 auth/video/analysis/history/group/config 分组导出。
- `frontend/components/` 包含业务组件和 shadcn/Radix 风格的 `components/ui/*` 基础组件。
- `frontend/stores/` 使用 Zustand 管理客户端状态；`frontend/types/` 放共享 TypeScript 类型。

### 微信小程序结构
- 根目录 `project.config.json` 指向 `miniprogram/`。
- `miniprogram/utils/config.js` 维护开发/生产 API 地址；当前默认生产环境。
- `miniprogram/utils/api.js` 封装 `wx.request`，自动附加 `Authorization: Bearer <auth_token>`。
- 页面位于 `miniprogram/pages/`，覆盖首页、分析详情、历史、分组、个人页和登录注册。

## 配置注意事项
- 后端本地配置从 `backend/.env` 读取；模板是 `backend/.env.example`。
- 关键变量包括 `DATABASE_URL`、`COOKIE_ENCRYPTION_KEY`、`AI_PROVIDER`、`AI_API_KEY`、`AI_MODEL`、`USE_WHISPER`、`WHISPER_MODEL`、`CORS_ORIGINS`、`WECHAT_MINIAPP_APPID`、`WECHAT_MINIAPP_SECRET`。
- 不要读取或泄露真实 `.env` 中的密钥；需要说明配置时引用 `.env.example` 或变量名即可。

## 工作约定
- 保持 KISS，避免过度工程化；只做用户明确要求的改动。
- 修改行为前先读相关文件，不凭空推测。
- 涉及网页浏览/前端 QA 时使用 gstack 的 `/browse` 技能，不使用 `mcp__claude-in-chrome__*` 工具。
- 小程序相关开发、调试、预览、发布或优化时优先使用 `miniprogram-development` 技能。
- Spec-Kit 工作流：`/speckit.specify "功能描述" → /speckit.plan → /speckit.tasks → /speckit.implement`。
