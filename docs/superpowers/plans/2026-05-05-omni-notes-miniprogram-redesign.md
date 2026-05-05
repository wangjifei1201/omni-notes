# Omni-Notes 小程序重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于设计系统重构小程序 UI，保留现有业务逻辑

**Architecture:**
- 微信小程序原生框架
- 设计系统变量集中管理在 app.wxss
- 页面样式按设计原型实现
- 业务逻辑（API调用、数据管理）保持不变

**Tech Stack:** 微信小程序原生框架 + WXSS + JavaScript

---

## 文件结构概览

```
miniprogram/
├── app.wxss                      # 全局样式（设计系统变量）
├── app.json                      # 路由和TabBar配置
├── pages/
│   ├── index/
│   │   ├── index.wxml          # 首页 - 品牌区、输入框、能力展示
│   │   ├── index.wxss           # 首页样式
│   │   └── index.js             # 首页逻辑（复用）
│   ├── history/
│   │   ├── index.wxml           # 历史页 - 分组筛选、搜索、卡片列表
│   │   ├── index.wxss           # 历史页样式
│   │   └── index.js             # 历史页逻辑
│   ├── analysis/detail/
│   │   ├── index.wxml           # 详情页 - Tab切换、左滑操作
│   │   ├── index.wxss           # 详情页样式
│   │   └── index.js             # 详情页逻辑
│   └── profile/
│       ├── index.wxml           # 我的页 - 用户信息、菜单
│       ├── index.wxss           # 我的页样式
│       └── index.js             # 我的页逻辑
└── utils/
    └── api.js                   # API 调用（保持不变）
```

---

## Task 1: 更新全局样式和 TabBar 配置

**Files:**
- Modify: `miniprogram/app.wxss` - 添加设计系统变量
- Modify: `miniprogram/app.json` - 更新 TabBar 图标和文本

- [ ] **Step 1: 更新 app.wxss 设计系统变量**

替换 `app.wxss` 中的变量定义，确保符合设计系统：

```css
/* app.wxss - Omni-Notes 设计系统全局样式 */
page {
  /* 主色调 - 紫色渐变 */
  --primary: #7c3aed;
  --primary-light: #a855f7;
  --primary-dark: #5b21b6;

  /* 背景色 */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fc;

  /* 文字色 */
  --text-primary: #1a1a2e;
  --text-secondary: #6b6b7e;
  --text-tertiary: #8b8b9e;

  /* 功能色 */
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;

  /* 阴影 */
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);

  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 16px;
}
```

- [ ] **Step 2: 更新 app.json TabBar 配置**

更新 TabBar 的图标和文本，使用设计系统图标（◈, ◊, ◯）：

```json
"tabBar": {
  "color": "#8b8b9e",
  "selectedColor": "#7c3aed",
  "backgroundColor": "#ffffff",
  "borderStyle": "black",
  "list": [
    {
      "pagePath": "pages/index/index",
      "text": "首页",
      "iconPath": "images/icons/home.png",
      "selectedIconPath": "images/icons/home-active.png"
    },
    {
      "pagePath": "pages/history/index",
      "text": "历史",
      "iconPath": "images/icons/history.png",
      "selectedIconPath": "images/icons/history-active.png"
    },
    {
      "pagePath": "pages/profile/index",
      "text": "我的",
      "iconPath": "images/icons/usercenter.png",
      "selectedIconPath": "images/icons/usercenter-active.png"
    }
  ]
}
```

注意：需要创建新的图标文件或使用实际存在的图标

- [ ] **Step 3: 添加通用按钮和卡片样式到 app.wxss**

```css
/* ========== 通用按钮样式 ========== */
.btn-primary {
  background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a855f7 100%);
  color: white;
  font-weight: 600;
  border-radius: 12px;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
}

.btn-primary.disabled {
  background: linear-gradient(135deg, #d1d5db 0%, #e5e7eb 100%);
  box-shadow: none;
}

/* ========== 通用卡片样式 ========== */
.card {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

/* ========== 状态标签 ========== */
.status-badge {
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
}

.status-badge.completed {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-badge.processing {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-badge.failed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}
```

- [ ] **Step 4: 提交**

```bash
git add miniprogram/app.wxss miniprogram/app.json
git commit -m "feat: 更新全局样式和TabBar配置"
```

---

## Task 2: 首页重构

**Files:**
- Modify: `miniprogram/pages/index/index.wxml` - 重构页面结构
- Modify: `miniprogram/pages/index/index.wxss` - 重构页面样式

- [ ] **Step 1: 更新 index.wxml**

根据设计原型重构首页结构（一屏展示）：

```xml
<!--pages/index/index.wxml - Omni-Notes 首页 -->
<view class="page-container">
  <!-- 顶部品牌区 -->
  <view class="brand-header">
    <view class="brand-logo">O</view>
    <view class="brand-info">
      <text class="brand-name">Omni-Notes</text>
      <text class="brand-slogan">AI 视频笔记</text>
    </view>
  </view>

  <!-- 内容区 -->
  <view class="content-area">
    <!-- 主标题 -->
    <view class="title-section">
      <text class="main-title">粘贴视频链接</text>
      <text class="sub-title">AI 智能分析，一键生成笔记</text>
    </view>

    <!-- URL输入框 -->
    <view class="url-input-box {{focused ? 'focused' : ''}}">
      <text class="input-icon">+</text>
      <input
        class="url-input"
        type="text"
        placeholder="https://www.bilibili.com/video/BV..."
        placeholder-class="input-placeholder"
        value="{{videoUrl}}"
        bindinput="onUrlInput"
        bindfocus="onFocus"
        bindblur="onBlur"
      />
    </view>

    <!-- 平台标签（静态提示） -->
    <view class="platform-tags">
      <view class="tag-item bilibili">
        <text class="tag-icon">B</text>
        <text class="tag-name">B站</text>
      </view>
      <view class="tag-item douyin">
        <text class="tag-icon">D</text>
        <text class="tag-name">抖音</text>
      </view>
    </view>

    <!-- 固定底部按钮 -->
    <button
      class="start-btn {{videoUrl ? '' : 'disabled'}}"
      bindtap="onSubmitAnalysis"
      disabled="{{!videoUrl || isAnalyzing}}"
    >
      <view class="btn-content">
        <text class="btn-icon">▶</text>
        <text class="btn-text">{{isAnalyzing ? '分析中...' : '开始分析'}}</text>
      </view>
    </button>

    <!-- 能力展示区 -->
    <view class="features-section">
      <text class="section-title">能力</text>
      <view class="features-grid">
        <view class="feature-item">
          <text class="feature-icon">N</text>
          <view class="feature-content">
            <text class="feature-title">智能摘要</text>
            <text class="feature-desc">快速获取视频核心内容</text>
          </view>
        </view>
        <view class="feature-item">
          <text class="feature-icon">S</text>
          <view class="feature-content">
            <text class="feature-title">章节速览</text>
            <text class="feature-desc">AI 自动划分视频章节</text>
          </view>
        </view>
        <view class="feature-item">
          <text class="feature-icon">M</text>
          <view class="feature-content">
            <text class="feature-title">思维导图</text>
            <text class="feature-desc">结构化呈现知识点</text>
          </view>
        </view>
        <view class="feature-item">
          <text class="feature-icon">T</text>
          <view class="feature-content">
            <text class="feature-title">完整字幕</text>
            <text class="feature-desc">自动转录视频语音</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 更新 index.wxss**

```css
/* pages/index/index.wxss - Omni-Notes 首页 */

