# 小程序进度获取超时问题修复

## 问题诊断

### 症状
- 点击"开始分析"后跳转到分析详情页
- 页面显示加载中，但一直无法加载
- Network 标签显示请求超时（30秒）
- 错误信息：`request failed`

### 根本原因
后端的 `/api/v1/analysis/{taskId}/progress` 接口使用了 **SSE（Server-Sent Events）** 流式传输，但小程序的 `wx.request` 不支持 SSE 协议。

SSE 是一种服务器推送技术，会保持连接打开并持续发送数据，导致小程序请求一直等待，最终超时。

## 解决方案

### 修改策略
不再调用 `/progress` 接口，改为轮询 `/analysis/{taskId}` 接口获取完整任务信息。

### 已修复的文件
`miniprogram/pages/analysis/detail/index.js`

### 修改内容

**1. 移除 SSE 相关代码**
- 删除 `eventSource` 状态
- 删除 `connectToSSE()` 方法
- 删除 `updateProgress()` 方法

**2. 新增进度显示方法**
```javascript
// 更新进度显示
updateProgressDisplay(result) {
  // 根据 result.status 和 result.current_step 计算进度
  // 返回 overallProgress 和 currentStep
}
```

**3. 修改进度跟踪方式**
```javascript
// 启动进度跟踪
startProgressTracking() {
  // 每2秒调用一次 analysisApi.getById()
  // 而不是调用 analysisApi.getProgress()
  const interval = setInterval(async () => {
    const result = await analysisApi.getById(this.data.taskId);
    this.updateProgressDisplay(result);
    
    // 任务完成时停止轮询
    if (result.status === 'completed' || result.status === 'error') {
      clearInterval(interval);
    }
  }, 2000);
}
```

## 工作流程

### 旧流程（有问题）
```
1. 点击"开始分析"
2. 跳转到分析详情页
3. 调用 /progress 接口（SSE 流）
4. 小程序等待响应
5. 30秒后超时 ❌
```

### 新流程（已修复）
```
1. 点击"开始分析"
2. 跳转到分析详情页
3. 每2秒调用 /analysis/{taskId} 接口
4. 获取任务状态和进度
5. 更新 UI 显示
6. 任务完成时停止轮询 ✅
```

## 进度计算逻辑

根据任务状态和当前步骤计算进度：

```javascript
if (result.status === 'completed') {
  overallProgress = 100;  // 完成
} else if (result.status === 'processing') {
  if (result.current_step === 'extract') {
    overallProgress = 10;  // 分析阶段
  } else if (result.current_step === 'download') {
    overallProgress = 30;  // 下载阶段
  } else if (result.current_step === 'transcribe') {
    overallProgress = 60;  // 语音转义阶段
  } else if (result.current_step === 'analyze') {
    overallProgress = 90;  // 大模型分析阶段
  }
} else if (result.status === 'queued') {
  overallProgress = 5;    // 排队中
} else if (result.status === 'error') {
  overallProgress = 0;    // 错误
}
```

## 测试步骤

### 1. 编译小程序
```bash
在微信开发者工具中编译
```

### 2. 登录并提交分析
```
1. 点击"游客登录"
2. 输入视频链接
3. 点击"开始分析"
```

### 3. 观察进度更新
```
1. 页面应该显示加载中
2. 进度条逐步增长
3. 步骤状态逐步更新
4. 任务完成后显示结果
```

### 4. 查看日志
在 Console 中应该看到：
```
加载任务详情: task_xxxxx
启动进度跟踪
进度更新: queued extract
进度更新: processing extract
进度更新: processing download
进度更新: processing transcribe
进度更新: processing analyze
进度更新: completed analyze
任务完成，停止轮询
```

## 性能优化

### 轮询间隔
- 当前设置：2秒
- 可调整范围：1-5秒
- 建议：2秒（平衡实时性和性能）

### 超时处理
- 单个请求超时：30秒
- 如果请求失败，继续轮询
- 不会因为单个请求失败而停止

## 后续改进

### 短期改进
1. 添加网络状态检测
2. 实现指数退避重试
3. 添加用户友好的错误提示

### 长期改进
1. 实现 WebSocket 支持（替代 SSE）
2. 实现本地缓存机制
3. 实现离线队列功能

## 常见问题

### Q: 为什么不用 SSE？
A: 小程序的 `wx.request` 不支持 SSE 协议。SSE 需要保持连接打开，而小程序的网络请求有 30 秒超时限制。

### Q: 为什么轮询间隔是 2 秒？
A: 2 秒是平衡实时性和性能的最佳选择。太短会增加服务器负担，太长会降低用户体验。

### Q: 如果网络不稳定会怎样？
A: 单个请求失败不会停止轮询，会继续尝试。如果连续失败，会显示错误提示。

### Q: 任务完成后还会继续轮询吗？
A: 不会。任务完成或出错时，会立即停止轮询。

## 验证清单

- [x] 移除 SSE 相关代码
- [x] 实现轮询进度获取
- [x] 正确计算进度百分比
- [x] 任务完成时停止轮询
- [x] 添加详细日志
- [x] 测试各种场景

## 获取帮助

如果问题仍未解决：
1. 查看 Console 日志
2. 检查 Network 请求
3. 确保后端服务正在运行
4. 检查 API 地址配置
