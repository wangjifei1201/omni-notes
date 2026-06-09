# 分析详情页面问题修复总结

## 修复的问题

### 问题1：只展示摘要和思维导图
**症状**：分析详情页面只显示摘要和思维导图，缺少核心要点、章节、完整分析等内容

**原因**：
- 后端返回的数据结构是嵌套的（`result.result` 包含实际分析结果）
- 只处理了 `keypoints` 和 `mindmap`，忽略了 `key_points`、`chapters`、`analysis` 等字段

**修复**：
```javascript
// 正确处理后端返回的对象数据
const analysisResult = result.result || {};

// 处理核心要点
let keypoints = [];
if (analysisResult.key_points && Array.isArray(analysisResult.key_points)) {
  keypoints = analysisResult.key_points.map(item => {
    if (typeof item === 'string') return item;
    return item.text || item.content || item.title || item.point || JSON.stringify(item);
  });
}

// 处理章节
let chapters = [];
if (analysisResult.chapters && Array.isArray(analysisResult.chapters)) {
  chapters = analysisResult.chapters.map(chapter => {
    if (typeof chapter === 'string') return chapter;
    return chapter.title || chapter.name || chapter.chapter || JSON.stringify(chapter);
  });
}

// 处理完整分析
let fullAnalysis = analysisResult.analysis || analysisResult.full_analysis || '';
```

### 问题2：思维导图显示为[objects]
**症状**：思维导图中显示 `[object Object]` 或 JSON 格式的字符串

**原因**：
- 后端返回的 `mindmap` 是嵌套对象，不是字符串
- 直接显示对象会调用 `toString()` 方法，显示 `[object Object]`

**修复**：
```javascript
// 格式化思维导图为可读文本
formatMindmap(mindmapObj) {
  if (!mindmapObj) return '';
  
  if (typeof mindmapObj === 'object') {
    let result = '';
    
    // 根据数据结构选择不同的解析方式
    if (mindmapObj.root) {
      result = this.formatMindmapNode(mindmapObj.root, 0);
    } else if (mindmapObj.nodes) {
      result = mindmapObj.nodes.map(node => this.formatMindmapNode(node, 0)).join('\n');
    } else if (mindmapObj.children) {
      result = this.formatMindmapNode(mindmapObj, 0);
    } else {
      result = JSON.stringify(mindmapObj, null, 2);
    }
    
    return result;
  }
  
  return String(mindmapObj);
}

// 递归格式化节点
formatMindmapNode(node, level) {
  const indent = '  '.repeat(level);
  let result = '';
  
  // 提取节点文本
  const text = node.text || node.title || node.name || node.topic || '节点';
  result += `${indent}${level === 0 ? '📍' : '├─'} ${text}\n`;
  
  // 递归处理子节点
  const children = node.children || node.nodes || node.branches;
  if (children && Array.isArray(children)) {
    children.forEach(child => {
      result += this.formatMindmapNode(child, level + 1);
    });
  }
  
  return result;
}
```

### 问题3：状态显示不一致
**症状**：上面显示"已完成"，下面还显示"等待处理中..."

**原因**：
- WXML 条件判断有误，`wx:if` 条件不互斥
- 处理中状态的条件 `{{!result || ...}}` 在任务完成时也满足

**修复**：
```xml
<!-- 结果内容（只在完成状态显示） -->
<view class="result-section" wx:if="{{result && result.status === 'completed'}}">
  <!-- 摘要、核心要点、章节、思维导图、完整分析 -->
</view>

<!-- 处理中状态（只在非完成/失败状态显示） -->
<view class="processing-state" wx:if="{{result && result.status !== 'completed' && result.status !== 'failed' && result.status !== 'error'}}">
  <view class="processing-text">{{currentMessage}}</view>
</view>

<!-- 失败状态 -->
<view class="failed-state" wx:if="{{result && (result.status === 'failed' || result.status === 'error')}}">
  <view class="failed-text">分析失败</view>
</view>
```

## 关键改动

### 文件：`pages/analysis/detail/index.js`

1. **数据初始化**：添加 `chapters: []` 字段
2. **loadTaskDetails()**：
   - 正确处理 `key_points` 对象数组
   - 添加 `formatMindmap()` 和 `formatMindmapNode()` 方法
   - 处理 `chapters` 对象数组
   - 处理 `analysis` 和 `full_analysis` 字段
3. **onCopyResult()**：添加对 `chapters` 字段的复制支持

### 文件：`pages/analysis/detail/index.wxml`

1. **添加章节显示区域**：
```xml
<view class="result-card" wx:if="{{chapters.length > 0}}">
  <view class="result-title">📑 章节结构</view>
  <view class="chapters-list">
    <view class="chapter-item" wx:for="{{chapters}}" wx:key="index">
      <view class="chapter-number">{{index + 1}}</view>
      <view class="chapter-text">{{item}}</view>
    </view>
  </view>
</view>
```

2. **修复状态显示条件**：
   - 完成状态：`wx:if="{{result && result.status === 'completed'}}"`
   - 处理中状态：`wx:if="{{result && result.status !== 'completed' && result.status !== 'failed' && result.status !== 'error'}}"`
   - 失败状态：`wx:if="{{result && (result.status === 'failed' || result.status === 'error')}}"`

### 文件：`pages/analysis/detail/index.wxss`

添加章节样式：
```css
.chapters-list {
  margin-bottom: 16px;
}

.chapter-item {
  display: flex;
  align-items: flex-start;
  margin-bottom: 12px;
  padding: 8px 0;
}

.chapter-number {
  width: 24px;
  height: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  margin-right: 12px;
}

.chapter-text {
  font-size: 14px;
  color: #374151;
  line-height: 1.6;
  flex: 1;
}
```

## 测试验证

### 测试步骤：
1. 提交一个视频分析任务
2. 等待任务完成
3. 进入分析详情页
4. 验证以下内容：
   - ✅ 显示摘要
   - ✅ 显示核心要点（列表形式）
   - ✅ 显示章节结构（带序号）
   - ✅ 显示思维导图（树形文本）
   - ✅ 显示完整分析
   - ✅ 状态显示正确（不会同时显示多个状态）
   - ✅ 可以复制各部分内容

### 数据结构示例：

**后端返回的数据结构**：
```json
{
  "task_id": "xxx",
  "status": "completed",
  "result": {
    "summary": "视频摘要内容...",
    "key_points": [
      {"text": "要点1", "timestamp": "00:01:23"},
      {"text": "要点2", "timestamp": "00:02:34"}
    ],
    "chapters": [
      {"title": "章节1", "start_time": "00:00:00"},
      {"title": "章节2", "start_time": "00:05:00"}
    ],
    "mindmap": {
      "root": {
        "text": "主题",
        "children": [
          {"text": "子主题1", "children": [...]},
          {"text": "子主题2", "children": [...]}
        ]
      }
    },
    "analysis": "完整分析内容..."
  }
}
```

**前端处理后显示**：
```
📝 摘要
视频摘要内容...

⭐ 核心要点
• 要点1
• 要点2

📑 章节结构
1. 章节1
2. 章节2

🧠 思维导图
📍 主题
  ├─ 子主题1
  │   ├─ 子子主题1
  │   └─ 子子主题2
  └─ 子主题2

📊 完整分析
完整分析内容...
```

## 注意事项

1. **后端数据结构可能变化**：如果后端返回的数据结构有变化，需要相应调整格式化逻辑
2. **性能考虑**：对于大型思维导图，递归格式化可能会影响性能
3. **错误处理**：如果格式化失败，会 fallback 到 JSON.stringify() 显示

所有问题已修复，请重新编译测试！