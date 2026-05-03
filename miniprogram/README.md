# Omni-Notes 微信小程序

AI驱动的视频分析小程序版本，支持B站和抖音视频的智能分析。

## 功能特性

- **视频分析**: 支持B站(b23.tv)和抖音分享链接
- **AI分析**: 智能摘要、核心要点、思维导图、完整分析
- **语音识别**: 集成Whisper语音转文字功能
- **历史管理**: 分析历史记录，支持收藏和分组
- **用户系统**: 支持注册登录和游客模式
- **实时进度**: 实时显示分析进度和状态

## 项目结构

```
miniprogram/
├── pages/
│   ├── index/                    # 首页 - 视频输入和任务列表
│   ├── analysis/
│   │   └── detail/              # 分析详情页 - 实时进度和结果展示
│   ├── history/                 # 历史记录页
│   ├── profile/                 # 个人中心页
│   └── auth/
│       ├── login/               # 登录页
│       └── register/            # 注册页
├── utils/
│   ├── api.js                   # API服务层 - HTTP请求封装
│   └── store.js                 # 全局状态管理
├── app.js                       # 小程序入口
├── app.json                     # 小程序配置
└── app.wxss                     # 全局样式
```

## 快速开始

### 1. 环境要求

- 微信开发者工具 (最新版本)
- Node.js 14+ (可选，用于构建)

### 2. 配置API地址

编辑 `utils/api.js`，修改 `API_BASE_URL`:

```javascript
const API_BASE_URL = 'http://your-backend-url/api/v1';
```

### 3. 在微信开发者工具中打开

1. 打开微信开发者工具
2. 选择"导入项目"
3. 选择项目根目录
4. 填写AppID (可使用测试号)
5. 点击"导入"

### 4. 编译和预览

- 点击"编译"按钮编译小程序
- 点击"预览"在手机上预览

## 页面说明

### 首页 (pages/index/index)

- 输入视频链接
- 选择分析类型 (综合分析、摘要、核心要点、思维导图)
- 配置语音识别选项
- 查看活跃任务列表

**关键功能:**
- 粘贴剪贴板URL
- 实时任务进度显示
- 快速删除任务

### 分析详情页 (pages/analysis/detail/index)

- 实时显示分析进度
- 分步骤展示处理状态
- 展示分析结果 (摘要、要点、思维导图等)
- 复制和分享结果

**关键功能:**
- 进度步骤可视化
- 结果一键复制
- 分享功能

### 历史记录页 (pages/history/index)

- 查看所有分析历史
- 按分组筛选
- 搜索历史记录
- 收藏/取消收藏
- 删除记录

**关键功能:**
- 多条件筛选
- 快速搜索
- 批量操作

### 个人中心页 (pages/profile/index)

- 查看账户信息
- 配置分析设置 (Whisper模型选择)
- 修改密码
- 登出账户

**关键功能:**
- 实时配置保存
- 账户管理

### 登录/注册页

- 用户注册
- 用户登录
- 游客模式

## API集成

小程序通过 `utils/api.js` 与后端通信，支持以下API:

### 认证 (authApi)
- `register(email, password, username)` - 注册
- `login(email, password)` - 登录
- `logout()` - 登出
- `getCurrentUser()` - 获取当前用户
- `createGuest()` - 创建游客账户

### 分析 (analysisApi)
- `create(url, type, useWhisper, model)` - 创建分析任务
- `getProgress(taskId)` - 获取进度
- `getById(taskId)` - 获取结果
- `getModels()` - 获取可用模型

### 历史 (historyApi)
- `getList(params)` - 获取历史列表
- `getById(historyId)` - 获取历史详情
- `delete(historyId)` - 删除历史
- `toggleFavorite(historyId, isFavorite)` - 收藏/取消收藏

### 分组 (groupsApi)
- `getList()` - 获取分组列表
- `create(name, description)` - 创建分组
- `update(groupId, name, description)` - 更新分组
- `delete(groupId)` - 删除分组

## 状态管理

使用 `utils/store.js` 进行全局状态管理:

```javascript
const store = require('../../utils/store');

// 获取状态
const user = store.getUser();
const tasks = store.getActiveTasks();

// 更新状态
store.setUser(user);
store.addTask(task);
store.updateTask(taskId, updates);

// 订阅状态变化
const unsubscribe = store.subscribe((state) => {
  console.log('状态已更新:', state);
});
```

## 样式系统

小程序使用统一的设计系统:

- **主色**: #667eea (紫色)
- **辅助色**: #764ba2 (深紫)
- **成功色**: #10b981 (绿色)
- **错误色**: #ef4444 (红色)
- **背景色**: #f9fafb (浅灰)

## 常见问题

### Q: 如何修改API地址?
A: 编辑 `utils/api.js` 中的 `API_BASE_URL` 常量。

### Q: 如何添加新的分析类型?
A: 在首页的 `analysisTypes` 数据中添加新类型，后端需要相应支持。

### Q: 如何自定义样式?
A: 修改各页面的 `.wxss` 文件，或编辑 `app.wxss` 修改全局样式。

### Q: 如何处理网络错误?
A: API层已内置错误处理，会自动显示错误提示。可在 `utils/api.js` 中自定义错误处理逻辑。

## 开发建议

1. **调试**: 使用微信开发者工具的调试器查看console日志
2. **性能**: 避免在onLoad中进行过多异步操作
3. **用户体验**: 使用wx.showLoading/hideLoading提示用户
4. **错误处理**: 所有API调用都应该有try-catch处理
5. **本地存储**: 使用wx.setStorageSync/getStorageSync保存用户数据

## 部署

### 小程序发布流程

1. 在微信公众平台注册小程序账号
2. 获取AppID
3. 在微信开发者工具中配置AppID
4. 上传代码到微信后台
5. 提交审核
6. 审核通过后发布

### 后端配置

确保后端API服务:
- 已启动并运行在配置的地址
- CORS已正确配置以支持小程序请求
- 所有必要的API端点已实现

## 许可证

MIT License

## 支持

如有问题或建议，请提交Issue或联系开发团队。
