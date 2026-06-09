# 小程序手机调试快速指南

## 🚨 手机浏览报错快速排查

### 1. API 地址配置 (最常见问题)

**问题**: 手机无法访问 `localhost:8000`

**解决方法**:
1. 打开 `miniprogram/utils/config.js`
2. 修改生产环境地址:
   ```javascript
   [ENV.PROD]: 'https://your-domain.com/api/v1',  // 改为你的实际服务器地址
   ```
3. 将 `currentEnv` 改为 `ENV.PROD`

**测试环境地址示例**:
- 本机测试: `http://192.168.1.100:8000/api/v1` (电脑的局域网 IP)
- 线上测试: `https://api.yourdomain.com/api/v1`

### 2. 查看错误日志

**在手机上调试**:
1. 打开微信开发者工具
2. 点击"预览"生成二维码
3. 手机扫码打开小程序
4. 点击右上角 `...` → "打开调试"
5. 点击右下角 `vConsole` 图标查看日志

**查看网络请求**:
1. vConsole → Network
2. 查看请求状态码和响应

### 3. 常见错误及解决

#### 错误 1: `request:fail`
- **原因**: 网络地址无法访问
- **解决**: 
  - 检查 API 地址是否正确
  - 确保服务器已启动
  - 检查防火墙设置

#### 错误 2: `ERR_CONNECT_REFUSED`
- **原因**: 服务器未启动或地址错误
- **解决**: 启动后端服务，检查端口是否正确

#### 错误 3: 401 未授权
- **原因**: Token 过期或未登录
- **解决**: 清除本地存储，重新登录

#### 错误 4: 小程序域名未配置
- **原因**: 生产环境域名未在小程序后台配置
- **解决**: 
  - 登录微信公众平台
  - 开发 → 开发管理 → 开发设置 → 服务器域名
  - 添加 `request 合法域名`

### 4. 快速测试步骤

1. **测试后端连接**:
   ```bash
   # 确保后端运行
   cd backend
   python run.py
   
   # 测试 API
   curl http://localhost:8000/api/v1/health
   ```

2. **获取本机 IP** (局域网测试):
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```

3. **配置小程序**:
   - 打开 `miniprogram/utils/config.js`
   - 将 `DEV` 环境的地址改为 `http://你的IP:8000/api/v1`

4. **真机调试**:
   - 开发者工具 → 真机调试
   - 扫码在手机上打开
   - 查看 vConsole 日志

### 5. 开发环境 vs 生产环境

**开发环境** (currentEnv = ENV.DEV):
- 不校验域名
- 可以用 HTTP
- 可以用 localhost

**生产环境** (currentEnv = ENV.PROD):
- 必须配置合法域名
- 必须用 HTTPS
- 不能用 localhost

### 6. 微信小程序域名配置

**开发阶段**:
- 开发者工具 → 详情 → 本地设置 → 勾选"不校验合法域名"
- 可以使用 HTTP 和 localhost

**上线阶段**:
- 必须配置 HTTPS 域名
- 在小程序后台添加服务器域名
- 支持 request、uploadFile、downloadFile 域名

### 7. 调试技巧

**清除本地数据**:
```javascript
// 在控制台执行
wx.clearStorageSync()
```

**查看当前配置**:
```javascript
// 在控制台执行
const config = require('./utils/config')
console.log('API地址:', config.apiUrl)
console.log('环境:', config.env)
```

**测试 API 连接**:
```javascript
// 在页面中添加测试按钮
wx.request({
  url: config.apiUrl + '/health',
  success: (res) => console.log('API 正常:', res),
  fail: (err) => console.error('API 失败:', err)
})
```

## 📱 手机预览流程

1. 开发者工具点击"预览"
2. 手机微信扫码
3. 打开调试模式 (右上角...→打开调试)
4. 查看 vConsole 日志
5. 根据错误信息排查

## 🔧 快速修复清单

- [ ] 后端服务已启动
- [ ] API 地址配置正确 (不是 localhost)
- [ ] 手机和电脑在同一局域网 (测试环境)
- [ ] 开启"不校验合法域名" (开发阶段)
- [ ] 查看控制台错误日志
- [ ] 检查网络请求状态码
- [ ] 清除小程序缓存重试

## 💡 提示

- 开发阶段使用局域网 IP，不要用 localhost
- 生产环境必须用 HTTPS 和已备案域名
- 善用 vConsole 查看详细错误信息
- 可以先用 Postman 测试 API 是否正常