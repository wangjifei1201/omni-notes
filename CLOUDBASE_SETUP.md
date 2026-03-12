# CloudBase AI Toolkit 配置指南

## ✅ 已完成的配置

### 1. CloudBase MCP 配置
已在 `.vscode/mcp.json` 中配置 CloudBase MCP 服务器：

```json
{
  "mcpServers": {
    "cloudbase": {
      "command": "npx",
      "args": ["@cloudbase/cloudbase-mcp@latest"],
      "env": {
        "INTEGRATION_IDE": "VSCode"
      }
    }
  }
}
```

### 2. 自动化脚本
- `download-cloudbase-rules.js` - CloudBase AI 规则下载辅助脚本

---

## 🚀 使用方法

### 方法 1：在 VS Code 中使用 AI 助手（推荐）⭐

**步骤：**

1. **重启 VS Code**
   ```bash
   # 完全关闭并重新打开 VS Code
   ```

2. **确认 MCP 配置已加载**
   - 打开 VS Code
   - 检查 `.vscode/mcp.json` 文件是否存在
   - VS Code 会自动识别并加载 MCP 配置

3. **使用 AI 助手下载规则**
   
   在 AI 对话中输入：
   ```
   调用 MCP 工具下载 CloudBase AI 开发规则到当前项目
   ```
   
   AI 会自动：
   - 调用 CloudBase MCP 的 `downloadTemplate` 工具
   - 下载 AI 规则模板到当前项目
   - 配置各种 AI 编辑器的规则文件

4. **开始使用云开发**
   
   下载规则后，你可以对 AI 说：
   - "登录云开发"
   - "创建用户表"
   - "部署这个函数"
   - "部署前端到 CDN"
   - "查看最近的错误日志"

---

### 方法 2：使用 CloudBase CLI

**步骤：**

1. **安装 CloudBase CLI**
   ```bash
   npm install -g @cloudbase/cli@latest
   ```

2. **初始化配置**
   ```bash
   tcb ai
   ```
   
   配置向导会引导你完成：
   - 云开发环境选择
   - AI 工具配置
   - MCP 设置

3. **使用 AI 模式**
   ```bash
   tcb ai
   ```
   
   然后在交互式对话框中：
   ```
   下载 CloudBase AI 开发规则到当前项目
   ```

---

### 方法 3：手动下载规则文件

**步骤：**

1. **访问 GitHub 仓库**
   - 打开：https://github.com/TencentCloudBase/CloudBase-AI-ToolKit
   - 或 CNB：https://cnb.cool/tencent/cloud/cloudbase/CloudBase-AI-ToolKit

2. **下载 rules 模板**
   - 找到 `rules` 目录
   - 下载所有规则文件

3. **解压到项目根目录**
   ```bash
   # 将下载的规则文件解压到 bilibili-summarizer 目录
   ```

---

## 🔧 CloudBase MCP 功能列表

配置完成后，CloudBase MCP 提供以下工具：

| 工具 | 功能 | 示例 |
|------|------|------|
| 📦 downloadTemplate | 下载项目模板和 AI 规则 | "下载 AI 开发规则" |
| ☁️ login | 登录云开发环境 | "登录云开发" |
| 💾 createDatabase | 创建云数据库 | "创建用户表" |
| ⚡ deployFunction | 部署云函数 | "部署这个函数" |
| 🌐 deployWeb | 部署 Web 应用到 CDN | "部署前端到 CDN" |
| 📊 queryDatabase | 查询云数据库 | "查询所有用户" |
| 📁 uploadFile | 上传文件到云存储 | "上传这个文件" |
| 🔍 getLogs | 获取运行日志 | "查看最近的错误" |
| 🛠️ diagnose | 智能诊断和修复 | "诊断这个问题" |

---

## 📋 支持的 AI 编辑器

CloudBase AI 规则支持以下编辑器：

- ✅ **Cursor** - 独立 AI IDE
- ✅ **WindSurf** - Codeium AI 编辑器
- ✅ **CodeBuddy** - 腾讯 AI 编程助手
- ✅ **VS Code + GitHub Copilot**
- ✅ **通义灵码** - 阿里 AI 编程工具
- ✅ **文心快码** - 百度 AI 编程助手
- ✅ **Trae** - 专业 AI 开发平台
- ✅ **RooCode** - 轻量级 AI 工具
- ✅ **Augment Code** - 高级 AI 代码助手
- ✅ **CLINE** - VS Code AI 助手

---

## 🎯 快速验证配置

运行以下命令验证配置：

```bash
# 1. 检查 npx 是否可用
npx --version

# 2. 检查 Node.js 版本
node --version

# 3. 运行检测脚本
node download-cloudbase-rules.js
```

---

## ❓ 常见问题

### Q: MCP 连接失败？
**A:** 
- 检查 `.vscode/mcp.json` 配置格式是否正确
- 重启 VS Code
- 确认网络连接正常
- 检查防火墙设置

### Q: 工具数量显示为 0？
**A:**
- 确保已正确配置 MCP 服务器
- 等待 MCP 工具初始化完成（可能需要几秒钟）
- 查看 VS Code 输出面板的 MCP 日志

### Q: 如何切换云开发环境？
**A:**
- 对 AI 说："退出云开发"
- 然后说："登录云开发"
- 选择新的环境

### Q: 配置文件在哪里？
**A:**
- MCP 配置：`.vscode/mcp.json`
- AI 规则：下载后会出现在项目根目录的 `rules/`、`cursor/`、`comate/` 等目录

---

## 📚 相关资源

- 📖 **官方文档**: https://docs.cloudbase.net/ai/cloudbase-ai-toolkit/
- 🌟 **GitHub 仓库**: https://github.com/TencentCloudBase/CloudBase-AI-ToolKit
- 💬 **技术交流群**: 扫码加入微信技术交流群
- 🎯 **项目模板**: https://docs.cloudbase.net/ai/cloudbase-ai-toolkit/templates/
- 📋 **开发指南**: https://docs.cloudbase.net/ai/cloudbase-ai-toolkit/guide/

---

## 🎉 下一步

配置完成后，你可以：

1. **重启 VS Code**
2. **打开 AI 助手**（如 Copilot、通义灵码等）
3. **输入指令**："调用 MCP 工具下载 CloudBase AI 开发规则到当前项目"
4. **开始云开发之旅**！

祝你开发愉快！🚀
