# Omni-Notes 小程序设计系统

## 设计理念

### 视觉方向
- **风格**: 简洁大气、留白充足、现代专业
- **情绪**: 干净、效率、可信赖
- **参考**: Apple (极简留白)、Linear (效率工具)、Notion (清晰结构)

### 核心特征
- 纯净白色背景 + 浅灰 (#f8f9fc) 卡片层次
- 深色品牌 LOGO (深蓝渐变 #1a1a2e → #4a4a6a) + 紫色渐变按钮形成视觉对比
- 固定底部按钮，避免遮挡 TabBar
- 2x2 网格功能卡片，清晰展示能力

---

## 色彩系统

### 主色调
```css
--primary: #7c3aed;           /* 主色：紫色 */
--primary-light: #a855f7;     /* 亮紫 */
--primary-dark: #5b21b6;      /* 深紫 */
```

### 辅助色
```css
--accent-cyan: #00d4ff;       /* 青色 */
--accent-pink: #f472b6;      /* 粉色 */
```

### 背景色
```css
--bg-primary: #ffffff;        /* 主背景：纯白 */
--bg-secondary: #f8f9fc;      /* 卡片/输入框背景：浅灰 */
--bg-tertiary: #f0f1f5;       /* 按压反馈：稍深灰 */
--bg-card: #ffffff;           /* 卡片白色 */
```

### 文字色
```css
--text-primary: #1a1a2e;      /* 深色标题：深蓝黑 */
--text-secondary: #6b6b7e;    /* 次要文字：中性灰 */
--text-tertiary: #8b8b9e;    /* 辅助文字：浅灰 */
--text-hint: #a0a0b0;         /* 占位符提示色 */
```

### 功能色
```css
--success: #22c55e;           /* 成功绿 */
--warning: #f59e0b;          /* 警告黄 */
--error: #ef4444;             /* 错误红 */
```

### 边框色
```css
--border-color: rgba(0,0,0,0.08);           /* 浅边框 */
--border-color-hover: rgba(124,58,237,0.3); /* 聚焦边框 */
```

---

## 渐变定义

### 主渐变
```css
--gradient-primary: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a855f7 100%);
--gradient-logo: linear-gradient(135deg, #1a1a2e 0%, #4a4a6a 100%);
```

### 柔和阴影
```css
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.1);
--shadow-glow: 0 4px 20px rgba(124, 58, 237, 0.15);
```

---

## 字体系统

### 字号规范
| 层级 | 大小 | 字重 | 用途 |
|------|------|------|------|
| H1 (页面大标题) | 28px | 700 | 首页主标题 |
| H2 (卡片标题) | 18px | 700 | 区块标题 |
| H3 (小标题) | 15px | 600 | 菜单项标题 |
| Body | 14px | 400 | 正文 |
| Small | 13px | 400 | 次要文字 |
| Caption | 11-12px | 400-500 | 标签/时间 |

---

## 间距系统

### 基础单位: 4px

| Token | 值 | 用途 |
|-------|-----|------|
| xs | 4px | 图标间距 |
| sm | 8px | 紧凑间距 |
| md | 12-16px | 标准间距 |
| lg | 24px | 区块间距 |
| xl | 32px | 页面边距 |

### 圆角规范
| Token | 值 | 用途 |
|-------|-----|------|
| sm | 8px | 小按钮、标签 |
| md | 12-14px | 输入框、小卡片 |
| lg | 16px | 主卡片 |
| xl | 20px | 大卡片、模态框 |
| full | 50%+ | 圆形元素 |

---

## 组件规范

### 按钮

#### 主按钮 (Primary) - 固定底部
- 背景: linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a855f7 100%)
- 文字: 白色, 16px, 600 weight
- 圆角: 12px
- 高度: 48px
- 阴影: 0 4px 14px rgba(124, 58, 237, 0.35)
- 位置: 固定在底部，距 TabBar 60px + safe-area

#### 次级按钮
- 背景: #f8f9fc
- 文字: #6b6b7e
- 圆角: 14px
- 高度: 48px

### 卡片

#### 功能卡片 (2x2 网格)
- 背景: #f8f9fc
- 圆角: 14px
- 内边距: 14-16px
- 布局: flex + gap:12px，图标在左，内容在右

#### Section 卡片
- 背景: #ffffff
- 圆角: 16px
- 内边距: 16px
- 阴影: 0 2px 8px rgba(0,0,0,0.04)

### 输入框

#### URL 输入框
- 背景: #f8f9fc
- 圆角: 16px
- 内边距: 6px 6px 6px 16px (左侧图标区域更大)
- 聚焦: 白色背景 + #7c3aed 边框 + 4px 阴影

### TabBar

- 高度: 60px
- 背景: #ffffff
- 边框: 1px solid #f0f0f5
- 图标颜色: #8b8b9e (未激活) / #7c3aed (激活)
- 标签字号: 10px

---

## 页面结构

### 安全区域
- 顶部: 状态栏高度 + 44px (导航栏)
- 底部: TabBar 高度 60px + safe-area-inset-bottom
- 水平: 16-24px

### 页面结构
```
[状态栏] 44px (刘海屏)
[导航栏] 44px (固定顶部)
[内容区] flex: 1 (可滚动)
[TabBar] 60px (固定底部)
```

---

## 图标系统

使用简洁的字母/符号作为图标:
- 首页/分析: ◈
- 分组: ◉
- 历史: ◊
- 我的: ◯
- 收藏: ☆/★
- 分享: ◉
- 复制: ◉
- 返回: ‹
- 设置: ◈
- 播放: ▶
- 加号: +

---

## 页面清单

| 序号 | 页面 | 路径 | 说明 |
|------|------|------|------|
| 01 | 首页 | pages/index/index | 视频链接输入 + 能力展示 |
| 02 | 分析页 | pages/index/index | 入口页，带分析选项 |
| 03 | 历史页 | pages/history/index | 分析历史记录列表 |
| 04 | 分组页 | pages/groups/index | 视频分组管理 |
| 05 | 详情页 | pages/analysis/detail/index | 分析结果详情 |
| 06 | 个人中心 | pages/profile/index | 用户信息 + 设置 |