# 微信小程序域名配置问题解决方案

## 问题说明

**错误信息：** `request:fail url not in domain list`

**原因：** 微信小程序出于安全考虑，只允许请求在微信公众平台后台配置的合法域名。

## 解决方案

### 方案 1：配置合法域名（推荐用于生产环境）

1. **登录微信公众平台**
   - 访问：https://mp.weixin.qq.com
   - 使用小程序账号登录

2. **配置合法域名**
   - 进入：开发 → 开发设置
   - 找到"服务器域名"部分
   - 点击"修改"按钮
   - 添加你的后端服务器域名

3. **添加以下域名**
   ```
   request 合法域名：
   - https://api.yourdomain.com
   - https://your-server-ip.com
   
   socket 合法域名（如需要）：
   - wss://api.yourdomain.com
   ```

4. **注意事项**
   - 必须使用 HTTPS 协议
   - 域名必须已备案
   - 修改后需要等待 5-10 分钟生效

### 方案 2：开发环境调试（仅用于开发）

在微信开发者工具中跳过域名检查：

1. **打开微信开发者工具**
2. **点击右上角"详情"**
3. **选择"本地设置"标签**
4. **勾选以下选项：**
   - ✓ 不校验合法域名、web-view（仅开发调试使用）
   - ✓ 不校验请求域名

**警告：** 这个选项仅用于开发调试，真机预览和上线前必须移除此选项。

### 方案 3：使用 HTTPS 和有效域名

如果你有自己的服务器和域名：

1. **配置 HTTPS**
   ```bash
   # 使用 Let's Encrypt 获取免费 SSL 证书
   certbot certonly --standalone -d yourdomain.com
   ```

2. **配置后端 HTTPS**
   ```python
   # FastAPI 后端配置 HTTPS
   import ssl
   
   ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
   ssl_context.load_cert_chain(
       certfile="/path/to/cert.pem",
       keyfile="/path/to/key.pem"
   )
   
   uvicorn.run(
       app,
       host="0.0.0.0",
       port=443,
       ssl_context=ssl_context
   )
   ```

3. **在微信后台配置域名**
   ```
   https://yourdomain.com
   ```

4. **更新小程序 API 地址**
   ```javascript
   // miniprogram/utils/api.js
   const API_BASE_URL = 'https://yourdomain.com/api/v1';
   ```

## 当前开发环境配置

**模拟器测试：** ✓ 可以使用 localhost
- 在微信开发者工具中测试
- 后端地址：`http://localhost:8000/api/v1`

**真机预览：** ✗ 不能使用 localhost
- 需要配置合法域名或使用开发者工具的"不校验域名"选项

## 快速修复步骤

### 短期解决方案（开发调试）

1. 打开微信开发者工具
2. 点击右上角"详情"
3. 选择"本地设置"
4. 勾选"不校验合法域名、web-view（仅开发调试使用）"
5. 重新编译小程序
6. 在真机上预览

### 长期解决方案（生产部署）

1. 获取有效的域名和 SSL 证书
2. 配置后端 HTTPS
3. 在微信公众平台后台添加域名
4. 更新小程序 API 地址为 HTTPS
5. 重新编译并上线

## 测试流程

### 开发环境
```
模拟器 → localhost:8000 ✓
真机预览 → 需要配置域名或跳过检查
```

### 生产环境
```
真机 → https://yourdomain.com ✓
```

## 常见问题

**Q: 为什么模拟器可以但真机不行？**
A: 模拟器运行在开发机上，可以访问 localhost。真机需要通过网络访问，微信会检查域名是否在白名单中。

**Q: 开发时如何快速测试？**
A: 在微信开发者工具中勾选"不校验合法域名"选项，这样可以在开发阶段快速测试。

**Q: 上线前需要做什么？**
A: 
1. 移除"不校验合法域名"选项
2. 配置真实的 HTTPS 域名
3. 在微信后台添加域名
4. 测试真机预览
5. 提交审核

**Q: 如何获取免费 SSL 证书？**
A: 使用 Let's Encrypt：
```bash
# 安装 certbot
brew install certbot

# 获取证书
sudo certbot certonly --standalone -d yourdomain.com
```

## 参考资源

- [微信小程序官方文档 - 服务器域名配置](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
- [Let's Encrypt 免费 SSL 证书](https://letsencrypt.org/)
- [FastAPI HTTPS 配置](https://fastapi.tiangolo.com/deployment/concepts/#https)

---

**重要提示：** 
- 开发时可以跳过域名检查，但上线前必须配置真实域名
- 生产环境必须使用 HTTPS
- 域名必须已备案（中国大陆）
