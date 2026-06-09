# 本地IP变更后启动指南

## 当前状态
- **新的本地IP**: `192.168.1.30`
- **小程序配置已更新**: ✅
- **后端服务**: ❌ 启动失败（数据库连接问题）

## 启动步骤

### 1. 启动数据库（PostgreSQL）
```bash
# 如果使用 Homebrew 安装的 PostgreSQL
brew services start postgresql

# 或者直接启动
pg_ctl -D /usr/local/var/postgres start
```

### 2. 启动后端服务
```bash
cd /Users/wangjifei/Desktop/omni-notes/backend

# 方式1：直接运行（前台运行，可以看到日志）
python run.py

# 方式2：后台运行
python run.py > backend.log 2>&1 &

# 查看日志
tail -f backend.log
```

### 3. 验证服务是否启动成功
```bash
# 检查端口是否被占用
lsof -i :8000

# 测试API连接
curl http://192.168.1.30:8000/api/v1/analysis/models

# 或者使用 localhost
curl http://localhost:8000/api/v1/analysis/models
```

### 4. 重新编译小程序
```
打开微信开发者工具 → 编译 → 预览
```

## 已更新的配置

### 小程序配置 (`miniprogram/utils/config.js`)
```javascript
// API 地址配置
const API_URLS = {
  [ENV.DEV]: 'http://192.168.1.30:8000/api/v1',  // ← 已更新为新IP
  [ENV.PROD]: 'https://your-domain.com/api/v1',
};
```

## 测试连接

### 在小程序控制台测试
```javascript
// 打开微信开发者工具的 Console
const config = require('miniprogram/utils/config');
console.log('当前API地址:', config.apiUrl);

// 测试连接
const { authApi } = require('miniprogram/utils/api');
authApi.createGuest().then(user => {
  console.log('✓ 连接成功:', user);
}).catch(err => {
  console.error('✗ 连接失败:', err.message);
});
```

## 常见问题

### Q: 数据库连接失败怎么办？
```bash
# 检查 PostgreSQL 是否运行
brew services list

# 如果未运行，启动它
brew services start postgresql

# 检查数据库连接
psql -U wangjifei -d omni_notes -h localhost
```

### Q: 如何查看实时日志？
```bash
# 查看后端日志
tail -f /Users/wangjifei/Desktop/omni-notes/backend/backend.log

# 或者直接运行看到实时输出
cd /Users/wangjifei/Desktop/omni-notes/backend
python run.py
```

### Q: 如何检查小程序配置是否正确？
```javascript
// 在小程序 Console 中执行
wx.getStorageSync('user_id')
wx.getStorageSync('auth_token')
```

### Q: 如果IP又变了怎么办？
```bash
# 1. 获取当前IP
ifconfig | grep "inet " | grep -v 127.0.0.1

# 2. 更新配置文件
# 编辑 miniprogram/utils/config.js
# 将新的IP地址填入 API_URLS[ENV.DEV]

# 3. 重新编译小程序
```

## 一键启动脚本

创建启动脚本以便快速启动：
```bash
#!/bin/bash
# start-all.sh

echo "启动 PostgreSQL..."
brew services start postgresql

sleep 2

echo "启动后端服务..."
cd /Users/wangjifei/Desktop/omni-notes/backend
python run.py > backend.log 2>&1 &

sleep 3

echo "检查服务状态..."
lsof -i :8000

echo "完成！请重新编译小程序"
```

使用方法：
```bash
chmod +x start-all.sh
./start-all.sh
```

## 注意事项

1. **每次IP变化都需要更新配置**
2. **确保数据库先启动，再启动后端**
3. **小程序需要重新编译才能生效**
4. **建议使用固定的局域网IP或域名**