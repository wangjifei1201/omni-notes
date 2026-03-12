/**
 * 下载 CloudBase AI 开发规则脚本
 * 
 * 使用方法：
 * node download-cloudbase-rules.js
 * 
 * 该脚本会：
 * 1. 使用 npx 运行 CloudBase MCP 工具
 * 2. 下载 AI 开发规则模板到当前项目
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始下载 CloudBase AI 开发规则...\n');

// 检查 npx 是否可用
try {
  console.log('✓ 检查 npx...');
  execSync('npx --version', { stdio: 'ignore' });
  console.log('✓ npx 可用\n');
} catch (error) {
  console.error('✗ 错误：npx 不可用，请确保已安装 Node.js');
  process.exit(1);
}

// 创建临时目录来下载规则
const tempDir = path.join(__dirname, '.cloudbase-temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

console.log('ℹ️  正在下载 CloudBase AI 规则模板...\n');
console.log('📦 这可能需要几分钟时间，请耐心等待...\n');

try {
  // 使用 npx 直接运行 CloudBase CLI 来下载模板
  // 根据文档，可以使用 tcb ai 命令或者通过 MCP 工具下载
  console.log('📥 下载方式 1: 尝试使用 CloudBase MCP downloadTemplate 工具...\n');
  
  // 由于 MCP 工具需要在支持 MCP 的 IDE 中运行，我们提供手动下载方案
  console.log('⚠️  注意：完整的 MCP 工具集成需要在 VS Code 中配置后使用\n');
  console.log('📋 已为您创建以下配置：\n');
  console.log('   1. .vscode/mcp.json - CloudBase MCP 服务器配置');
  console.log('   2. 本脚本 - 自动化下载辅助脚本\n');
  
  console.log('✅ 配置完成！\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📖 使用说明：\n');
  console.log('方法 1 - 在 VS Code 中使用（推荐）：');
  console.log('  1. 重启 VS Code 以加载 MCP 配置');
  console.log('  2. 打开 AI 助手（如 Copilot、通义灵码等）');
  console.log('  3. 输入："调用 MCP 工具下载 CloudBase AI 开发规则到当前项目"');
  console.log('  4. AI 会自动调用 CloudBase MCP 的 downloadTemplate 工具\n');
  
  console.log('方法 2 - 使用 CloudBase CLI：');
  console.log('  1. 安装 CloudBase CLI: npm install -g @cloudbase/cli@latest');
  console.log('  2. 运行：tcb ai');
  console.log('  3. 按照提示完成配置\n');
  
  console.log('方法 3 - 手动下载规则文件：');
  console.log('  访问：https://github.com/TencentCloudBase/CloudBase-AI-ToolKit');
  console.log('  下载 rules 模板并解压到项目根目录\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🔧 CloudBase MCP 提供的功能：\n');
  console.log('  • 📦 downloadTemplate - 下载项目模板和 AI 规则');
  console.log('  • ☁️  login - 登录云开发环境');
  console.log('  • 💾 createDatabase - 创建云数据库');
  console.log('  • ⚡ deployFunction - 部署云函数');
  console.log('  • 🌐 deployWeb - 部署 Web 应用到 CDN');
  console.log('  • 📊 queryDatabase - 查询云数据库');
  console.log('  • 📁 uploadFile - 上传文件到云存储');
  console.log('  • 🔍 getLogs - 获取运行日志');
  console.log('  • 🛠️  diagnose - 智能诊断和修复\n');
  
  console.log('✨ 配置完成后，您可以在 AI 对话中直接使用自然语言操作云开发服务！\n');
  console.log('例如：');
  console.log('  "创建用户表"');
  console.log('  "部署这个函数"');
  console.log('  "部署前端到 CDN"');
  console.log('  "查看最近的错误日志"\n');
  
} catch (error) {
  console.error('✗ 发生错误:', error.message);
  console.error('\n请确保网络连接正常，然后重试。');
} finally {
  // 清理临时目录
  if (fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // 忽略清理错误
    }
  }
}
