# 进度实时更新修复

## 问题描述
小程序点击"开始分析"后，任务一直显示"等待处理中"，没有实时进度更新。

## 修复内容

### 1. 后端修复 (backend/app/routers/analysis.py)
- 添加 `current_step` 和 `message` 字段到任务详情响应
- 从实时进度服务获取当前步骤
- 新增 `_get_step_message()` 函数生成友好的进度消息

### 2. 后端修复 (backend/app/models/schemas.py)
- 添加 `current_step: Optional[str]` 字段
- 添加 `message: Optional[str]` 字段  
- 添加 `error_message: Optional[str]` 字段

### 3. 小程序修复 (miniprogram/pages/analysis/detail/index.js)
- 更新 `updateProgressDisplay()` 方法，使用新字段
- 根据 `current_step` 计算进度百分比
- 显示进度消息

### 4. 小程序修复 (miniprogram/pages/analysis/detail/index.wxml)
- 简化进度显示，使用 `currentStep` 字符串
- 显示进度条和百分比
- 显示当前步骤名称

### 5. 小程序修复 (miniprogram/pages/analysis/detail/index.wxss)
- 添加进度条样式
- 添加步骤指示器样式

## 进度计算逻辑

| 状态 | current_step | 进度 | 消息 |
|------|---------------|------|------|
| pending | - | 0% | 准备开始... |
| queued | - | 5% | 等待处理中... |
| running | extract | 10% | 正在解析视频信息... |
| running | download | 30% | 正在下载视频... |
| running | transcribe | 60% | 正在语音转文字... |
| running | analyze | 90% | 正在AI分析... |
| completed | - | 100% | 分析完成 |
| failed | - | 0% | 分析失败 |

## 测试步骤

### 1. 重启后端服务
```bash
cd /Users/wangjifei/Desktop/omni-notes/backend

# 停止旧服务
kill $(lsof -t -i :8000)

# 启动新服务
python run.py
```

### 2. 测试小程序
1. 打开小程序
2. 登录（游客登录）
3. 输入视频链接
4. 点击"开始分析"
5. 观察分析详情页的进度更新

### 3. 查看日志
```bash
tail -f /Users/wangjifei/Desktop/omni-notes/backend/backend.log
```

## 预期结果

- 页面显示进度条，逐步增长
- 显示当前步骤消息（如"正在解析视频信息..."）
- 步骤指示器显示当前步骤
- 任务完成后显示分析结果