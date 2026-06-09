# 小程序"开始分析"按钮故障排查指南

## 问题症状
点击"开始分析"按钮没有任何反应

## 快速诊断步骤

### 第一步：检查按钮是否被禁用
1. 打开微信开发者工具
2. 在首页输入一个视频链接
3. 观察"开始分析"按钮是否变为可用状态（不是灰色）
4. 如果按钮仍然是灰色，说明 `isButtonDisabled` 状态有问题

**解决方案**:
- 确保在 `data` 中初始化了 `isButtonDisabled: true`
- 确保 `onUrlInput` 方法正确更新了 `isButtonDisabled` 状态

### 第二步：检查登录状态
1. 打开微信开发者工具的 Console 标签
2. 执行以下命令：
```javascript
wx.getStorageSync('user_id')
wx.getStorageSync('auth_token')
```
3. 如果返回空值，说明未登录

**解决方案**:
- 先完成登录流程（游客登录或微信授权）
- 确保 Storage 中保存了 `user_id` 和 `auth_token`

### 第三步：检查 API 配置
1. 打开 `miniprogram/utils/config.js`
2. 检查 `API_URLS` 中的地址是否正确
3. 确保后端服务正在运行

**当前配置**:
```javascript
const API_URLS = {
  development: 'http://192.168.1.187:8000/api/v1',
  production: 'https://your-domain.com/api/v1',
};
```

**修改方法**:
- 如果后端地址不同，修改 `development` 的值
- 确保地址以 `/api/v1` 结尾

### 第四步：启用调试日志
1. 打开 `miniprogram/pages/index/index.js`
2. 点击"开始分析"按钮
3. 在微信开发者工具的 Console 中查看日志

**预期日志输出**:
```
=== 开始分析 ===
登录状态: true
视频链接: https://www.bilibili.com/video/BV1xxx
分析类型: comprehensive
调用 API: analysisApi.create
参数: {...}
[API] POST http://192.168.1.187:8000/api/v1/analysis
[API] Headers: {...}
[API] Data: {...}
[API] Response (201): {...}
任务ID: uuid-xxx
添加任务到 store: {...}
2秒后跳转到分析详情页
跳转到分析详情页: /pages/analysis/detail/index?taskId=uuid-xxx
```

### 第五步：检查网络请求
1. 打开微信开发者工具的 Network 标签
2. 点击"开始分析"按钮
3. 查看是否有 POST 请求到 `/api/v1/analysis`

**可能的问题**:
- 请求没有发送 → 检查按钮点击事件绑定
- 请求返回 401 → 检查认证令牌
- 请求返回 400 → 检查请求数据格式
- 请求超时 → 检查网络连接和后端服务

## 常见问题和解决方案

### 问题 1: 按钮始终是灰色的
**原因**: `isButtonDisabled` 状态未正确更新

**解决方案**:
```javascript
// 检查 onUrlInput 方法
onUrlInput(e) {
  const videoUrl = e.detail.value;
  const isButtonDisabled = !videoUrl || videoUrl.trim().length === 0;
  this.setData({ 
    videoUrl,
    isButtonDisabled,  // 必须更新这个状态
  });
}
```

### 问题 2: 点击按钮没有反应
**原因**: 事件绑定错误或函数不存在

**解决方案**:
1. 检查 WXML 中的 `bindtap="onSubmitAnalysis"`
2. 检查 JS 中是否定义了 `onSubmitAnalysis` 方法
3. 确保方法名称完全匹配（区分大小写）

### 问题 3: 显示"未授权，请重新登录"
**原因**: 认证令牌过期或无效

**解决方案**:
1. 清除 Storage：
```javascript
wx.removeStorageSync('auth_token');
wx.removeStorageSync('user_id');
```
2. 重新登录
3. 再次尝试提交分析

### 问题 4: 显示"无法连接到服务器"
**原因**: API 地址配置错误或后端服务未运行

**解决方案**:
1. 检查 `miniprogram/utils/config.js` 中的 API 地址
2. 确保后端服务正在运行：
```bash
# 在后端目录执行
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```
3. 测试 API 连接：
```bash
curl http://192.168.1.187:8000/api/v1/analysis/models
```

### 问题 5: 显示"不支持的链接格式"
**原因**: 输入的链接不是 B 站或抖音链接

**解决方案**:
- 确保输入的是完整的视频链接
- 支持的格式：
  - B 站: `https://www.bilibili.com/video/BVxxx`
  - 抖音: `https://www.douyin.com/video/xxx`

## 完整测试流程

### 1. 环境准备
```bash
# 确保后端服务运行
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. 打开小程序
- 打开微信开发者工具
- 导入小程序项目
- 编译并预览

### 3. 登录
- 点击"游客登录"或"微信授权登录"
- 验证登录成功

### 4. 提交分析
- 在首页输入视频链接
- 点击"开始分析"
- 观察 Console 日志
- 验证是否跳转到分析详情页

### 5. 查看结果
- 在分析详情页观察进度更新
- 等待任务完成
- 查看分析结果

## 调试命令

在微信开发者工具的 Console 中执行以下命令进行调试：

```javascript
// 1. 检查 API 配置
const config = require('miniprogram/utils/config');
console.log('API 地址:', config.apiUrl);

// 2. 检查存储状态
console.log('user_id:', wx.getStorageSync('user_id'));
console.log('auth_token:', wx.getStorageSync('auth_token'));

// 3. 检查应用状态
const store = require('miniprogram/utils/store');
console.log('Store 状态:', store.getState());

// 4. 测试 API 连接
const { authApi } = require('miniprogram/utils/api');
authApi.createGuest().then(user => {
  console.log('✓ API 连接正常:', user);
}).catch(err => {
  console.error('✗ API 连接失败:', err.message);
});

// 5. 获取当前页面数据
const pages = getCurrentPages();
const currentPage = pages[pages.length - 1];
console.log('当前页面:', currentPage.route);
console.log('页面数据:', currentPage.data);

// 6. 手动触发分析
currentPage.onSubmitAnalysis();
```

## 性能监控

### 检查请求时间
1. 打开 Network 标签
2. 点击"开始分析"
3. 查看 POST 请求的时间
4. 如果超过 30 秒，说明请求超时

### 检查内存使用
1. 打开 Console
2. 执行 `performance.memory`
3. 观察内存使用情况

## 获取帮助

如果问题仍未解决，请收集以下信息：

1. **错误信息**: 完整的错误提示
2. **日志输出**: Console 中的完整日志
3. **网络请求**: Network 标签中的请求和响应
4. **环境信息**:
   - 微信版本
   - 手机型号
   - 后端服务地址
   - 后端服务状态

然后提交问题报告。
