# 项目介绍

简要描述这个项目是做什么的。

## 技术栈

- 前端：React/Vue/Angular
- 后端：Node.js/Python/Go
- 数据库：PostgreSQL/MySQL/MongoDB

## 常用命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 测试
npm run test
```

## 项目结构

```
src/
├── components/    # UI 组件
├── pages/         # 页面
├── utils/         # 工具函数
└── ...
```

## gstack

所有网页浏览都应使用 gstack 的 `/browse` 技能，切勿使用 `mcp__claude-in-chrome__*` 工具。

### 可用技能

- `/office-hours` - 办公时间管理和协调
- `/plan-ceo-review` - CEO 审查计划
- `/plan-eng-review` - 工程审查计划
- `/plan-design-review` - 设计审查计划
- `/design-consultation` - 设计咨询
- `/review` - 代码审查
- `/ship` - 发布代码
- `/land-and-deploy` - 部署和上线
- `/canary` - 金丝雀发布
- `/benchmark` - 性能基准测试
- `/browse` - 网页浏览和测试（用于替代 mcp__claude-in-chrome__* 工具）
- `/qa` - 质量测试
- `/qa-only` - 仅 QA 测试
- `/design-review` - 设计审查
- `/setup-browser-cookies` - 设置浏览器 cookies
- `/setup-deploy` - 设置部署
- `/retro` - 项目回顾
- `/investigate` - 问题调查
- `/document-release` - 发布文档
- `/codex` - Codex 集成
- `/cso` - CSO 相关
- `/autoplan` - 自动计划
- `/careful` - 谨慎模式
- `/freeze` - 冻结代码
- `/guard` - 守卫模式
- `/unfreeze` - 解冻代码
- `/gstack-upgrade` - 升级 gstack

---

## Spec-Kit

### 完整工作流

```
/speckit.specify "功能描述" → /speckit.plan → /speckit.tasks → /speckit.implement
```

### 可用命令

| 命令 | 说明 |
|------|------|
| `/speckit.specify "描述"` | 创建功能规格说明 |
| `/speckit.clarify` | 澄清规格疑问 |
| `/speckit.plan` | 生成技术计划 |
| `/speckit.tasks` | 生成任务列表 |
| `/speckit.implement` | 执行任务 |
| `/speckit.analyze` | 分析一致性 |

### 配置

- 配置文件: `.specify/init-options.json`
- 项目宪法: `.specify/memory/constitution.md`

### 提示音

长时间任务完成后会自动播放提示音。手动触发：
```bash
bash .claude/notify.sh
```
