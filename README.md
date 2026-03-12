# 视频AI速记 - B站视频智能分析助手

📝 一款基于AI的B站视频内容分析工具，支持语音转文字、智能摘要、章节划分、思维导图生成、多语言翻译等功能。

## ✨ 功能特性

### 核心功能
- **🎬 视频解析**：支持B站视频链接，自动提取视频信息
- **📝 语音转文字**：使用OpenAI Whisper模型，支持中文语音识别
- **🤖 AI智能摘要**：基于通义千问/ChatGPT等大模型生成内容摘要
- **📑 章节速览**：AI自动划分视频章节，标注时间节点
- **🧠 思维导图**：生成视频知识结构图
- **💬 智能问答**：基于视频内容进行问答对话
- **🌐 多语言翻译**：一键翻译全部内容为英文、日文、韩文等多种语言
- **📁 分组管理**：拖拽式任务分组，支持自定义分组
- **💾 多格式导出**：支持Markdown、文本、JSON格式导出

### 支持的AI提供商
- 阿里云百炼（通义千问）- 默认
- OpenAI（GPT-4/GPT-3.5）
- 自定义OpenAI兼容API

### 语音模型支持
- tiny（39M）- 最快，准确度一般
- base（74M）- 推荐，平衡速度和准确度 ✅
- small（244M）- 更准但更慢
- medium（769M）- 最准但最慢

## 🚀 快速开始

### 环境要求
- Node.js 16+
- Python 3.8+
- ffmpeg（用于音频处理）

### 安装依赖

```bash
# 进入项目目录
cd bilibili-summarizer

# 安装Node依赖
npm install

# 安装Python依赖
pip3 install yt-dlp openai-whisper
```

### 配置AI API

1. 访问 http://localhost:5001
2. 点击「⚙️ 设置」
3. 配置AI API Key：
   - 阿里云百炼：填写DashScope API Key
   - OpenAI：填写OpenAI API Key
4. 点击「保存设置」

### 启动服务

```bash
npm start
```

服务默认运行在 http://localhost:5001

## 📖 使用指南

### 分析视频

1. **打开浏览器**：访问 http://localhost:5001
2. **粘贴视频链接**：输入B站视频URL
   - 示例：`https://www.bilibili.com/video/BV1xx411c7mD`
3. **选择选项**：
   - ☑️ 无字幕时使用语音转文字
4. **点击「开始分析」**
5. **等待分析完成**：约需3-5分钟（取决于视频时长）
6. **查看结果**：
   - 📝 AI摘要
   - ⭐ 核心要点
   - 📑 章节速览
   - 🧠 思维导图
   - 📄 完整字幕
   - 💬 智能问答

### 翻译内容

分析完成后，点击视频标题栏的「🌐 翻译」按钮：

1. 选择目标语言（英语、日语、韩语等8种语言）
2. 等待翻译完成
3. 查看对照翻译：
   - 原文正常显示
   - 译文以小号字体显示在下方
4. 点击「✕ 清除翻译」恢复原文

### 分组管理

1. **创建分组**：点击侧边栏「+ 新建」按钮
2. **拖拽分组**：将历史记录拖拽到分组中
3. **编辑分组**：点击分组旁的✏️按钮修改名称
4. **删除分组**：点击🗑️按钮删除分组

### 重新生成

对分析结果不满意？点击「🔄 重新生成」按钮：
- 重新调用AI分析全部内容
- 保留原有分组信息
- 更新历史记录

### 导出笔记

分析完成后，点击「💾 导出」标签页，选择格式：
- **Markdown**：完整笔记，含标题、摘要、要点、章节、字幕
- **文本**：纯文本格式
- **JSON**：结构化数据

## 🔧 技术架构

```
┌─────────────────────────────────────────────────────────┐
│  前端 (HTML + CSS + JavaScript)                          │
│  - 视频输入界面                                          │
│  - 结果展示（6个标签页）                                  │
│  - 设置页面                                              │
│  - 分组管理                                              │
│  - 翻译功能                                              │
├─────────────────────────────────────────────────────────┤
│  后端 (Node.js + Express)                                │
│  - /api/analyze - 视频分析接口                           │
│  - /api/ask - 问答接口                                   │
│  - /api/config - 配置管理                                │
│  - /api/translate-all - 翻译接口                         │
│  - /api/regenerate-all - 重新生成接口                     │
│  - /api/whisper-models - 模型检测                        │
├─────────────────────────────────────────────────────────┤
│  数据存储 (IndexedDB)                                    │
│  - 历史记录                                              │
│  - 分组信息                                              │
│  - 翻译缓存                                              │
├─────────────────────────────────────────────────────────┤
│  外部服务                                                │
│  - B站API - 获取视频信息和字幕                            │
│  - yt-dlp - 下载视频音频                                 │
│  - Whisper - 语音转文字                                  │
│  - 通义千问/OpenAI - AI内容分析                           │
└─────────────────────────────────────────────────────────┘
```

