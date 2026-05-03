# 微信小程序快速开始指南

## 📱 项目概述

Omni-Notes 微信小程序是一个AI驱动的视频分析工具，支持B站和抖音视频的智能分析。

## 🚀 快速开始

### 第一步：配置API地址

编辑 `miniprogram/utils/api.js`，修改第3行的API地址：

```javascript
const API_BASE_URL = 'http://localhost:8000/api/v1';  // 改为你的后端地址
```

### 第二步：在微信开发者工具中打开

1. 打开微信开发者工具
2. 点击"导入项目"
3. 选择项目根目录 `/Users/wangjifei/Desktop/omni-notes`
4. 填写AppID（可使用测试号）
5. 点击"导入"

### 第三步：编译和预览

1. 点击"编译"按钮
2. 点击"预览"在手机上扫码预览

## 📋 页面导航

### 底部导航栏
- **分析** - 首页，输入视频链接进行分析
- **历史** - 查看分析历史记录
- **我的** - 个人中心和设置

### 页面流程

```
首页 (index)
├── 输入视频链接
├── 选择分析类型
├── 配置语音识别
└── 查看任务列表
    └── 点击任务 → 分析详情页 (analysis/detail)
        ├── 实时进度显示
        ├── 分析结果展示
        └── 复制/分享结果

历史记录页 (history)
├── 搜索记录
├── 按分组筛选
├── 排序选项
└── 收藏/删除操作

个人中心页 (profile)
├── 账户信息
├── 分析设置
├── 修改密码
└── 登出账户

认证页面
├── 登录 (auth/login)
└── 注册 (auth/register)

分组管理页 (groups)
├── 创建分组
├── 编辑分组
└── 删除分组
```

## 🔑 核心功能

### 1. 视频分析
- 支持B站 (b23.tv) 和抖音分享链接
- 4种分析类型：综合分析、摘要、核心要点、思维导图
- 可选的Whisper语音识别

### 2. 实时进度
- 2秒间隔自动更新
- 分步骤进度显示
- 完成后自动停止轮询

### 3. 历史管理
- 完整的历史记录
- 按分组筛选
- 搜索功能
- 收藏/取消收藏

### 4. 用户系统
- 注册/登录
- 游客模式
- 个人设置

## 🎨 设计特点

- **现代化UI**: 紫色渐变主题
- **响应式设计**: 适配各种屏幕
- **流畅动画**: 加载、过渡效果
- **用户友好**: 清晰的提示和反馈

## 📝 API集成

小程序通过以下API与后端通信：

### 认证
- POST `/auth/register` - 注册
- POST `/auth/login` - 登录
- POST `/auth/logout` - 登出
- GET `/auth/me` - 获取当前用户
- POST `/auth/guest` - 创建游客账户

### 分析
- POST `/analysis` - 创建分析任务
- GET `/analysis/{taskId}/progress` - 获取进度
- GET `/analysis/{taskId}` - 获取结果

### 历史
- GET `/history` - 获取历史列表
- DELETE `/history/{historyId}` - 删除历史
- PATCH `/history/{historyId}` - 更新历史（收藏、分组）

### 分组
- GET `/groups` - 获取分组列表
- POST `/groups` - 创建分组
- PATCH `/groups/{groupId}` - 更新分组
- DELETE `/groups/{groupId}` - 删除分组

### 配置
- GET `/config` - 获取用户配置
- PATCH `/config` - 更新用户配置

## 🔧 开发建议

### 调试
```javascript
// 在页面中查看console日志
console.log('调试信息');

// 使用微信开发者工具的调试器
// 快捷键: Ctrl+Shift+I (Windows) 或 Cmd+Option+I (Mac)
```

### 常见问题

**Q: 如何修改API地址？**
A: 编辑 `utils/api.js` 中的 `API_BASE_URL` 常量

**Q: 如何添加新的分析类型？**
A: 在首页的 `analysisTypes` 数据中添加，后端需要相应支持

**Q: 如何自定义样式？**
A: 修改各页面的 `.wxss` 文件

**Q: 如何处理网络错误？**
A: API层已内置错误处理，会自动显示错误提示

## 📦 项目结构

```
miniprogram/
├── pages/              # 页面文件
│   ├── index/         # 首页
│   ├── analysis/      # 分析详情
│   ├── history/       # 历史记录
│   ├── profile/       # 个人中心
│   ├── auth/          # 认证页面
│   └── groups/        # 分组管理
├── utils/             # 工具函数
│   ├── api.js        # API服务层
│   └── store.js      # 状态管理
├── app.js            # 应用入口
├── app.json          # 应用配置
└── README.md         # 文档
```

## 🚢 部署步骤

1. **获取AppID**
   - 在微信公众平台注册小程序账号
   - 获取AppID

2. **配置后端**
   - 确保后端API服务已启动
   - 配置CORS支持小程序请求

3. **上传代码**
   - 在微信开发者工具中点击"上传"
   - 填写版本号和描述
   - 上传到微信后台

4. **提交审核**
   - 在微信公众平台提交审核
   - 等待审核通过

5. **发布**
   - 审核通过后点击"发布"
   - 小程序上线

## 📞 支持

如有问题或建议，请：
1. 查看 `miniprogram/README.md` 详细文档
2. 检查 `MINIPROGRAM_SUMMARY.md` 完整实现说明
3. 查看后端API文档

## ✅ 检查清单

部署前请确认：
- [ ] API地址已正确配置
- [ ] 后端服务已启动
- [ ] CORS已正确配置
- [ ] 所有必要的API端点已实现
- [ ] 小程序已在微信开发者工具中编译通过
- [ ] 在模拟器中测试基本功能
- [ ] 在真机上测试网络请求

## 🎉 完成！

现在你可以开始使用Omni-Notes微信小程序了！

祝你使用愉快！🚀
