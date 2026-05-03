# 微信小程序项目结构说明

## 目录树

```
miniprogram/
├── pages/                          # 页面文件夹
│   ├── index/                      # 首页 - 视频输入和任务列表
│   │   ├── index.js               # 页面逻辑
│   │   ├── index.wxml             # 页面模板
│   │   ├── index.wxss             # 页面样式
│   │   └── index.json             # 页面配置
│   │
│   ├── analysis/
│   │   └── detail/                # 分析详情页 - 实时进度和结果展示
│   │       ├── index.js
│   │       ├── index.wxml
│   │       ├── index.wxss
│   │       └── index.json
│   │
│   ├── history/                   # 历史记录页 - 历史管理和筛选
│   │   ├── index.js
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.json
│   │
│   ├── profile/                   # 个人中心页 - 用户信息和设置
│   │   ├── index.js
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.json
│   │
│   ├── auth/                      # 认证页面
│   │   ├── login/                 # 登录页
│   │   │   ├── index.js
│   │   │   ├── index.wxml
│   │   │   ├── index.wxss
│   │   │   └── index.json
│   │   │
│   │   └── register/              # 注册页
│   │       ├── index.js
│   │       ├── index.wxml
│   │       ├── index.wxss
│   │       └── index.json
│   │
│   └── groups/                    # 分组管理页 - 分组CRUD操作
│       ├── index.js
│       ├── index.wxml
│       ├── index.wxss
│       └── index.json
│
├── utils/                         # 工具函数
│   ├── api.js                    # API服务层 - HTTP请求封装
│   └── store.js                  # 全局状态管理 - 单例模式
│
├── components/                    # 可复用组件 (可选)
│   └── cloudTipModal/            # 云开发提示组件 (保留)
│
├── images/                        # 图片资源
│   └── icons/                    # 图标文件
│
├── app.js                        # 应用入口 - 生命周期管理
├── app.json                      # 应用配置 - 路由和窗口配置
├── app.wxss                      # 全局样式
├── sitemap.json                  # 站点地图
├── envList.js                    # 环境列表 (保留)
├── project.config.json           # 项目配置 (在根目录)
├── project.private.config.json   # 私有配置 (在根目录)
│
├── README.md                     # 项目文档
└── PROJECT_STRUCTURE.md          # 本文件
```

## 文件说明

### 核心文件

#### app.js
应用入口文件，处理应用生命周期：
- `onLaunch()` - 应用启动时执行
- 初始化全局数据
- 恢复用户登录状态

#### app.json
应用全局配置：
- `pages` - 页面路由列表
- `window` - 全局窗口配置
- `tabBar` - 底部导航栏配置
- `style` - 样式版本

#### app.wxss
全局样式表，定义全局样式变量和通用样式。

### 页面文件

每个页面包含4个文件：

#### index.js
页面逻辑文件，包含：
- `Page()` 对象定义
- `data` - 页面数据
- 事件处理函数
- 生命周期函数

#### index.wxml
页面模板文件，使用微信小程序模板语法：
- `<view>` - 容器
- `<input>` - 输入框
- `<button>` - 按钮
- `wx:if` - 条件渲染
- `wx:for` - 列表渲染
- `bindtap` - 事件绑定

#### index.wxss
页面样式文件，使用CSS语法：
- 类选择器
- 伪类选择器
- 动画定义
- 响应式设计

#### index.json
页面配置文件：
- `navigationBarTitleText` - 导航栏标题
- `usingComponents` - 使用的组件

### 工具文件

#### utils/api.js
API服务层，提供：
- HTTP请求封装 (`request()` 函数)
- Token自动管理
- 错误处理
- API接口集合：
  - `authApi` - 认证相关
  - `videoApi` - 视频相关
  - `analysisApi` - 分析相关
  - `historyApi` - 历史相关
  - `groupsApi` - 分组相关
  - `configApi` - 配置相关

#### utils/store.js
全局状态管理，提供：
- 单例模式的Store类
- 状态订阅机制
- 本地存储持久化
- 状态操作方法

## 页面流程

### 首页 (pages/index/index)
```
首页加载
  ↓
检查用户登录状态
  ↓
显示认证模态框 (未登录) 或 主要内容 (已登录)
  ↓
用户输入视频链接
  ↓
选择分析类型和配置
  ↓
提交分析任务
  ↓
跳转到分析详情页
```

### 分析详情页 (pages/analysis/detail/index)
```
页面加载
  ↓
启动进度轮询 (2秒间隔)
  ↓
实时更新进度显示
  ↓
任务完成或出错
  ↓
停止轮询
  ↓
显示结果或错误信息
```

### 历史记录页 (pages/history/index)
```
页面加载
  ↓
加载历史列表
  ↓
加载分组列表
  ↓
用户可以：
  - 搜索记录
  - 按分组筛选
  - 排序
  - 收藏/取消收藏
  - 删除记录
```

