# 小程序前端功能完整开发指南

## 项目概述

已完整开发小程序前端功能，与 Web 前端共享同一套后端接口服务。所有交互功能已实现并优化。

## 完成的功能模块

### 1. 首页 (pages/index/index.js)
- ✅ 视频链接输入和粘贴功能
- ✅ 分析类型选择（综合分析、摘要、核心要点、思维导图）
- ✅ Whisper 语音识别开关和模型选择
- ✅ 分析任务提交（已修复 API 调用）
- ✅ 活跃任务列表展示
- ✅ 任务删除功能
- ✅ 登录状态检查和授权弹窗

### 2. 分析详情页 (pages/analysis/detail/index.js)
- ✅ 任务进度实时更新（轮询方式）
- ✅ 四步骤进度展示（分析 → 下载 → 语音转义 → 大模型分析）
- ✅ 下载进度和转录进度显示
- ✅ 分析结果展示（摘要、要点、思维导图、完整分析）
- ✅ 结果复制功能
- ✅ 错误处理和重试机制

### 3. 历史页面 (pages/history/index.js)
- ✅ 历史记录列表加载
- ✅ 搜索功能
- ✅ 分组筛选
- ✅ 排序功能（最新、收藏）
- ✅ 收藏/取消收藏
- ✅ 删除历史记录
- ✅ 点击进入详情页

### 4. 个人资料页 (pages/profile/index.js)
- ✅ 用户信息展示
- ✅ Whisper 配置管理
- ✅ 配置保存功能
- ✅ 修改密码导航
- ✅ 登出功能

### 5. 登录页 (pages/auth/login/index.js)
- ✅ 微信 openid 登录
- ✅ 游客登录
- ✅ 错误提示和重试机制
- ✅ 防止重复点击

## API 配置

### 配置文件位置
`miniprogram/utils/config.js`

### 当前配置
```javascript
// 开发环境
const API_URLS = {
  development: 'http://192.168.1.187:8000/api/v1',
  production: 'https://your-domain.com/api/v1',
};
```

### 修改 API 地址
1. 打开 `miniprogram/utils/config.js`
2. 修改 `API_URLS` 中的地址
3. 修改 `currentEnv` 为 `ENV.DEV` 或 `ENV.PROD`

## 测试流程

### 1. 登录测试
```
1. 打开小程序
2. 点击"微信登录"或"游客登录"
3. 验证登录成功，跳转到首页
4. 检查 Storage 中是否保存了 auth_token 和 user_id
```

### 2. 提交分析测试
```
1. 在首页输入 B 站或抖音视频链接
2. 选择分析类型和 Whisper 模型
3. 点击"开始分析"按钮
4. 验证：
   - 显示"分析任务已提交"提示
   - 自动跳转到分析详情页
   - 任务出现在活跃任务列表中
```

### 3. 进度跟踪测试
```
1. 在分析详情页观察进度更新
2. 验证步骤状态变化：
   - 分析 (extract)
   - 下载 (download)
   - 语音转义 (transcribe)
   - 大模型分析 (analyze)
3. 检查进度条和百分比更新
4. 等待任务完成
```

### 4. 结果展示测试
```
1. 任务完成后查看结果
2. 验证显示内容：
   - 摘要 (summary)
   - 核心要点 (keypoints)
   - 思维导图 (mindmap)
   - 完整分析 (full_analysis)
3. 测试复制功能
```

### 5. 历史记录测试
```
1. 切换到历史页面
2. 验证历史记录列表加载
3. 测试搜索功能
4. 测试分组筛选
5. 测试排序功能
6. 测试收藏/取消收藏
7. 测试删除记录
```

### 6. 个人资料测试
```
1. 切换到个人资料页面
2. 验证用户信息显示
3. 测试 Whisper 配置修改
4. 验证配置保存
5. 测试登出功能
```

## 常见问题排查

### 问题 1: 点击"开始分析"没有反应
**原因**: API 地址配置错误或网络连接问题

**解决方案**:
1. 检查 `miniprogram/utils/config.js` 中的 API 地址
2. 确保后端服务正在运行
3. 检查网络连接
4. 查看浏览器控制台的错误信息

### 问题 2: 登录失败
**原因**: 微信 openid 登录失败或后端认证问题

