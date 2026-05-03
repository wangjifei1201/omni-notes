# 私密代理支持 - 实现总结

## 📋 任务完成情况

已成功为视频下载逻辑添加了**私密代理支持**，支持从代理 API 获取动态代理 IP，并使用用户名/密码进行认证。

## ✨ 新增功能

### 1. 代理类型支持

- **直接代理模式**：使用静态代理地址（如本地代理服务）
- **私密代理模式**：从API获取动态代理IP，使用用户名/密码认证（推荐用于按流量计费的代理服务）

### 2. 核心函数

#### `getProxyFromAPI(apiUrl)`
- 从代理 API 获取代理 IP 地址
- 支持自定义 API 端点
- 错误处理：获取失败时会记录错误日志，但不中断下载流程

#### `buildPrivateProxyUrl(proxyIp, username, password)`
- 构建带认证的代理 URL
- 格式：`http://username:password@proxyIp/`
- 返回完整的认证代理 URL

#### `downloadAudio()`
- 已升级以支持 `proxyConfig` 参数
- 优先级：私密代理 API (需要 apiUrl+username+password) > 直接代理 URL > 无代理
- 在 Promise 前处理代理获取，避免异步问题

## 🔧 配置方式

### 配置文件位置
`config.json` 或 `config.example.json`

### 直接代理模式配置
```json
{
  "proxy": {
    "enabled": true,
    "type": "direct",
    "url": "http://127.0.0.1:7890"
  }
}
```

### 私密代理模式配置（推荐）
```json
{
  "proxy": {
    "enabled": true,
    "type": "private",
    "apiUrl": "https://dps.kdlapi.com/api/getdps/?secret_id=xxx&signature=xxx&num=1&sep=1",
    "username": "your_username",
    "password": "your_password"
  }
}
```

## 🚀 使用流程

1. **启用代理**
   ```json
   "proxy": {
     "enabled": true
   }
```

2. **配置私密代理**
   - `apiUrl`：从代理服务商获取 API 地址
   - `username` 和 `password`：从代理服务商获取认证凭证

3. **下载视频**
   - 系统自动从 API 获取代理 IP
   - 拼接用户名/密码生成认证 URL
   - 使用认证 URL 进行视频下载

## 📝 修改文件清单

### 1. `server.js`
- ✅ 添加 `getProxyFromAPI()` 函数 - 从代理 API 获取 IP
- ✅ 添加 `buildPrivateProxyUrl()` 函数 - 构建认证 URL
- ✅ 更新 `DEFAULT_CONFIG` - 包含代理配置字段
- ✅ 修改 `downloadAudio()` 函数 - 支持 `proxyConfig` 参数
- ✅ 更新下载流程 - 在调用 `downloadAudio()` 时传递代理配置

### 2. `config.example.json`
- ✅ 添加完整的代理配置示例
- ✅ 支持 `type`、`apiUrl`、`username`、`password` 字段

### 3. `README.md`
- ✅ 添加代理配置项说明表
- ✅ 添加直接代理模式使用示例
- ✅ 添加私密代理模式使用示例（包含工作原理说明）
- ✅ 新增 FAQ：如何配置私密代理

## 🧪 测试验证

运行 `test-proxy.js` 验证：
```bash
node test-proxy.js
```

测试项：
- ✅ 代理 URL 构建
- ✅ 配置文件格式
- ✅ 直接代理模式
- ✅ 错误处理

## 🔐 安全特性

- 日志中隐藏密码信息（显示 `http://***:***@<IP>/`）
- 代理获取失败时自动降级（继续不使用代理）
- 支持环境变量 `BILI_COOKIE` 与代理结合使用

## 🌐 支持的代理服务

测试通过的配置模板：
- **快代理**（KDLA）：`https://dps.kdlapi.com/api/getdps/?...`
- **讯代理**：类似 REST API 格式
- 其他支持 HTTP/HTTPS 代理的服务

## 📚 参考资料

### 快代理使用示例
```python
# Python 参考代码
api_url = "https://dps.kdlapi.com/api/getdps/?secret_id=xxx&signature=xxx&num=1&sep=1"
proxy_ip = requests.get(api_url).text
username = "username"
password = "password"
proxies = {
    "http": f"http://{username}:{password}@{proxy_ip}/",
    "https": f"http://{username}:{password}@{proxy_ip}/"
}
```

### Node.js 集成
系统已自动集成相同逻辑：
```javascript
// 自动执行流程：
// 1. getProxyFromAPI(apiUrl) -> 获取 IP
// 2. buildPrivateProxyUrl(ip, user, pass) -> 构建 URL
// 3. downloadAudio(..., proxyConfig) -> 使用认证 URL 下载
```

## ✅ 后续优化建议

1. **添加代理池管理**：轮换多个代理源
2. **添加代理测试**：下载前验证代理可用性
3. **添加代理黑名单**：排除失效的代理 IP
4. **添加重试机制**：代理失败时自动重新泛request
5. **支持 SOCKS5 代理**：扩展代理类型支持

---

**版本**：1.0  
**日期**：2026-03-17  
**状态**：✅ 完成
