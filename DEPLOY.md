# Omni-Notes v2.0 部署文档

## 项目概述

Omni-Notes 是一个 AI 驱动的视频分析平台，支持 Bilibili 和抖音视频的内容提取与智能分析。

**技术栈:**
- 前端: Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- 后端: FastAPI + SQLAlchemy 2.0 + PostgreSQL
- AI: Tongyi Qianwen / OpenAI

---

## 目录结构

```
omni-notes-v2/
├── backend/              # FastAPI 后端
│   ├── app/
│   │   ├── main.py      # 应用入口
│   │   ├── routers/     # API 路由
│   │   ├── services/    # 业务逻辑
│   │   └── models/      # 数据模型
│   ├── requirements.txt # Python 依赖
│   ├── alembic.ini      # 数据库迁移配置
│   └── .env.example     # 环境变量模板
│
├── frontend/            # Next.js 前端
│   ├── app/            # 页面组件
│   ├── components/     # UI 组件
│   ├── lib/            # 工具函数
│   ├── stores/         # Zustand 状态
│   └── package.json    # Node 依赖
│
└── .specify/           # 项目规格文档
```

---

## 环境要求

- **Python**: 3.10+
- **Node.js**: 18+
- **PostgreSQL**: 15+
- **系统**: Linux/macOS/Windows

---

## 后端部署

### 1. 安装 Python 依赖

```bash
cd backend
python -m venv venv

# Linux/macOS
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库和 API 密钥
```

**关键配置项:**

```env
# 数据库 (必须)
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/omni_notes

# 安全 (必须)
COOKIE_ENCRYPTION_KEY=your-secret-key-must-be-32-bytes-long!

# AI 配置 (必须)
AI_PROVIDER=bailian  # 或 openai
AI_API_KEY=your-api-key
AI_MODEL=qwen-max    # 或 gpt-4

# CORS (开发环境)
CORS_ORIGINS=http://localhost:3000
```

### 3. 初始化数据库

```bash
# 创建数据库
createdb omni_notes

# 运行迁移
alembic upgrade head
```

### 4. 启动服务

**开发模式:**
```bash
python run.py
# 或
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**生产模式:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

服务将在 `http://localhost:8000` 启动。

---

## 前端部署

### 1. 安装 Node 依赖

```bash
cd frontend
npm install
```

### 2. 配置环境变量

```bash
# 开发环境
cp .env.example .env.local
```

**配置项:**

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. 构建与启动

**开发模式:**
```bash
npm run dev
```

**生产模式:**
```bash
npm run build
npm start
```

前端将在 `http://localhost:3000` 启动。

---

## Docker 部署 (推荐)

### 使用 Docker Compose

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: omni_notes
      POSTGRES_PASSWORD: your_password
      POSTGRES_DB: omni_notes
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql+asyncpg://omni_notes:your_password@postgres:5432/omni_notes
      COOKIE_ENCRYPTION_KEY: ${COOKIE_ENCRYPTION_KEY}
      AI_API_KEY: ${AI_API_KEY}
    ports:
      - "8000:8000"
    depends_on:
      - postgres

  frontend:
    build: ./frontend
    environment:
      NEXT_PUBLIC_API_URL: http://backend:8000
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  postgres_data:
```

**启动:**

```bash
docker-compose up -d
```

---

## 生产环境配置

### Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### HTTPS 配置 (Let's Encrypt)

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-domain.com
```

### 环境变量检查清单

**后端:**
- [ ] DATABASE_URL - 数据库连接字符串
- [ ] COOKIE_ENCRYPTION_KEY - 32字节加密密钥
- [ ] AI_API_KEY - AI 服务 API 密钥
- [ ] AI_PROVIDER - bailian 或 openai
- [ ] CORS_ORIGINS - 允许的前端域名
- [ ] SESSION_EXPIRE_DAYS - Session 过期天数

**前端:**
- [ ] NEXT_PUBLIC_API_URL - 后端 API 地址

---

## 常见问题

### 1. 数据库连接失败

检查 PostgreSQL 服务是否运行:
```bash
# Linux/macOS
sudo systemctl status postgresql

# 测试连接
psql -h localhost -U user -d omni_notes
```

### 2. CORS 错误

确保后端 `.env` 中的 `CORS_ORIGINS` 包含前端地址:
```env
CORS_ORIGINS=http://localhost:3000,https://your-domain.com
```

### 3. AI 分析失败

检查 API 密钥配置:
```bash
# 测试通义千问
curl -X POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation \
  -H "Authorization: Bearer $AI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "qwen-max", "input": {"messages": [{"role": "user", "content": "Hello"}]}}'
```

### 4. 视频解析失败

检查 yt-dlp 安装:
```bash
yt-dlp --version
```

---

## 更新部署

### 后端更新

```bash
cd backend
git pull
pip install -r requirements.txt
alembic upgrade head
# 重启服务
```

### 前端更新

```bash
cd frontend
git pull
npm install
npm run build
# 重启服务
```

---

## 监控与日志

### 查看后端日志

```bash
# 如果使用 systemd
sudo journalctl -u omni-notes-backend -f

# Docker
docker-compose logs -f backend
```

### 查看前端日志

```bash
# PM2
pm2 logs omni-notes-frontend

# Docker
docker-compose logs -f frontend
```

---

## 备份

### 数据库备份

```bash
# 手动备份
pg_dump -h localhost -U user -d omni_notes > backup_$(date +%Y%m%d).sql

# 自动备份 (添加到 crontab)
0 2 * * * pg_dump -h localhost -U user -d omni_notes > /backups/omni_notes_$(date +\%Y\%m\%d).sql
```

---

## 安全建议

1. **使用 HTTPS** - 生产环境必须启用 SSL
2. **强密码** - 数据库密码和加密密钥使用随机生成
3. **环境变量** - 敏感信息不要硬编码，使用环境变量
4. **定期更新** - 保持依赖库更新
5. **访问控制** - 限制数据库和服务的网络访问

---

## 技术支持

- 项目文档: `/docs`
- API 文档: `http://localhost:8000/docs` (Swagger UI)
- 问题反馈: GitHub Issues