**解决方案**:
1. 确保小程序可正常调用 `wx.login()`
2. 检查后端 `/auth/wechat-login` 接口
3. 查看错误提示信息
4. 尝试游客登录

### 问题 3: 进度不更新
**原因**: 轮询请求失败或后端进度接口问题

**解决方案**:
1. 检查 `/analysis/{taskId}/progress` 接口
2. 查看网络请求是否成功
3. 检查后端任务队列服务
4. 查看浏览器控制台错误

### 问题 4: 历史记录加载失败
**原因**: 后端历史记录接口问题

**解决方案**:
1. 检查 `/history` 接口
2. 验证用户认证状态
3. 检查数据库连接
4. 查看后端日志

## 调试技巧

### 1. 启用控制台日志
在各个页面的关键位置已添加 `console.log()` 语句，可以在微信开发者工具的控制台查看。

### 2. 检查 Storage
```javascript
// 在控制台执行
wx.getStorageSync('auth_token')  // 查看认证令牌
wx.getStorageSync('user_id')     // 查看用户ID
wx.getStorageSync('app_state')   // 查看应用状态
```

### 3. 网络请求监控
在微信开发者工具的"Network"标签页可以查看所有 HTTP 请求和响应。

### 4. 状态管理调试
```javascript
// 在控制台执行
const store = require('../../utils/store');
store.getState()  // 查看当前应用状态
```

## 后端接口对接

### 已对接的接口

| 功能 | 方法 | 端点 | 状态 |
|------|------|------|------|
| 微信 openid 登录 | POST | `/auth/wechat-login` | ✅ |
| 游客登录 | POST | `/auth/guest` | ✅ |
| 登出 | POST | `/auth/logout` | ✅ |
| 创建分析 | POST | `/analysis` | ✅ |
| 获取进度 | GET | `/analysis/{taskId}/progress` | ✅ |
| 获取结果 | GET | `/analysis/{taskId}` | ✅ |
| 获取历史 | GET | `/history` | ✅ |
| 获取分组 | GET | `/groups` | ✅ |
| 获取配置 | GET | `/config` | ✅ |
| 更新配置 | PATCH | `/config` | ✅ |

### 响应数据格式

#### 分析任务创建响应
```json
{
  "task_id": "uuid",
  "platform": "bilibili",
  "video_id": "BV1xxx",
  "title": "视频标题",
  "author": "作者名",
  "cover": "封面URL",
  "duration": 3600,
  "status": "queued",
  "queue_position": 1,
  "estimated_wait_seconds": 300,
  "created_at": "2026-04-14T13:55:53+08:00"
}
```

#### 进度更新响应
```json
{
  "status": "processing",
  "current_step": "download",
  "steps": {
    "extract": {
      "status": "completed",
      "start_time": 1234567890,
      "end_time": 1234567900
    },
    "download": {
      "status": "running",
      "start_time": 1234567900,
      "end_time": null
    }
  },
  "download_progress": {
    "percent": 45,
    "size": "150MB",
    "speed": "5MB/s"
  },
  "transcribe_live": {
    "percent": 0,
    "time": "00:00"
  }
}
```

#### 分析结果响应
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "status": "completed",
  "title": "视频标题",
  "summary": "摘要内容",
  "keypoints": ["要点1", "要点2"],
  "mindmap": "思维导图内容",
  "full_analysis": "完整分析内容",
  "created_at": "2026-04-14T13:55:53+08:00"
}
```

## 性能优化建议

1. **缓存策略**: 已实现本地 Storage 缓存
2. **请求优化**: 使用 30 秒超时，避免长时间等待
3. **进度轮询**: 每 2 秒轮询一次，平衡实时性和性能
4. **内存管理**: 页面卸载时清理定时器和事件监听

## 部署检查清单

- [ ] 修改 `miniprogram/utils/config.js` 中的 API 地址
- [ ] 确保后端服务正在运行
- [ ] 验证微信小程序配置
- [ ] 测试所有主要功能流程
- [ ] 检查错误处理和用户提示
- [ ] 验证网络连接和超时处理
- [ ] 测试不同网络环境（WiFi、4G、弱网）

## 后续改进方向

1. **WebSocket 支持**: 替代轮询，实现真正的实时更新
2. **离线支持**: 实现离线缓存和同步
3. **性能监控**: 添加性能指标收集
4. **错误上报**: 实现自动错误上报机制
5. **用户分析**: 添加用户行为追踪
