# 快速参考卡 - 后端服务和日志

## 🎯 最常用的命令

### 启动服务
```bash
cd /Users/wangjifei/Desktop/omni-notes/backend && python run.py
```

### 查看日志（最后100行）
```bash
tail -100 /Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

### 实时查看日志
```bash
tail -f /Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

### 停止服务
```bash
kill $(lsof -t -i :8000)
```

---

## 📊 日志文件位置
```
/Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

## 🌐 服务地址
```
http://192.168.1.187:8000
API: http://192.168.1.187:8000/api/v1
```

## 🔍 查看特定内容

### 查看所有错误
```bash
grep -i "error" /Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

### 查看 API 请求
```bash
grep "INFO:" /Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

### 查看分析日志
```bash
grep -E "\[分析\]|\[任务\]|\[AI\]" /Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

### 查看特定任务
```bash
grep "task_xxxxx" /Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

---

## ✅ 服务状态检查

### 检查服务是否运行
```bash
lsof -i :8000
```

### 测试 API 连接
```bash
curl http://192.168.1.187:8000/api/v1/auth/me
```

---

## 📈 日志统计

### 统计 API 请求数
```bash
grep "INFO:" /Users/wangjifei/Desktop/omni-notes/backend/backend.log | wc -l
```

### 统计错误数
```bash
grep "ERROR" /Users/wangjifei/Desktop/omni-notes/backend/backend.log | wc -l
```

---

## 🛠️ 常见问题快速解决

| 问题 | 解决方案 |
|------|--------|
| 服务无法启动 | 检查依赖: `pip install -r requirements.txt` |
| 端口被占用 | 停止服务: `kill $(lsof -t -i :8000)` |
| 无法连接服务 | 检查 IP: `192.168.1.187` 是否正确 |
| 日志文件过大 | 清空日志: `> backend.log` |
| 看不到日志 | 实时查看: `tail -f backend.log` |

---

## 📝 日志示例

### 成功的 API 请求
```
INFO:     192.168.1.7:53654 - "GET /api/v1/analysis/task_xxx HTTP/1.1" 200 OK
```

### 分析进度
```
[分析] 开始分析视频
[下载] 下载视频文件
[转录] 语音转文字进度
[AI] 调用 AI 模型
```

### 错误示例
```
ERROR: 连接数据库失败
ERROR: API 请求超时
```

---

## 🚀 完整工作流

```bash
# 1. 启动服务
cd /Users/wangjifei/Desktop/omni-notes/backend && python run.py

# 2. 在另一个终端查看日志
tail -f /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 3. 在小程序中提交分析任务

# 4. 观察日志中的进度更新

# 5. 完成后停止服务
kill $(lsof -t -i :8000)
```

---

## 📚 详细文档
查看 `SERVICE_GUIDE.md` 获取完整的服务管理指南
