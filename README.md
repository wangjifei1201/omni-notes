# Omni-Notes v2.0

AI 驱动的视频分析平台，支持 Bilibili 和抖音视频的内容提取与智能分析。

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 功能特性

-  **视频解析**: 支持 Bilibili (b23.tv) 和抖音分享链接
-  **AI 分析**: 智能摘要、核心要点、章节速览、思维导图
-  **字幕提取**: 支持字幕下载与 AI 语音识别 (Whisper)
-  **历史管理**: 分析历史记录，支持分组和收藏
-  **用户系统**: 支持注册登录和游客模式
-  **多 AI 支持**: 通义千问 / OpenAI 可选

## 技术栈

### 前端
- Next.js 14 (App Router)
- TypeScript 5
- Tailwind CSS 3.4
- shadcn/ui
- Zustand (状态管理)
- TanStack Query

### 后端
- FastAPI 0.110
- SQLAlchemy 2.0 (异步)
- PostgreSQL 15
- yt-dlp (视频下载)
- OpenAI Whisper (语音识别)

## 快速开始

### 环境要求
- Python 3.10+
- Node.js 18+
- PostgreSQL 15+

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/omni-notes.git
cd omni-notes
```

### 2. 启动后端

```bash
cd backend

# 创建虚拟环境
conda activate omni-notes 

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，配置数据库和 AI API 密钥

# 初始化数据库
alembic upgrade head

# 启动服务
python run.py
```

后端服务将在 http://localhost:8000 启动

### 3. 启动前端

```bash
cd frontend

# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build
npm start
```

前端将在 http://localhost:3000 启动

### 4. Docker 一键部署

```bash
# 配置环境变量
cp backend/.env.example .env
# 编辑 .env 文件

# 启动所有服务
docker-compose up -d
```

访问 http://localhost:3000

## 项目结构

```
omni-notes/
├── backend/           # FastAPI 后端
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/   # API 路由
│   │   ├── services/  # 业务逻辑
│   │   └── models/    # 数据模型
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/          # Next.js 前端
│   ├── app/          # 页面路由
│   ├── components/   # UI 组件
│   ├── stores/       # 状态管理
│   └── Dockerfile
│
├── docker-compose.yml
└── DEPLOY.md         # 详细部署文档
```

## 配置说明

### 后端环境变量 (.env)

```env
# 数据库 (必需)
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/omni_notes

# 安全 (必需)
COOKIE_ENCRYPTION_KEY=your-secret-key-must-be-32-bytes-long!

# AI 配置 (必需)
AI_PROVIDER=bailian      # bailian 或 openai
AI_API_KEY=your-api-key
AI_MODEL=qwen-max        # qwen-max, gpt-4, 等

# 可选配置
USE_WHISPER=true
WHISPER_MODEL=base
MAX_CONCURRENT_TASKS=2
```

### 前端环境变量

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API 文档

启动后端后访问:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 部署

详细部署文档请参考 [DEPLOY.md](./DEPLOY.md)

支持部署方式:
- 手动部署
- Docker Compose
- Kubernetes (待完善)

## 开发计划

- [x] 用户认证系统
- [x] 视频解析 (B站/抖音)
- [x] AI 分析核心
- [x] 历史记录管理
- [x] 分组功能
- [ ] 浏览器插件
- [ ] 移动端 App
- [ ] 多语言支持

## 贡献

欢迎提交 Issue 和 Pull Request!

## 许可证

MIT License

## 致谢

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - 视频下载
- [OpenAI Whisper](https://github.com/openai/whisper) - 语音识别
- [FastAPI](https://fastapi.tiangolo.com/) - Web 框架
- [Next.js](https://nextjs.org/) - React 框架