.page-container {
  min-height: 100vh;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

/* 品牌头部 */
.brand-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 16px;
}

.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1a1a2e 0%, #4a4a6a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: white;
}

.brand-info {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
}

.brand-slogan {
  font-size: 11px;
  color: #8b8b9e;
}

/* 内容区 */
.content-area {
  flex: 1;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
}

/* 标题区 */
.title-section {
  margin-bottom: 16px;
}

.main-title {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.sub-title {
  display: block;
  font-size: 12px;
  color: #8b8b9e;
}

/* URL输入框 */
.url-input-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f8f9fc;
  border-radius: 12px;
  padding: 4px 4px 4px 14px;
  margin-bottom: 12px;
  border: 1.5px solid transparent;
  transition: all 0.2s ease;
}

.url-input-box.focused {
  background: #ffffff;
  border-color: #7c3aed;
  box-shadow: 0 0 0 4px rgba(124, 58, 237, 0.1);
}

.input-icon {
  font-size: 16px;
  color: #a0a0b0;
}

.url-input {
  flex: 1;
  height: 44px;
  font-size: 13px;
  color: #1a1a2e;
}

.input-placeholder {
  color: #a0a0b0;
}

/* 平台标签 */
.platform-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.tag-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f8f9fc;
  border-radius: 16px;
}

.tag-item.bilibili {
  background: rgba(0, 161, 214, 0.08);
}

.tag-item.douyin {
  background: rgba(254, 44, 85, 0.08);
}

.tag-icon {
  font-size: 12px;
  font-weight: 700;
  color: #6b6b7e;
}

.tag-name {
  font-size: 11px;
  color: #6b6b7e;
}

/* 固定底部按钮 */
.start-btn {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(60px + env(safe-area-inset-bottom, 0px));
  height: 44px;
  background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a855f7 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
}