## 📁 项目结构

```
bilibili-summarizer/
├── server.js              # 后端服务主文件
├── index.html             # 前端界面
├── whisper_stream.py      # Whisper流式转录脚本
├── package.json           # 项目配置
├── README.md              # 项目说明
├── config.json            # API配置文件（自动生成）
├── config.example.json    # 配置模板（参考用）
├── data/                  # 数据目录
│   └── *.mp3              # 视频音频缓存
└── node_modules/          # Node依赖
```

## ⚙️ 配置说明

### 配置文件

项目根目录包含两个配置文件：

- **`config.json`** - 实际配置文件（由系统自动生成）
- **`config.example.json`** - 配置模板（参考用）

### 快速配置

1. 复制配置模板：
   ```bash
   cp config.example.json config.json
   ```

2. 编辑 `config.json`，填入你的 API Key：
   ```json
   {
     "aiProvider": "bailian",
     "apiKey": "your-api-key-here",
     "baseURL": "https://coding.dashscope.aliyuncs.com/v1",
     "model": "qwen3.5-plus",
     "useWhisper": true,
     "whisperModel": "base",
     "biliCookie": ""
   }
   ```

### 配置项说明

| 字段 | 说明 | 示例 |
|------|------|------|
| `aiProvider` | AI提供商 | `bailian` 或 `openai` |
| `apiKey` | API密钥 | `sk-xxxxx` |
| `baseURL` | API地址 | `https://coding.dashscope.aliyuncs.com/v1` |
| `model` | 模型名称 | `qwen3.5-plus` |
| `useWhisper` | 启用语音转文字 | `true` 或 `false` |
| `whisperModel` | Whisper模型 | `tiny`/`base`/`small`/`medium` |
| `biliCookie` | B站Cookie（可选） | `SESSDATA=xxx;...` |

## 🎯 模型文件

Whisper模型文件自动下载到 `~/.cache/whisper/`：
- base.pt (74MB) - 多语言模型 ✅ 推荐
- base.en.pt (39MB) - 英文模型
- small.pt (244MB)
- medium.pt (769MB)
- tiny.pt (39MB)

## 🐛 常见问题

### Q: 提示"语音转文字失败"
A: 检查是否已安装yt-dlp和whisper：
```bash
pip3 install yt-dlp openai-whisper
```

### Q: 模型下载失败
A: 手动下载模型文件到 `~/.cache/whisper/` 目录

### Q: 服务端口变化
A: 端口已固定为5001，访问 http://localhost:5001

### Q: 配置后仍显示设置界面
A: 刷新页面，已配置会自动进入主界面

### Q: 下载视频时提示412错误
A: 在设置中配置B站Cookie：
1. 浏览器登录B站
2. F12打开开发者工具，Console输入 `document.cookie`
3. 复制Cookie到设置页面的「B站Cookie」字段

### Q: 分组信息丢失
A: 分组信息保存在浏览器IndexedDB中，清除浏览器数据会导致丢失

## 📝 更新日志

### v1.1.0 (2026-03-12)
- ✅ 新增多语言翻译功能（8种语言）
- ✅ 新增分组管理功能（拖拽分组）
- ✅ 新增重新生成功能
- ✅ 优化语音转文字实时进度显示
- ✅ 优化AI分析分步骤执行
- ✅ 数据持久化（IndexedDB）

### v1.0.0 (2026-03-11)
- ✅ 基础功能完成
- ✅ 支持CC字幕提取
- ✅ 支持语音转文字
- ✅ AI摘要生成
- ✅ 章节划分
- ✅ 思维导图
- ✅ 智能问答
- ✅ 多格式导出

## 📄 License

MIT License

## 🙏 致谢

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - 视频下载
- [OpenAI Whisper](https://github.com/openai/whisper) - 语音识别
- [通义千问](https://tongyi.aliyun.com/) - AI大模型
