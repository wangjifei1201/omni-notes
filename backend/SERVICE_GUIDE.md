# 后端服务启动和日志查看指南

## 📍 服务地址
- **本地服务地址**: `http://192.168.1.187:8000`
- **API 基础路径**: `http://192.168.1.187:8000/api/v1`
- **IP 地址**: 192.168.1.187（你的本地机器 IP）
- **端口**: 8000

## 🚀 启动后端服务

### 方式 1: 直接运行（推荐）

```bash
# 进入后端目录
cd /Users/wangjifei/Desktop/omni-notes/backend

# 运行服务
python run.py
```

**预期输出**:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### 方式 2: 使用 uvicorn 直接运行

```bash
cd /Users/wangjifei/Desktop/omni-notes/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 方式 3: 后台运行（使用 nohup）

```bash
cd /Users/wangjifei/Desktop/omni-notes/backend
nohup python run.py > backend.log 2>&1 &
```

## 📋 查看服务日志

### 方式 1: 查看日志文件（推荐）

```bash
# 查看最后 100 行
tail -100 /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 查看最后 50 行
tail -50 /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 实时查看日志（持续输出）
tail -f /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 查看全部日志
cat /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 查看日志文件大小
ls -lh /Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

### 方式 2: 使用 grep 搜索特定内容

```bash
# 查看所有错误
grep -i "error" /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 查看所有 API 请求
grep "INFO:" /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 查看特定任务的日志
grep "task_ac89430505c54fa5" /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 查看分析相关的日志
grep -E "\[分析\]|\[任务\]|\[AI\]" /Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

### 方式 3: 使用 less 分页查看

```bash
# 分页查看日志
less /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 在 less 中的快捷键：
# G - 跳到文件末尾
# g - 跳到文件开头
# / - 搜索
# q - 退出
```

## 📊 日志内容说明

### 常见日志类型

```
# API 请求日志
INFO:     192.168.1.7:53654 - "GET /api/v1/analysis/task_xxx HTTP/1.1" 200 OK

# 分析进度日志
[分析] 开始分析视频
[下载] 下载视频文件
[转录] 语音转文字进度
[AI] 调用 AI 模型
[任务] 任务状态更新
[缓存] 缓存命中/保存

# 错误日志
ERROR: 错误信息
```

### 日志级别

- `INFO` - 信息日志（正常操作）
- `WARNING` - 警告日志（可能的问题）
- `ERROR` - 错误日志（出现问题）
- `DEBUG` - 调试日志（详细信息）

## 🔍 实时监控服务

### 监控服务是否运行

```bash
# 检查服务进程
ps aux | grep -E "uvicorn|python.*main" | grep -v grep

# 检查端口是否被占用
lsof -i :8000

# 测试服务是否可访问
curl http://192.168.1.187:8000/api/v1/auth/me
```

### 实时查看日志

```bash
# 在终端 1 中启动服务
cd /Users/wangjifei/Desktop/omni-notes/backend
python run.py

# 在终端 2 中实时查看日志
tail -f /Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

## 🛠️ 常见问题

### Q: 如何停止服务？
```bash
# 方式 1: 在运行服务的终端按 Ctrl+C

# 方式 2: 使用 kill 命令
kill $(lsof -t -i :8000)

# 方式 3: 使用 pkill
pkill -f "uvicorn app.main"
```

### Q: 如何清空日志文件？
```bash
# 清空日志文件
> /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 或者
truncate -s 0 /Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

### Q: 如何查看特定时间的日志？
```bash
# 查看最后 1 小时的日志
tail -f /Users/wangjifei/Desktop/omni-notes/backend/backend.log | grep "$(date -u -d '1 hour ago' '+%Y-%m-%d')"
```

### Q: 服务无法启动怎么办？
```bash
# 1. 检查依赖是否安装
pip install -r requirements.txt

# 2. 检查数据库连接
python -c "from app.database import engine; print(engine)"

# 3. 查看详细错误信息
python run.py 2>&1 | tee debug.log
```

## 📈 性能监控

### 监控服务资源使用

```bash
# 实时监控进程
top -p $(lsof -t -i :8000)

# 查看内存使用
ps aux | grep "python run.py"

# 查看网络连接
netstat -an | grep 8000
```

## 🔧 配置说明

### 环境变量配置

文件: `/Users/wangjifei/Desktop/omni-notes/backend/.env`

```bash
# 查看配置
cat /Users/wangjifei/Desktop/omni-notes/backend/.env

# 修改配置后需要重启服务
```

### 日志配置

- 日志文件: `backend.log`
- 日志级别: `info`（在 run.py 中配置）
- 日志格式: Uvicorn 默认格式

## 📝 快速命令参考

```bash
# 启动服务
cd /Users/wangjifei/Desktop/omni-notes/backend && python run.py

# 查看最新日志
tail -100 /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 实时查看日志
tail -f /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 查看错误
grep -i "error" /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 检查服务状态
lsof -i :8000

# 停止服务
kill $(lsof -t -i :8000)

# 测试 API
curl http://192.168.1.187:8000/api/v1/auth/me
```

## 🎯 调试技巧

### 1. 启用详细日志
修改 `run.py` 中的 `log_level`:
```python
uvicorn.run(
    "app.main:app",
    host="0.0.0.0",
    port=8000,
    reload=settings.debug,
    log_level="debug"  # 改为 debug
)
```

### 2. 添加自定义日志
在代码中添加日志：
```python
import logging
logger = logging.getLogger(__name__)
logger.info("自定义日志信息")
```

### 3. 使用日志分析工具
```bash
# 统计 API 请求数
grep "INFO:" /Users/wangjifei/Desktop/omni-notes/backend/backend.log | wc -l

# 统计错误数
grep "ERROR" /Users/wangjifei/Desktop/omni-notes/backend/backend.log | wc -l

# 查看最常访问的端点
grep "INFO:" /Users/wangjifei/Desktop/omni-notes/backend/backend.log | awk '{print $NF}' | sort | uniq -c | sort -rn
```

## 📞 获取帮助

如果服务无法启动或出现错误：
1. 查看日志文件中的错误信息
2. 检查依赖是否正确安装
3. 确保数据库连接正常
4. 检查环境变量配置
5. 查看 `.env` 文件是否正确配置