.start-btn.disabled {
  background: linear-gradient(135deg, #d1d5db 0%, #e5e7eb 100%);
  box-shadow: none;
}

.btn-content {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-icon {
  font-size: 14px;
  color: #ffffff;
}

.btn-text {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

/* 能力展示区 */
.features-section {
  padding-top: 16px;
  border-top: 1px solid #f0f0f5;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a2e;
  margin-bottom: 12px;
  display: block;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: #f8f9fc;
  border-radius: 12px;
}

.feature-icon {
  font-size: 18px;
  font-weight: 700;
  color: #7c3aed;
}

.feature-content {
  flex: 1;
}

.feature-title {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 2px;
}

.feature-desc {
  display: block;
  font-size: 10px;
  color: #8b8b9e;
}
```

- [ ] **Step 3: 更新 index.js 添加焦点状态**

在 `index.js` 的 `data` 中添加 `focused` 状态，并添加 `onFocus` 和 `onBlur` 方法：

```javascript
// 在 data 中添加
data: {
  videoUrl: '',
  isAnalyzing: false,
  focused: false,
}

// 添加方法
onFocus: function() {
  this.setData({ focused: true });
},

onBlur: function() {
  this.setData({ focused: false });
},
```

- [ ] **Step 4: 验证首页布局**

确保首页在一屏内展示所有元素，无滚动。

- [ ] **Step 5: 提交**

```bash
git add miniprogram/pages/index/index.wxml miniprogram/pages/index/index.wxss miniprogram/pages/index/index.js
git commit -m "feat(index): 重构首页UI，遵循设计系统"
```

---

## Task 3: 历史页重构

**Files:**
- Modify: `miniprogram/pages/history/index.wxml` - 重构历史页结构
- Modify: `miniprogram/pages/history/index.wxss` - 重构历史页样式
- Modify: `miniprogram/pages/history/index.js` - 更新分组筛选逻辑

- [ ] **Step 1: 更新 index.wxml**

```xml
<!--pages/history/index.wxml - 历史记录页-->
<view class="page-container">
  <!-- 顶部导航 -->
  <view class="nav-header">
    <view class="nav-left"></view>
    <text class="page-title">分析历史</text>
    <view class="nav-right" bindtap="onOpenGroupManager">
      <text class="manage-btn">⚙</text>
    </view>
  </view>

  <!-- 搜索栏 -->
  <view class="search-section">
    <view class="search-bar">
      <text class="search-icon">◉</text>
      <input
        class="search-input"
        type="text"
        placeholder="搜索历史记录..."
        value="{{searchKeyword}}"
        bindinput="onSearchInput"
        placeholder-class="search-placeholder"
      />
      <button class="clear-btn" wx:if="{{searchKeyword}}" bindtap="onClearSearch">
        <text class="clear-icon">✕</text>
      </button>
    </view>
  </view>

  <!-- 分组标签栏 -->
  <view class="group-tabs">
    <scroll-view class="tabs-scroll" scroll-x="true" enhanced="true" show-scrollbar="false">
      <view class="tabs-list">
        <view
          class="tab-item {{selectedGroupId === 'all' ? 'active' : ''}}"
          data-group-id="all"
          bindtap="onGroupChange"
        >
          <text class="tab-name">全部</text>
          <text class="tab-count" wx:if="{{totalCount > 0}}">{{totalCount}}</text>
        </view>
        <view
          class="tab-item {{selectedGroupId === 'ungrouped' ? 'active' : ''}}"
          data-group-id="ungrouped"
          bindtap="onGroupChange"
        >
          <text class="tab-name">未分组</text>
          <text class="tab-count" wx:if="{{ungroupedCount > 0}}">{{ungroupedCount}}</text>
        </view>
        <block wx:for="{{groups}}" wx:key="id">
          <view
            class="tab-item {{selectedGroupId === item.id ? 'active' : ''}}"
            data-group-id="{{item.id}}"
            bindtap="onGroupChange"
          >
            <text class="tab-name">{{item.name}}</text>
            <text class="tab-count" wx:if="{{item.video_count > 0}}">{{item.video_count}}</text>
          </view>
        </block>
      </view>
    </scroll-view>
  </view>

  <!-- 内容区 -->
  <scroll-view class="content-area" scroll-y="true" enhanced="true" show-scrollbar="false">
    <!-- 历史列表 -->
    <view class="history-list" wx:if="{{filteredHistory.length > 0}}">
      <view
        class="history-card"
        wx:for="{{filteredHistory}}"
        wx:key="id"
        data-id="{{item.id}}"
        bindtap="onItemClick"
        bindlongpress="onItemLongPress"
      >
        <!-- 左侧内容区 -->
        <view class="card-content">
          <!-- 标题 -->
          <text class="card-title">{{item.title || '未命名视频'}}</text>

          <!-- 要点列表 -->
          <view class="card-keypoints-row" wx:if="{{item.key_points && item.key_points.length > 0}}">
            <view class="keypoints-content">
              <view class="keypoint-item" wx:for="{{item.key_points}}" wx:for-item="point" wx:key="index" wx:if="{{index < 3}}">
                <text class="keypoint-number">{{index + 1}}</text>
                <text class="keypoint-text">{{point.point}}</text>
              </view>
            </view>
          </view>

          <!-- 元信息 -->
          <view class="card-meta-row">
            <text class="meta-text">{{item.author || '未知作者'}}</text>
            <text class="meta-sep">·</text>
            <text class="meta-platform {{item.platform}}">{{item.platform === 'bilibili' ? 'B站' : '抖音'}}</text>
            <text class="meta-sep">·</text>
            <text class="meta-time">{{item.created_at}}</text>
          </view>
        </view>

        <!-- 右侧状态 -->
        <view class="card-status">
          <view class="status-badge {{item.status}}">
            <text class="status-icon">{{item.status === 'completed' ? '✓' : item.status === 'failed' ? '✕' : '⟳'}}</text>
            <text class="status-text">{{item.status === 'completed' ? '已完成' : item.status === 'failed' ? '失败' : '进行中'}}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view class="empty-state" wx:if="{{filteredHistory.length === 0}}">
      <text class="empty-icon">◷</text>
      <text class="empty-title">暂无记录</text>
      <text class="empty-desc">{{searchKeyword ? '没有找到匹配的结果' : '开始分析视频，记录将显示在这里'}}</text>
      <button class="empty-action" bindtap="onGoAnalyze" wx:if="{{!searchKeyword}}">
        <text>去分析视频</text>
      </button>
    </view>
  </scroll-view>

  <!-- 操作菜单 -->
  <view class="action-sheet" wx:if="{{showActionSheet}}">
    <view class="sheet-backdrop" bindtap="onCloseActionSheet"></view>
    <view class="sheet-content">
      <view class="sheet-header">
        <text class="sheet-title">操作</text>
      </view>
      <view class="sheet-actions">
        <button class="sheet-btn" bindtap="onViewDetail">
          <text class="btn-icon">◈</text>
          <text class="btn-text">查看详情</text>
        </button>
        <button class="sheet-btn" bindtap="onMoveToGroup">
          <text class="btn-icon">📁</text>
          <text class="btn-text">移动到分组</text>
        </button>
        <button class="sheet-btn delete" bindtap="onDeleteItem">
          <text class="btn-icon">◉</text>
          <text class="btn-text">删除</text>
        </button>
      </view>
      <button class="sheet-cancel" bindtap="onCloseActionSheet">取消</button>
    </view>
  </view>

  <!-- 分组选择面板 -->
  <view class="action-sheet" wx:if="{{showGroupPicker}}">
    <view class="sheet-backdrop" bindtap="onCloseGroupPicker"></view>
    <view class="sheet-content">
      <view class="sheet-header">
        <text class="sheet-title">移动到分组</text>
      </view>
      <view class="group-picker-list">
        <view
          class="group-picker-item"
          wx:for="{{groups}}"
          wx:key="id"
          data-group-id="{{item.id}}"
          bindtap="onConfirmMoveToGroup"
        >
          <text class="picker-icon">📁</text>
          <text class="picker-name">{{item.name}}</text>
          <text class="picker-count">{{item.video_count || 0}} 个视频</text>
        </view>
        <view
          class="group-picker-item"
          data-group-id="ungrouped"
          bindtap="onConfirmMoveToGroup"
        >
          <text class="picker-icon">📋</text>
          <text class="picker-name">未分组</text>
        </view>
      </view>
      <button class="sheet-cancel" bindtap="onCloseGroupPicker">取消</button>
    </view>
  </view>

  <!-- 分组管理面板 -->
  <view class="action-sheet" wx:if="{{showGroupManager}}">
    <view class="sheet-backdrop" bindtap="onCloseGroupManager"></view>
    <view class="sheet-content group-manager-sheet">
      <view class="sheet-header">
        <text class="sheet-title">管理分组</text>
      </view>
      <view class="group-manager-list">
        <view class="group-manager-item" wx:for="{{groups}}" wx:key="id">
          <view class="manager-info">
            <text class="manager-name">{{item.name}}</text>
            <text class="manager-count">{{item.video_count || 0}} 个视频</text>
          </view>
          <view class="manager-actions">
            <button class="manager-btn" data-group-id="{{item.id}}" bindtap="onEditGroup">编辑</button>
            <button class="manager-btn delete" data-group-id="{{item.id}}" bindtap="onDeleteGroupConfirm">删除</button>
          </view>
        </view>
        <view class="group-manager-item empty" wx:if="{{groups.length === 0}}">
          <text class="empty-tip">暂无分组</text>
        </view>
      </view>
      <view class="manager-footer">
        <button class="btn-create-group" bindtap="onShowAddGroupModal">
          <text class="btn-icon">+</text>
          <text>新建分组</text>
        </button>
      </view>
      <button class="sheet-cancel" bindtap="onCloseGroupManager">关闭</button>
    </view>
  </view>

  <!-- 新建分组弹窗 -->
  <view class="modal" wx:if="{{showAddGroupModal}}">
    <view class="modal-backdrop" bindtap="onCloseAddGroupModal"></view>
    <view class="modal-content">
      <view class="modal-header">
        <text class="modal-title">{{editingGroupId ? '编辑分组' : '新建分组'}}</text>
        <button class="modal-close" bindtap="onCloseAddGroupModal"><text>✕</text></button>
      </view>
      <view class="form-group">
        <text class="form-label">分组名称</text>
        <input
          class="form-input"
          type="text"
          placeholder="请输入分组名称"
          value="{{groupFormData.name}}"
          bindinput="onGroupNameInput"
        />
      </view>
      <view class="modal-actions">
        <button class="btn btn-secondary" bindtap="onCloseAddGroupModal">取消</button>
        <button class="btn btn-primary" bindtap="onSaveGroup">保存</button>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 更新 index.wxss**

```css
/* pages/history/index.wxss - 历史记录页 */

.page-container {
  min-height: 100vh;
  background: #f8f9fc;
  display: flex;
  flex-direction: column;
}

/* 导航栏 */
.nav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #ffffff;
}

.nav-left {
  width: 40px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}

.nav-right {
  width: 40px;
  display: flex;
  justify-content: flex-end;
}

.manage-btn {
  font-size: 18px;
  color: #8b8b9e;
}

/* 搜索栏 */
.search-section {
  padding: 12px 16px;
  background: #ffffff;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f8f9fc;
  border-radius: 12px;
  padding: 8px 12px;
}

.search-icon {
  font-size: 16px;
  color: #999;
}

.search-input {
  flex: 1;
  height: 32px;
  font-size: 14px;
  color: #1a1a2e;
}

.search-placeholder {
  color: #bbb;
  font-size: 14px;
}

.clear-btn {
  padding: 4px;
}

.clear-icon {
  font-size: 14px;
  color: #999;
}

/* 分组标签栏 */
.group-tabs {
  background: #ffffff;
  border-bottom: 1px solid #f0f0f5;
}

.tabs-scroll {
  padding: 0 16px;
  white-space: nowrap;
}

.tabs-list {
  display: inline-flex;
  gap: 6px;
  padding: 12px 0;
}

.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f0f0f5;
  border-radius: 16px;
  font-size: 13px;
  color: #666;
  flex-shrink: 0;
}

.tab-item.active {
  background: #7c3aed;
  color: #ffffff;
}

.tab-name {
  font-size: 13px;
}

.tab-count {
  font-size: 11px;
  opacity: 0.8;
}

/* 内容区 */
.content-area {
  flex: 1;
  padding: 12px 16px;
}

/* 历史列表 */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.card-content {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8px;
}

/* 要点列表 */
.card-keypoints-row {
  margin-bottom: 8px;
}

.keypoints-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.keypoint-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.keypoint-number {
  font-size: 11px;
  font-weight: 700;
  color: #7c3aed;
  flex-shrink: 0;
  min-width: 14px;
}

.keypoint-text {
  font-size: 12px;
  color: #666;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 元信息 */
.card-meta-row {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #999;
}

.meta-text {
  font-size: 12px;
  color: #999;
}

.meta-sep {
  font-size: 12px;
  color: #ddd;
  margin: 0 4px;
}

.meta-platform {
  font-size: 12px;
  color: #999;
}

.meta-platform.bilibili {
  color: #00A1D6;
}

.meta-time {
  font-size: 12px;
  color: #999;
}

/* 状态标签 */
.card-status {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-shrink: 0;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  white-space: nowrap;
}

.status-badge.completed {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.status-badge.processing {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-badge.failed {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  color: #ddd;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 8px;
}

.empty-desc {
  font-size: 14px;
  color: #8b8b9e;
  text-align: center;
  margin-bottom: 20px;
}

.empty-action {
  padding: 10px 24px;
  background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a855f7 100%);
  border-radius: 10px;
}

.empty-action text {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}

/* ========== 操作面板样式 ========== */
.action-sheet {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.sheet-content {
  position: relative;
  background: #ffffff;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(34px + env(safe-area-inset-bottom, 0px));
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f5;
}

.sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.sheet-actions {
  padding: 8px 16px;
}

.sheet-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px;
  background: none;
  border: none;
  border-radius: 0;
}

.sheet-btn:active {
  background: #f5f6fa;
}

.sheet-btn.delete .btn-text {
  color: #ef4444;
}

.btn-icon {
  font-size: 18px;
  color: #7c3aed;
}

.btn-text {
  font-size: 15px;
  color: #1a1a2e;
}

.sheet-cancel {
  margin: 8px 16px;
  padding: 14px;
  background: #f5f6fa;
  border-radius: 12px;
  font-size: 15px;
  color: #666;
  text-align: center;
}

/* 分组选择面板 */
.group-picker-list {
  padding: 8px 16px;
}

.group-picker-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #f5f5f5;
}

.group-picker-item:last-child {
  border-bottom: none;
}

.picker-icon {
  font-size: 18px;
}

.picker-name {
  flex: 1;
  font-size: 15px;
  color: #1a1a2e;
}

.picker-count {
  font-size: 12px;
  color: #999;
}

/* 分组管理面板 */
.group-manager-sheet {
  max-height: 70vh;
}

.group-manager-list {
  padding: 8px 16px;
  max-height: 50vh;
  overflow-y: auto;
}

.group-manager-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
}

.group-manager-item.empty {
  justify-content: center;
}

.manager-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.manager-name {
  font-size: 15px;
  color: #1a1a2e;
}

.manager-count {
  font-size: 12px;
  color: #999;
}

.manager-actions {
  display: flex;
  gap: 8px;
}

.manager-btn {
  padding: 4px 10px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 12px;
  color: #666;
}

.manager-btn.delete {
  color: #ef4444;
}

.manager-footer {
  padding: 12px 16px;
  border-top: 1px solid #f0f0f5;
}

.btn-create-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: rgba(124, 58, 237, 0.1);
  border-radius: 10px;
}

.btn-create-group text {
  font-size: 14px;
  color: #7c3aed;
}

.empty-tip {
  font-size: 14px;
  color: #999;
}

/* 弹窗 */
.modal {
  position: fixed;
  inset: 0;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
}

.modal-content {
  position: relative;
  width: 85%;
  background: #ffffff;
  border-radius: 16px;
  padding: 20px;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal-title {
  font-size: 17px;
  font-weight: 600;
  color: #1a1a2e;
}

.modal-close {
  padding: 4px 8px;
  font-size: 18px;
  color: #999;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
}

.form-input {
  width: 100%;
  padding: 12px;
  background: #f8f9fc;
  border-radius: 10px;
  font-size: 15px;
  color: #1a1a2e;
}

.modal-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.btn {
  flex: 1;
  padding: 12px;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
}

.btn-secondary {
  background: #f5f5f5;
  color: #666;
}

.btn-primary {
  background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a855f7 100%);
  color: #ffffff;
}
```

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/history/index.wxml miniprogram/pages/history/index.wxss
git commit -m "feat(history): 重构历史页UI，实现分组筛选和分组管理"
```

---

## Task 4: 详情页重构

**Files:**
- Modify: `miniprogram/pages/analysis/detail/index.wxml` - 重构详情页结构
- Modify: `miniprogram/pages/analysis/detail/index.wxss` - 重构详情页样式

- [ ] **Step 1: 更新 index.wxml**

```xml
<!--pages/analysis/detail/index.wxml - 分析详情页-->
<view class="page-container">
  <!-- 顶部导航 -->
  <view class="nav-header">
    <view class="nav-left"></view>
    <text class="page-title">分析详情</text>
    <view class="nav-right"></view>
  </view>

  <!-- 内容区 -->
  <scroll-view class="content-area" scroll-y="true" enhanced="true" show-scrollbar="false">

    <!-- 品牌头部 -->
    <view class="brand-header">
      <view class="brand-logo">O</view>
      <view class="brand-info">
        <text class="brand-name">Omni-Notes</text>
        <text class="brand-slogan">AI 视频笔记</text>
      </view>
    </view>

    <!-- 视频卡片（可左滑） -->
    <view class="video-card-wrapper">
      <view class="video-card {{swipeClass}}" bindtouchstart="onTouchStart" bindtouchmove="onTouchMove" bindtouchend="onTouchEnd">
        <view class="card-content">
          <view class="video-thumb">
            <image class="thumb-image" src="{{analysis.video.thumbnail || '/images/default-thumb.png'}}" mode="aspectFill" />
            <view class="platform-badge {{analysis.video.platform}}">
              <text>{{analysis.video.platform === 'bilibili' ? 'B站' : '抖音'}}</text>
            </view>
            <view class="play-overlay" wx:if="{{analysis.video.url}}" bindtap="onPlayVideo">
              <view class="play-btn">
                <text class="play-icon">▶</text>
              </view>
            </view>
          </view>
          <view class="video-info">
            <text class="video-title">{{analysis.video.title || '未命名视频'}}</text>
            <view class="video-meta">
              <text class="meta-author" wx:if="{{analysis.video.author}}">{{analysis.video.author}}</text>
              <text class="meta-dot" wx:if="{{analysis.video.author}}">•</text>
              <text class="meta-time">{{analysis.created_at}}</text>
            </view>
          </view>
        </view>
        <!-- 左滑操作按钮 -->
        <view class="swipe-actions">
          <view class="swipe-btn reanalysis" bindtap="onReanalyze">
            <text>重新分析</text>
          </view>
          <view class="swipe-btn delete" bindtap="onDelete">
            <text>删除</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 分析中状态 -->
    <view class="processing-section" wx:if="{{task && task.status !== 'completed' && task.status !== 'failed'}}">
      <view class="processing-header">
        <text class="processing-title">AI 正在分析视频...</text>
        <text class="processing-timer">{{elapsedTimeFormat}}</text>
      </view>

      <view class="progress-card">
        <view class="progress-header">
          <text class="progress-title">分析进度</text>
          <text class="progress-step">{{currentMessage}}</text>
        </view>
        <view class="progress-bar-wrap">
          <view class="progress-bar">
            <view class="progress-fill" style="width: {{overallProgress}}%"></view>
          </view>
        </view>
        <view class="progress-steps">
          <view class="step-item {{currentStep === 'extract' ? 'active' : (stepStatus.extract === 'completed' ? 'completed' : '')}}">
            <view class="step-dot">
              <text wx:if="{{stepStatus.extract === 'completed'}}">✓</text>
              <text wx:elif="{{currentStep === 'extract'}}">◉</text>
              <text wx:else>1</text>
            </view>
            <text class="step-label">解析</text>
          </view>
          <view class="step-line {{stepStatus.extract === 'completed' ? 'completed' : ''}}"></view>
          <view class="step-item {{currentStep === 'download' ? 'active' : (stepStatus.download === 'completed' ? 'completed' : '')}}">
            <view class="step-dot">
              <text wx:if="{{stepStatus.download === 'completed'}}">✓</text>
              <text wx:elif="{{currentStep === 'download'}}">◉</text>
              <text wx:else>2</text>
            </view>
            <text class="step-label">下载</text>
          </view>
          <view class="step-line {{stepStatus.download === 'completed' ? 'completed' : ''}}"></view>
          <view class="step-item {{currentStep === 'transcribe' ? 'active' : (stepStatus.transcribe === 'completed' ? 'completed' : '')}}">
            <view class="step-dot">
              <text wx:if="{{stepStatus.transcribe === 'completed'}}">✓</text>
              <text wx:elif="{{currentStep === 'transcribe'}}">◉</text>
              <text wx:else>3</text>
            </view>
            <text class="step-label">转写</text>
          </view>
          <view class="step-line {{stepStatus.transcribe === 'completed' ? 'completed' : ''}}"></view>
          <view class="step-item {{currentStep === 'analyze' ? 'active' : (stepStatus.analyze === 'completed' ? 'completed' : '')}}">
            <view class="step-dot">
              <text wx:if="{{stepStatus.analyze === 'completed'}}">✓</text>
              <text wx:elif="{{currentStep === 'analyze'}}">◉</text>
              <text wx:else>4</text>
            </view>
            <text class="step-label">分析</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Tab 内容区 -->
    <view class="tabs-section" wx:if="{{task && task.status === 'completed'}}">
      <!-- Tab 头部 -->
      <view class="tabs-header">
        <view
          class="tab-item {{activeTab === 'summary' ? 'active' : ''}}"
          data-tab="summary"
          bindtap="onTabChange"
        >
          <text class="tab-text">摘要</text>
        </view>
        <view
          class="tab-item {{activeTab === 'keypoints' ? 'active' : ''}}"
          data-tab="keypoints"
          bindtap="onTabChange"
        >
          <text class="tab-text">要点</text>
          <view class="tab-badge" wx:if="{{analysis.keypoints && analysis.keypoints.length > 0}}">
            <text>{{analysis.keypoints.length}}</text>
          </view>
        </view>
        <view
          class="tab-item {{activeTab === 'mindmap' ? 'active' : ''}}"
          data-tab="mindmap"
          bindtap="onTabChange"
        >
          <text class="tab-text">导图</text>
        </view>
        <view
          class="tab-item {{activeTab === 'transcript' ? 'active' : ''}}"
          data-tab="transcript"
          bindtap="onTabChange"
        >
          <text class="tab-text">字幕</text>
        </view>
      </view>

      <!-- 内容面板 -->
      <view class="tab-content">
        <!-- 摘要面板 -->
        <view class="content-panel" wx:if="{{activeTab === 'summary'}}">
          <view class="panel-header">
            <text class="panel-title">视频摘要</text>
            <button class="copy-btn" bindtap="onCopySummary">
              <text>复制</text>
            </button>
          </view>
          <view class="summary-content">
            <text class="summary-text" wx:if="{{analysis.summary}}">{{analysis.summary}}</text>
            <view class="empty-panel" wx:else>
              <text class="empty-text">暂无摘要内容</text>
            </view>
          </view>
        </view>

        <!-- 要点面板 -->
        <view class="content-panel" wx:if="{{activeTab === 'keypoints'}}">
          <view class="panel-header">
            <text class="panel-title">核心要点</text>
          </view>
          <view class="keypoints-list" wx:if="{{analysis.keypoints && analysis.keypoints.length > 0}}">
            <view class="keypoint-item" wx:for="{{analysis.keypoints}}" wx:key="index">
              <view class="point-marker">
                <text>{{index + 1}}</text>
              </view>
              <view class="point-content">
                <text class="point-title">{{item.title}}</text>
                <text class="point-time" wx:if="{{item.timestamp}}">{{item.timestamp}}</text>
              </view>
            </view>
          </view>
          <view class="empty-panel" wx:else>
            <text class="empty-text">暂无要点内容</text>
          </view>
        </view>

        <!-- 思维导图面板 -->
        <view class="content-panel" wx:if="{{activeTab === 'mindmap'}}">
          <view class="panel-header">
            <text class="panel-title">思维导图</text>
            <button class="expand-btn" bindtap="onExpandMindmap" wx:if="{{analysis.mindmap}}">
              <text>全屏查看</text>
            </button>
          </view>
          <view class="mindmap-content" wx:if="{{analysis.mindmap}}">
            <image
              class="mindmap-image"
              src="{{analysis.mindmap}}"
              mode="widthFix"
              bindtap="onPreviewMindmap"
            />
          </view>
          <view class="empty-panel" wx:else>
            <text class="empty-text">暂无思维导图</text>
          </view>
        </view>

        <!-- 字幕面板 -->
        <view class="content-panel" wx:if="{{activeTab === 'transcript'}}">
          <view class="panel-header">
            <text class="panel-title">字幕内容</text>
            <button class="copy-btn" bindtap="onCopyTranscript">
              <text>复制</text>
            </button>
          </view>
          <view class="transcript-content" wx:if="{{analysis.transcript}}">
            <view
              class="transcript-segment"
              wx:for="{{analysis.transcript.segments}}"
              wx:key="index"
              bindtap="onSeekToTime"
              data-time="{{item.start}}"
            >
              <text class="segment-time">{{item.start_time}}</text>
              <text class="segment-text">{{item.text}}</text>
            </view>
          </view>
          <view class="empty-panel" wx:else>
            <text class="empty-text">暂无字幕内容</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部留白 -->
    <view class="bottom-spacer"></view>
  </scroll-view>

  <!-- 底部操作栏 -->
  <view class="bottom-bar" wx:if="{{task && task.status === 'completed'}}">
    <view class="group-info" bindtap="onShowGroupPicker">
      <text class="group-icon">{{analysis.group_id ? '📁' : '📋'}}</text>
      <text class="group-name">{{analysis.group_name || '未分组'}}</text>
      <text class="group-arrow">›</text>
    </view>
    <button class="action-btn primary" bindtap="onShowGroupPicker">
      <text class="btn-text">{{analysis.group_id ? '切换分组' : '添加分组'}}</text>
    </button>
  </view>

  <!-- 分组选择面板 -->
  <view class="action-sheet" wx:if="{{showGroupSheet}}">
    <view class="sheet-backdrop" bindtap="onCloseGroupSheet"></view>
    <view class="sheet-content">
      <view class="sheet-header">
        <text class="sheet-title">选择分组</text>
      </view>
      <view class="group-list">
        <view
          class="group-item {{analysis.group_id === item.id ? 'active' : ''}}"
          wx:for="{{groups}}"
          wx:key="id"
          data-group-id="{{item.id}}"
          bindtap="onSelectGroup"
        >
          <text class="group-item-icon">📁</text>
          <text class="group-item-name">{{item.name}}</text>
          <text class="group-item-check" wx:if="{{analysis.group_id === item.id}}">✓</text>
        </view>
        <view
          class="group-item {{!analysis.group_id ? 'active' : ''}}"
          data-group-id="ungrouped"
          bindtap="onSelectGroup"
        >
          <text class="group-item-icon">📋</text>
          <text class="group-item-name">未分组</text>
          <text class="group-item-check" wx:if="{{!analysis.group_id}}">✓</text>
        </view>
      </view>
      <button class="sheet-cancel" bindtap="onCloseGroupSheet">取消</button>
    </view>
  </view>
</view>
```

- [ ] **Step 2: 更新 index.wxss**

```css
/* pages/analysis/detail/index.wxss - 分析详情页 */

.page-container {
  min-height: 100vh;
  background: #f8f9fc;
  display: flex;
  flex-direction: column;
}

/* 导航栏 */
.nav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #ffffff;
}

.nav-left,
.nav-right {
  width: 40px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}

/* 内容区 */
.content-area {
  flex: 1;
  padding: 0 16px;
}

/* 品牌头部 */
.brand-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 0;
}

.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1a1a2e 0%, #4a4a6a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: white;
}

