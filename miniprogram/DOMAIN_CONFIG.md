# 微信小程序域名配置指南

## 错误说明
`request:fail url not in domain list` - 请求的域名不在小程序后台配置的合法域名列表中。

## 开发阶段解决方案

### 方法1：关闭域名校验（推荐，最快）

**开发者工具设置**：
1. 微信开发者工具 → 右上角"详情"
2. 本地设置 → 勾选"不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书"
3. 重新预览

**注意**：
- 仅限开发阶段使用
- 预览版和体验版都有效
- 正式版必须配置合法域名

### 方法2：使用真机调试

1. 开发者工具 → 点击"真机调试"
2. 手机扫码连接
3. 真机调试模式自动跳过域名校验
4. 可以实时查看 vConsole 日志

### 方法3：配置开发版域名（临时）

1. 登录微信公众平台：https://mp.weixin.qq.com
2. 开发 → 开发管理 → 开发设置
3. 找到"服务器域名"
4. 配置以下域名：

**request 合法域名**：
- `https://your-domain.com`

**uploadFile 合法域名**：
- `https://your-domain.com`

**downloadFile 合法域名**：
- `https://your-domain.com`

## 生产环境配置

### 域名要求

1. **必须支持 HTTPS**
   - 需要有效的 SSL 证书
   - TLS 版本 >= 1.2
   
2. **域名已备案**
   - 国内服务器需要 ICP 备案
   - 境外服务器不需要

3. **不能是 IP 地址**
   - ❌ `http://192.168.1.100:8000`
   - ✅ `https://api.yourdomain.com`

4. **不能是 localhost**
   - ❌ `http://localhost:8000`
   - ❌ `http://127.0.0.1:8000`

### 配置步骤

1. 准备工作：
   ```bash
   # 确认域名已解析到服务器
   ping your-domain.com
   
   # 确认 HTTPS 证书正常
   curl -I https://your-domain.com
   ```

2. 登录微信公众平台：
   - 网址：https://mp.weixin.qq.com
   - 使用管理员账号登录

3. 进入域名配置：
   - 开发 → 开发管理 → 开发设置
   - 向下滚动到"服务器域名"

4. 添加域名：
   - 点击"修改"
   - 扫码验证管理员身份
   - 添加以下域名：
     
   **request 合法域名**：
   ```
   https://your-domain.com
   ```
   
   **uploadFile 合法域名**：
   ```
   https://your-domain.com
   ```
   
   **downloadFile 合面域名**：
   ```
   https://your-domain.com
   ```

5. 更新小程序配置：
   ```javascript
   // miniprogram/utils/config.js
   const API_URLS = {
     [ENV.DEV]: 'http://localhost:8000/api/v1',
     [ENV.PROD]: 'https://your-domain.com/api/v1',  // 改为配置的域名
   };
   ```

6. 重新编译预览

### 域名配置限制

- 每月只能修改 5 次
- 每次最多添加 20 个域名
- 所有域名必须支持 HTTPS
- 端口号必须为 443（HTTPS 默认端口）

## 开发环境快速测试

### 使用局域网 IP（仅开发阶段）

1. 获取电脑局域网 IP：
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Windows
   ipconfig
   ```
   
   假设得到 IP: `192.168.1.100`

2. 修改配置：
   ```javascript
   // miniprogram/utils/config.js
   const API_URLS = {
     [ENV.DEV]: 'http://192.168.1.100:8000/api/v1',  // 局域网 IP
     [ENV.PROD]: 'https://your-domain.com/api/v1',
   };
   ```

3. 开发者工具勾选"不校验合法域名"

4. 手机和电脑连接同一 WiFi

5. 真机调试或预览测试

## 常见问题

### Q1: 开发者工具可以，手机预览报错？
**A**: 开发者工具默认不校验域名，手机预览会严格校验。解决：
- 方法1：勾选"不校验合法域名"
- 方法2：使用真机调试模式
- 方法3：配置合法域名

### Q2: 配置域名后还是报错？
**A**: 检查以下几点：
- 域名是否填写完整（包含 https://）
- 证书是否有效
- 服务器是否正常运行
- 域名是否已生效（配置后需要几分钟）

### Q3: 可以使用 HTTP 吗？
**A**: 不可以。生产环境必须使用 HTTPS。
- 开发阶段：勾选"不校验"后可以使用 HTTP
- 生产环境：必须配置 HTTPS 域名

### Q4: 如何申请免费 HTTPS 证书？
**A**: 推荐使用 Let's Encrypt：
```bash
# 使用 certbot 申请免费证书
sudo certbot certonly --standalone -d your-domain.com
```

### Q5: 体验版和正式版的区别？
**A**: 
- **开发版**：开发工具生成，可跳过域名校验
- **体验版**：需要配置域名，但有 7 天缓冲期
- **正式版**：必须配置合法域名

## 检查清单

开发阶段：
- [ ] 开发者工具已勾选"不校验合法域名"
- [ ] API 地址不是 localhost（使用局域网 IP）
- [ ] 手机和电脑在同一局域网
- [ ] 后端服务正常运行

生产阶段：
- [ ] 域名已备案（国内服务器）
- [ ] HTTPS 证书已配置
- [ ] 小程序后台已添加域名
- [ ] config.js 已更新生产域名
- [ ] 域名配置已生效（等待几分钟）

## 快速诊断命令

```bash
# 检查域名解析
nslookup your-domain.com

# 检查 HTTPS 证书
openssl s_client -connect your-domain.com:443

# 测试 API 连通性
curl -I https://your-domain.com/api/v1/health
```

## 相关文档

- [微信小程序域名配置官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
- [小程序开发指南 - 域名校验](https://developers.weixin.qq.com/miniprogram/dev/devtools/cleckhost.html)