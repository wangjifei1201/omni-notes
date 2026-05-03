# Omni-Notes 小程序设计系统（浅色主题）

## 设计理念

### 视觉方向
- **风格**: 浅色现代风 + 极简主义
- **情绪**: 清新、专业、可信赖
- **参考**: Apple (纯净留白)、Notion (简洁高效)、Linear (浅色模式)

### 核心特征
- 纯净白色背景，营造清爽感
- 柔和的阴影增加层次
- 紫色作为品牌强调色
- 充足的留白，呼吸感强

---

## 色彩系统

### 主色调
```css
--primary: 250 95% 60%;        /* 紫色 #7c3aed */
--primary-light: 250 95% 70%;  /* 亮紫 #a78bfa */
--primary-dark: 250 95% 50%;   /* 深紫 #5b21b6 */
```

### 辅助色
```css
--accent-cyan: 190 90% 60%;    /* 青色 #22d3ee */
--accent-pink: 330 80% 65%;    /* 粉色 #f472b6 */
```

### 背景色
```css
--bg-primary: 0 0% 100%;       /* 纯白 #ffffff */
--bg-secondary: 220 14% 96%;   /* 浅灰 #f3f4f6 */
--bg-tertiary: 220 13% 91%;    /* 中浅灰 #e5e7eb */
--bg-card: 0 0% 100%;          /* 卡片白 */
```

### 文字色
```css
--text-primary: 220 20% 15%;   /* 深灰 #1f2937 */
--text-secondary: 220 10% 45%; /* 中灰 #6b7280 */
--text-tertiary: 220 10% 60%;  /* 浅灰 #9ca3af */
```

### 功能色
```css
--success: 160 70% 45%;        /* 成功绿 #16a34a */
--warning: 38 90% 55%;         /* 警告黄 #f59e0b */
--error: 0 75% 55%;            /* 错误红 #ef4444 */
```

### 边框色
```css
--border-light: 220 13% 90%;   /* 浅边框 #e5e7eb */
--border-medium: 220 13% 85%;  /* 中边框 #d1d5db */
```

---

## 渐变定义

### 主渐变
```css
--gradient-primary: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%);
--gradient-hero: linear-gradient(135deg, #7c3aed 0%, #22d3ee 100%);
```

### 背景渐变
```css
--gradient-bg: linear-gradient(180deg, #ffffff 0%, #f9fafb 100%);
```

### 柔和阴影
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.025);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02);
```

---

## 字体系统

### 字体族
- **主字体**: system-ui, -apple-system, "Segoe UI", sans-serif
- **数字/代码**: "SF Mono", "Monaco", monospace

### 字号规范
| 层级 | 大小 | 字重 | 行高 | 用途 |
|------|------|------|------|------|
| H1 | 28px | 700 | 1.2 | 页面标题 |
| H2 | 22px | 600 | 1.3 | 卡片标题 |
| H3 | 18px | 600 | 1.4 | 区块标题 |
| Body | 16px | 400 | 1.5 | 正文 |
| Small | 14px | 400 | 1.5 | 次要文字 |
| Caption | 12px | 500 | 1.4 | 标签/时间 |

---

## 间距系统

### 基础单位: 4px

| Token | 值 | 用途 |
|-------|-----|------|
| xs | 4px | 图标间距 |
| sm | 8px | 紧凑间距 |
| md | 16px | 标准间距 |
| lg | 24px | 区块间距 |
| xl | 32px | 大区块间距 |
| 2xl | 48px | 页面边距 |

### 圆角规范
| Token | 值 | 用途 |
|-------|-----|------|
| sm | 8px | 小按钮、标签 |
| md | 12px | 输入框、小卡片 |
| lg | 16px | 卡片、按钮 |
| xl | 24px | 大卡片、模态框 |
| full | 9999px | 圆形元素 |

---

## 阴影系统

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
--shadow-glow: 0 0 40px rgba(124, 58, 237, 0.15);
```

---

## 动效系统

### 缓动函数
```css
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
```

### 时长规范
| 类型 | 时长 | 用途 |
|------|------|------|
| instant | 100ms | 微交互 |
| fast | 200ms | 按钮反馈 |
| normal | 300ms | 状态切换 |
| slow | 500ms | 页面过渡 |

---

## 组件规范

### 按钮

#### 主按钮 (Primary)
- 背景: gradient-primary
- 文字: 白色, 16px, 600 weight
- 圆角: 16px
- 高度: 52px
- 阴影: shadow-md
- 点击: scale(0.97)

#### 次级按钮 (Secondary)
- 背景: bg-secondary
- 文字: text-primary
- 圆角: 12px
- 高度: 44px
- 边框: 1px solid border-light

#### 图标按钮
- 尺寸: 44px × 44px
- 圆角: full
- 背景: bg-secondary

### 卡片

#### 主卡片
- 背景: white
- 边框: 1px solid border-light
- 圆角: 20px
- 内边距: 20px
- 阴影: shadow-md

#### 紧凑卡片
- 背景: bg-secondary
- 圆角: 16px
- 内边距: 16px

### 输入框

#### 标准输入
- 背景: bg-secondary
- 边框: 1px solid border-light
- 圆角: 12px
- 高度: 52px
- 内边距: 16px
- 聚焦: border-color primary, shadow-glow

---

## 页面布局

### 安全区域
- 顶部: 状态栏高度 + 44px
- 底部: 底部导航高度 + safe-area-inset-bottom
- 水平: 20px

### 页面结构
```
[状态栏]
[导航栏] 44px
[内容区] flex: 1
[底部导航] 83px + safe-area
```

---

## 图标系统

使用 Lucide 图标风格:
- 线框风格
- 2px 描边
- 24px 标准尺寸
- 圆角端点

主要图标:
- Home / 分析: `sparkles` 或 `wand-2`
- 历史: `clock` 或 `history`
- 我的: `user` 或 `settings`
- 链接: `link`
- 粘贴: `clipboard`
- 播放: `play`
- 删除: `trash-2`
- 完成: `check-circle`
- 错误: `x-circle`