.brand-info {
  display: flex;
  flex-direction: column;
}

.brand-name {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a2e;
}

.brand-slogan {
  font-size: 11px;
  color: #8b8b9e;
}

/* 视频卡片 */
.video-card-wrapper {
  margin-bottom: 16px;
  overflow: hidden;
}

.video-card {
  display: flex;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: transform 0.3s ease;
}

.video-card.swiped {
  transform: translateX(-120px);
}

.video-card .card-content {
  flex: 1;
  display: flex;
  gap: 12px;
  padding: 12px;
  min-width: 0;
}

.video-thumb {
  width: 80px;
  height: 54px;
  border-radius: 8px;
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.thumb-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.platform-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  padding: 2px 5px;
  background: #00A1D6;
  border-radius: 4px;
  font-size: 8px;
  color: white;
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
}

.play-btn {
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-icon {
  font-size: 12px;
  color: #7c3aed;
}

.video-info {
  flex: 1;
  min-width: 0;
}

.video-title {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 4px;
}

.video-meta {
  display: flex;
  align-items: center;
  font-size: 11px;
  color: #999;
}

.meta-author {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-dot {
  margin: 0 4px;
}

/* 左滑操作按钮 */
.swipe-actions {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  transform: translateX(100%);
  transition: transform 0.3s ease;
}

.video-card.swiped .swipe-actions {
  transform: translateX(0);
}

.swipe-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  font-size: 12px;
  color: #ffffff;
}

.swipe-btn.reanalysis {
  background: #3b82f6;
}

.swipe-btn.delete {
  background: #ef4444;
}

/* Tab 内容区 */
.tabs-section {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.tabs-header {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 13px;
  color: #666;
}

.tab-item.active {
  background: #7c3aed;
  color: #ffffff;
}

.tab-badge {
  background: rgba(255, 255, 255, 0.3);
  padding: 1px 5px;
  border-radius: 8px;
  font-size: 10px;
}

.tab-content {
  padding: 12px;
}

/* 面板通用 */
.content-panel {
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.copy-btn,
.expand-btn {
  padding: 4px 10px;
  background: #f8f9fc;
  border-radius: 6px;
  font-size: 11px;
  color: #999;
}

/* 摘要内容 */
.summary-content {
  background: #f8f9fc;
  border-radius: 10px;
  padding: 12px;
}

.summary-text {
  font-size: 13px;
  color: #666;
  line-height: 1.6;
}

/* 要点列表 */
.keypoints-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.keypoint-item {
  display: flex;
  gap: 10px;
  padding: 10px;
  background: #f8f9fc;
  border-radius: 10px;
}

.point-marker {
  width: 20px;
  height: 20px;
  background: #7c3aed;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: white;
  flex-shrink: 0;
}

.point-content {
  flex: 1;
}

.point-title {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 2px;
}

.point-time {
  font-size: 11px;
  color: #999;
}

/* 思维导图 */
.mindmap-content {
  display: flex;
  justify-content: center;
}

.mindmap-image {
  max-width: 100%;
  border-radius: 8px;
}

/* 字幕内容 */
.transcript-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.transcript-segment {
  display: flex;
  gap: 10px;
  padding: 8px;
  background: #f8f9fc;
  border-radius: 8px;
}

.segment-time {
  font-size: 11px;
  color: #999;
  flex-shrink: 0;
  min-width: 40px;
}

.segment-text {
  flex: 1;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}

/* 空状态 */
.empty-panel {
  padding: 30px;
  text-align: center;
}

.empty-text {
  font-size: 13px;
  color: #999;
}

/* 底部留白 */
.bottom-spacer {
  height: 100px;
}

/* 底部操作栏 */
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #ffffff;
  border-top: 1px solid #f0f0f5;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.group-icon {
  font-size: 14px;
}

.group-name {
  font-size: 13px;
  color: #666;
}

.group-arrow {
  font-size: 14px;
  color: #999;
}

.action-btn {
  padding: 8px 16px;
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 13px;
  color: #666;
}

.action-btn.primary {
  background: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a855f7 100%);
  color: #ffffff;
}

/* 分析进度 */
.processing-section {
  margin-bottom: 16px;
}

.processing-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.processing-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.processing-timer {
  font-size: 14px;
  color: #7c3aed;
}

.progress-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.progress-title {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
}

.progress-step {
  font-size: 12px;
  color: #7c3aed;
}

.progress-bar-wrap {
  margin-bottom: 14px;
}

.progress-bar {
  height: 6px;
  background: #f0f0f5;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #7c3aed, #a855f7);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-steps {
  display: flex;
  align-items: center;
}

.step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.step-dot {
  width: 24px;
  height: 24px;
  background: #f0f0f5;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #999;
}

.step-item.active .step-dot {
  background: #7c3aed;
  color: #ffffff;
}

.step-item.completed .step-dot {
  background: #22c55e;
  color: #ffffff;
}

.step-label {
  font-size: 10px;
  color: #999;
}

.step-line {
  flex: 1;
  height: 2px;
  background: #f0f0f5;
  margin: 0 4px;
  margin-bottom: 16px;
}

.step-line.completed {
  background: #22c55e;
}

/* 操作面板 */
.action-sheet {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.sheet-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}

.sheet-content {
  position: relative;
  background: #ffffff;
  border-radius: 20px 20px 0 0;
  padding-bottom: calc(34px + env(safe-area-inset-bottom, 0px));
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f5;
}

.sheet-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.group-list {
  padding: 8px 16px;
}

.group-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid #f5f5f5;
}

