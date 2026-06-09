# 微信小程序 API 配置指南

## 问题说明

在真机预览时，小程序无法访问 `localhost:8000`，因为：
- `localhost` 只在本地机器上有效
- 真机需要访问实际的服务器地址（IP 或域名）

## 解决方案

### 开发环境配置

**方案 1：使用本地 IP 地址**

1. 获取开发机的本地 IP：
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```

2. 修改 `miniprogram/utils/api.js` 中的 API 地址：
   ```javascript
   const API_BASE_URL = 'http://192.168.1.100:8000/api/v1'; // 替换为你的 IP
   ```

3. 确保后端服务监听所有网卡（0.0.0.0）：
   ```bash
   # 后端启动时
   python run.py --host 0.0.0.0 --port 8000
   ```

**方案 2：使用内网穿透工具**

使用 ngrok 或 frp 将本地服务暴露到公网：

```bash
# 使用 ngrok
ngrok http 8000

# 然后在 api.js 中使用生成的 URL
const API_BASE_URL = 'https://xxxx-xx-xxx-xxx.ngrok.io/api/v1';
```

### 生产环境配置

部署到服务器后，修改 API 地址为实际的服务器地址：

```javascript
const API_BASE_URL = 'https://api.yourdomain.com/api/v1';
```

## 当前配置

**开发环境：** `http://localhost:8000/api/v1`
- 仅在模拟器中有效
- 真机预览需要修改为本地 IP 或公网地址

**超时设置：** 30 秒
- 如果网络较慢，可以增加到 60 秒

## 错误处理

API 层已添加以下错误处理：
- 超时错误：提示检查网络连接或服务器地址
- 连接拒绝：提示检查 API 地址配置
- 401 未授权：自动清除 token 并跳转到登录页

## 测试步骤

1. **模拟器测试**
   - 后端运行在 `localhost:8000`
   - 小程序在微信开发者工具中测试
   - 使用"开发模式：模拟登录"（已移除）

2. **真机预览**
   - 修改 API 地址为本地 IP
   - 后端监听 `0.0.0.0:8000`
   - 手机和开发机在同一网络
   - 在微信开发者工具中点击"预览"，用手机扫码

3. **生产环境**
   - 修改 API 地址为实际服务器地址
   - 确保 HTTPS 连接
   - 配置 CORS 允许小程序域名

## 常见问题

**Q: 真机预览时显示"网络请求失败"**
A: 检查以下几点：
1. 后端服务是否运行
2. API 地址是否正确
3. 手机和开发机是否在同一网络
4. 防火墙是否阻止了连接

**Q: 显示"请求超时"**
A: 
1. 检查网络连接
2. 增加超时时间（在 api.js 中修改 timeout）
3. 检查后端服务是否响应缓慢

**Q: 显示"无法连接到服务器"**
A:
1. 确认 API 地址配置正确
2. 确认后端服务已启动
3. 检查防火墙设置

## 快速切换配置

为了方便开发和生产环境的切换，可以使用环境变量：

```javascript
// miniprogram/utils/api.js
const ENV = 'development'; // 'development' 或 'production'

const API_CONFIG = {
  development: 'http://192.168.1.100:8000/api/v1',
  production: 'https://api.yourdomain.com/api/v1',
};

const API_BASE_URL = API_CONFIG[ENV];
```

---

**重要提示：** 在提交代码前，确保 API 地址配置正确，避免将本地地址提交到生产环境。