### 个人中心页 (pages/profile/index)
```
页面加载
  ↓
加载用户信息
  ↓
加载用户配置
  ↓
用户可以：
  - 查看账户信息
  - 修改分析设置
  - 修改密码
  - 登出
```

### 认证页面
```
登录页 (pages/auth/login/index)
  - 输入邮箱和密码
  - 提交登录
  - 跳转到注册页

注册页 (pages/auth/register/index)
  - 输入用户名、邮箱、密码
  - 提交注册
  - 跳转到登录页
```

### 分组管理页 (pages/groups/index)
```
页面加载
  ↓
加载分组列表
  ↓
用户可以：
  - 创建新分组 (模态框)
  - 编辑分组 (行内编辑)
  - 删除分组 (确认对话框)
```

## 数据流

### 用户认证流程
```
用户输入邮箱密码
  ↓
调用 authApi.login()
  ↓
后端验证
  ↓
返回用户信息和token
  ↓
store.setUser() 保存用户信息
  ↓
wx.setStorageSync() 保存token
  ↓
页面重定向
```

### 分析任务流程
```
用户输入视频链接
  ↓
调用 analysisApi.create()
  ↓
后端创建任务
  ↓
返回 taskId
  ↓
store.addTask() 保存任务
  ↓
跳转到分析详情页
  ↓
启动进度轮询
  ↓
每2秒调用 analysisApi.getProgress()
  ↓
更新UI显示
  ↓
任务完成后调用 analysisApi.getById()
  ↓
显示完整结果
```

## 状态管理

### 全局状态结构
```javascript
{
  // 认证状态
  user: { id, username, email, is_guest, token, ... },
  isLoggedIn: boolean,
  isGuest: boolean,
  token: string,

  // 分析状态
  currentTask: { taskId, url, type, status, progress, ... },
  activeTasks: [ { taskId, ... }, ... ],
  analysisHistory: [ { id, ... }, ... ],

  // 分组
  groups: [ { id, name, description, ... }, ... ],

  // UI状态
  loading: boolean,
  error: string | null,
}
```

## API调用示例

### 创建分析任务
```javascript
const { analysisApi } = require('../../utils/api');

const taskId = await analysisApi.create(
  'https://b23.tv/xxx',
  'comprehensive',
  true,
  'base'
);
```

### 获取进度
```javascript
const progress = await analysisApi.getProgress(taskId);
// { step, step_status, percent, message }
```

### 获取结果
```javascript
const result = await analysisApi.getById(taskId);
// { summary, keypoints, mindmap, analysis, ... }
```

## 样式系统

### 色彩方案
- 主色: #667eea (紫色)
- 辅助色: #764ba2 (深紫)
- 成功色: #10b981 (绿色)
- 错误色: #ef4444 (红色)
- 背景色: #f9fafb (浅灰)
- 文字色: #1f2937 (深灰)

### 常用类名
- `.btn` - 按钮
- `.btn-primary` - 主要按钮
- `.btn-secondary` - 次要按钮
- `.btn-danger` - 危险按钮
- `.card` - 卡片
- `.modal` - 模态框
- `.loading` - 加载状态
- `.error` - 错误状态
- `.empty-state` - 空状态

## 开发建议

### 添加新页面
1. 在 `pages/` 下创建新文件夹
2. 创建 `index.js`, `index.wxml`, `index.wxss`, `index.json`
3. 在 `app.json` 的 `pages` 数组中添加路由

### 添加新API
1. 在 `utils/api.js` 中添加新的API函数
2. 导出到相应的API对象 (authApi, analysisApi 等)
3. 在页面中导入使用

### 添加新组件
1. 在 `components/` 下创建新文件夹
2. 创建组件文件 (js, wxml, wxss, json)
3. 在页面的 `index.json` 中声明使用

### 调试技巧
- 使用 `console.log()` 输出调试信息
- 在微信开发者工具中打开调试器 (Ctrl+Shift+I)
- 使用 `wx.showToast()` 显示提示
- 使用 `wx.showModal()` 显示对话框

## 常见问题

**Q: 如何修改API地址？**
A: 编辑 `utils/api.js` 中的 `API_BASE_URL` 常量

**Q: 如何添加新的分析类型？**
A: 在首页的 `analysisTypes` 数据中添加，后端需要相应支持

**Q: 如何自定义样式？**
A: 修改各页面的 `.wxss` 文件，或编辑 `app.wxss` 修改全局样式

**Q: 如何处理网络错误？**
A: API层已内置错误处理，会自动显示错误提示

**Q: 如何保存用户数据？**
A: 使用 `wx.setStorageSync()` 保存到本地存储

## 参考资源

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [WXML 语法](https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/)
- [WXSS 样式](https://developers.weixin.qq.com/miniprogram/dev/reference/wxss/)
- [API 文档](https://developers.weixin.qq.com/miniprogram/dev/api/)

---

最后更新: 2024年