.group-item:last-child {
  border-bottom: none;
}

.group-item-icon {
  font-size: 18px;
}

.group-item-name {
  flex: 1;
  font-size: 15px;
  color: #1a1a2e;
}

.group-item-check {
  font-size: 16px;
  color: #7c3aed;
}

.sheet-cancel {
  margin: 8px 16px;
  padding: 14px;
  background: #f5f5f5;
  border-radius: 12px;
  font-size: 15px;
  color: #666;
  text-align: center;
}
```

- [ ] **Step 3: 添加左滑交互逻辑到 index.js**

在 `index.js` 中添加触摸事件处理：

```javascript
// 添加到 data
data: {
  // ... 现有数据
  swipeClass: '',
  touchStartX: 0,
  touchStartY: 0,
}

// 添加方法
onTouchStart: function(e) {
  this.setData({
    touchStartX: e.touches[0].clientX,
    touchStartY: e.touches[0].clientY
  });
},

onTouchMove: function(e) {
  // 可以在这里添加拖动效果
},

onTouchEnd: function(e) {
  const deltaX = e.changedTouches[0].clientX - this.data.touchStartX;
  const deltaY = e.changedTouches[0].clientY - this.data.touchStartY;

  // 横向滑动超过50px且纵向滑动小于20px时触发
  if (deltaX < -50 && Math.abs(deltaY) < 20) {
    this.setData({ swipeClass: 'swiped' });
  } else if (deltaX > 50) {
    this.setData({ swipeClass: '' });
  }
},
```

- [ ] **Step 4: 提交**

```bash
git add miniprogram/pages/analysis/detail/index.wxml miniprogram/pages/analysis/detail/index.wxss miniprogram/pages/analysis/detail/index.js
git commit -m "feat(detail): 重构详情页UI，实现Tab切换和左滑操作"
```

---

## Task 5: 我的页面重构

**Files:**
- Modify: `miniprogram/pages/profile/index.wxml` - 重构我的页结构
- Modify: `miniprogram/pages/profile/index.wxss` - 重构我的页样式

- [ ] **Step 1: 更新 index.wxml**

```xml
<!--pages/profile/index.wxml - 个人中心页-->
<view class="page-container">
  <!-- 顶部导航 -->
  <view class="nav-header">
    <text class="page-title">我的</text>
  </view>

  <!-- 内容区 -->
  <scroll-view class="content-area" scroll-y="true" enhanced="true" show-scrollbar="false">
    <!-- 用户信息卡片 -->
    <view class="user-card">
      <view class="user-main">
        <view class="avatar-wrap">
          <view class="avatar">O</view>
        </view>
        <view class="user-info">
          <text class="user-name">{{userInfo.nickName || '游客用户'}}</text>
        </view>
      </view>

      <!-- 用户统计 -->
      <view class="user-stats">
        <view class="stat-item">
          <text class="stat-num">{{userStats.analysisCount || 0}}</text>
          <text class="stat-label">分析次数</text>
        </view>
        <view class="stat-divider"></view>
        <view class="stat-item">
          <text class="stat-num">{{userStats.daysJoined || 0}}</text>
          <text class="stat-label">使用天数</text>
        </view>
      </view>
    </view>

    <!-- 关于与帮助 -->
    <view class="section-card">
      <view class="menu-list">
        <view class="menu-item" bindtap="onGoHelp">
          <view class="item-left">
            <view class="item-icon">?</view>
            <view class="item-info">
              <text class="item-title">使用帮助</text>
            </view>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>

        <view class="menu-item" bindtap="onGoAbout">
          <view class="item-left">
            <view class="item-icon">i</view>
            <view class="item-info">
              <text class="item-title">关于 Omni-Notes</text>
              <text class="item-desc">v{{appVersion}}</text>
            </view>
          </view>
          <view class="item-right">
            <text class="arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部留白 -->
    <view class="bottom-spacer"></view>
  </scroll-view>
