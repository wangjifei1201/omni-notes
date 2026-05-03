# 系统启动验证清单

## ✅ 已完成

### 1. IP地址更新
- **旧IP**: 192.168.1.187
- **新IP**: 192.168.1.30
- **小程序配置**: 已更新 ✅

### 2. 数据库启动
- **PostgreSQL**: 已手动启动 ✅
- **端口**: 5432 正常监听 ✅

### 3. 后端服务启动
- **状态**: 已启动 (PID: 15492) ✅
- **地址**: http://192.168.1.30:8000 ✅
- **API测试**: 返回"请先登录"（正常） ✅

## 📋 下一步操作

### 1. 在微信开发者工具中编译小程序
```
打开微信开发者工具 → 编译 → 预览
```

### 2. 测试登录功能
```
点击"游客登录" 或 "微信授权登录"
验证登录成功
```

### 3. 测试分析功能
```
输入视频链接 → 开始分析 → 观察进度 → 查看结果
```

## 🔍 验证命令

### 检查服务状态
```bash
# 检查后端服务
lsof -i :8000

# 检查数据库
lsof -i :5432

# 测试API
curl http://192.168.1.30:8000/api/v1/analysis/models
```

### 查看日志
```bash
# 实时查看后端日志
tail -f /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 查看最近的请求
tail -50 /Users/wangjifei/Desktop/omni-notes/backend/backend.log | grep "INFO:"
```

### 在小程序中测试
```javascript
// 打开微信开发者工具的 Console
const config = require('miniprogram/utils/config');
console.log('API地址:', config.apiUrl);

// 测试连接
const { authApi } = require('miniprogram/utils/api');
authApi.createGuest().then(user => {
  console.log('✓ 连接成功:', user);
}).catch(err => {
  console.error('✗ 连接失败:', err.message);
});
```

## 📊 当前配置

### 小程序 (`miniprogram/utils/config.js`)
```javascript
const API_URLS = {
  development: 'http://192.168.1.30:8000/api/v1',  // ← 新IP
  production: 'https://your-domain.com/api/v1',
};
```

### 后端 (`backend/.env`)
```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/omni_notes
```

## ⚠️ 注意事项

1. **每次重启电脑后需要重新启动服务**
2. **如果IP再次变化，需要更新配置文件**
3. **建议使用固定的局域网IP或域名**

## 🎯 快速启动脚本

### 启动后端
```bash
cd /Users/wangjifei/Desktop/omni-notes/backend
nohup python run.py > backend.log 2>&1 &
```

### 查看状态
```bash
lsof -i :8000
tail -f backend/backend.log
```

### 停止后端
```bash
kill $(lsof -t -i :8000)
```

---

**系统已完全启动，可以开始测试小程序功能！**