# 微信 openid 登录设计方案

## 背景

个人主体微信小程序无法使用「获取手机号」能力（需企业认证）。原设计依赖手机号授权登录，需要改为基于 openid 的微信授权登录。

## 核心流程

```
用户点击微信登录
    ↓
调用 wx.login() 获取 code
    ↓
前端发送 code 到后端 /api/v1/auth/wechat-login
    ↓
后端调用微信 API，用 code 换 openid
    ↓
查库：用 openid 查找用户
    ↓
找到 → 更新登录时间，返回 session
未找到 → 创建新用户，返回 session
    ↓
前端保存 session，跳转首页
```

## 技术细节

### 1. 前端改动

#### login/index.wxml
- 移除 `open-type="getPhoneNumber"` 和 `bindgetphonenumber`
- 改为普通按钮 `bindtap="onWechatLogin"`

#### login/index.js
- 新增 `onWechatLogin` 方法：
  1. 调用 `wx.login()` 获取 code
  2. 调用 `authApi.wechatLogin(code)`
  3. 成功后保存 session_id，跳转首页
  4. 失败则自动重试一次，仍失败显示错误

#### utils/api.js
- 新增 `authApi.wechatLogin(code)` 接口

### 2. 后端改动

#### 新增接口：POST /api/v1/auth/wechat-login

请求：
```json
{
  "code": "微信登录code"
}
```

响应：
```json
{
  "id": "user_id",
  "openid": "openid",
  "username": "微信用户_xxxx",
  "is_guest": false,
  "session_id": "xxx"
}
```

错误情况：
- code 无效 → 400 "授权码已失效，请重新登录"
- 微信 API 失败 → 500 "微信服务异常，请稍后重试"

### 3. 登录成功处理

- 保存 `session_id` 到 `wx.setStorageSync('auth_token', session_id)`
- 保存 `user_id` 到 `wx.setStorageSync('user_id', user.id)`
- 更新全局 store 的用户状态
- 跳转首页：`wx.switchTab({ url: '/pages/index/index' })`

### 4. 错误处理

| 错误类型 | 处理方式 |
|----------|----------|
| code 无效/过期 | 提示"授权码已失效，请重试" |
| 网络错误 | 自动重试一次，仍失败提示"网络异常，请重试" |
| 微信 API 失败 | 提示"微信服务异常，请稍后重试" |

## 文件改动清单

| 文件 | 改动类型 |
|------|----------|
| miniprogram/pages/auth/login/index.wxml | 修改 |
| miniprogram/pages/auth/login/index.js | 修改 |
| miniprogram/pages/index/index.js | 已修复（添加 onWechatLogin 跳转） |
| miniprogram/utils/api.js | 新增 wechatLogin 接口 |
| backend/app/routers/auth.py | 新增 /wechat-login 端点 |

## 依赖

- 后端 User 模型已有 `openid` 字段，无需改数据库
- Session 机制已有，复用现有实现

## 测试要点

1. 新用户首次登录 → 创建账户成功，跳转首页
2. 老用户再次登录 → 直接登录成功，数据保留
3. code 过期 → 提示用户重试
4. 网络异常 → 自动重试后提示