</view>
```

- [ ] **Step 2: 更新 index.wxss**

```css
/* pages/profile/index.wxss - 个人中心页 */

.page-container {
  min-height: 100vh;
  background: #f8f9fc;
  display: flex;
  flex-direction: column;
}

/* 导航栏 */
.nav-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  background: #ffffff;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
}

/* 内容区 */
.content-area {
  flex: 1;
  padding: 16px;
}

/* 用户信息卡片 */
.user-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.user-main {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.avatar-wrap {
  flex-shrink: 0;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
  color: white;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
}

/* 用户统计 */
.user-stats {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-num {
  font-size: 24px;
  font-weight: 700;
  color: #7c3aed;
}

.stat-label {
  font-size: 12px;
  color: #8b8b9e;
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: rgba(0, 0, 0, 0.05);
}

/* 关于与帮助 */
.section-card {
  background: #ffffff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.menu-list {
  display: flex;
  flex-direction: column;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
}

.menu-item:active {
  background: #f5f6fa;
}

.menu-item:not(:last-child) {
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.item-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.item-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(124, 58, 237, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #7c3aed;
  font-weight: 600;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-title {
  font-size: 15px;
  font-weight: 500;
  color: #1a1a2e;
}

.item-desc {
  font-size: 12px;
  color: #8b8b9e;
}

.item-right {
  flex-shrink: 0;
}

.arrow {
  font-size: 18px;
  color: #c0c0d0;
}

/* 底部留白 */
.bottom-spacer {
  height: 20px;
}
```

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/profile/index.wxml miniprogram/pages/profile/index.wxss
git commit -m "feat(profile): 重构我的页面UI，遵循设计系统"
```

---

## 实施检查清单

- [ ] Task 1: 全局样式和 TabBar 配置
- [ ] Task 2: 首页重构
- [ ] Task 3: 历史页重构
- [ ] Task 4: 详情页重构
- [ ] Task 5: 我的页面重构

---

## 验收标准

1. **首页**: 一屏展示，无滚动，URL输入框聚焦效果正常
2. **历史页**: 分组筛选、分组管理、搜索功能完整
3. **详情页**: Tab切换正常，左滑显示操作按钮
4. **我的页面**: 用户信息、统计、菜单正常显示
5. **全局**: 设计系统变量统一，无样式冲突
