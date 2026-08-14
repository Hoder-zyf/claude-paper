<div align="center">

# Claude Paper

**将研究论文转化为综合学习环境**

[English](README.md) | [中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node Version](https://img.shields.io/badge/node-20.19.x_%7C_22.12%2B-brightgreen)](https://nodejs.org)
[![Agent Skills](https://img.shields.io/badge/Agent_Skills-Compatible-purple)](https://agentskills.io)

一个适用于 **Claude Code、Codex、OpenCode 和 DeepSeek Harness** 的论文学习插件。在不同 Agent 中复用同一套学习流程、生成材料、代码演示和交互式网页查看器。

<table>
  <tr>
    <td align="center">
      <img src="assets/screenshot1.png" alt="图书馆界面" width="100%"/>
      <br/>
      <sub>图书馆界面 - 浏览和搜索您的论文收藏</sub>
    </td>
    <td align="center">
      <img src="assets/screenshot2.png" alt="阅读界面" width="100%"/>
      <br/>
      <sub>阅读界面 - 支持丰富格式和数学公式的论文学习</sub>
    </td>
  </tr>
</table>

</div>

## 功能特性

- **自动 PDF 解析** - 提取标题、作者、摘要、链接和完整论文文本
- **上下文安全预览** - 完整文本保存到 `paper.txt`，元数据仅保留 50k 预览
- **代码仓库检测** - 自动发现 GitHub、arXiv、CodeOcean 链接
- **论文快速摘要** - 深度学习前先用 300–500 字的精简概览筛选论文
- **自适应学习材料** - 根据论文复杂性生成 README、摘要、洞察力、问答
- **代码演示** - 清晰实现，带 Jupyter 笔记本和原始代码集成
- **交互式网页查看器** - Nuxt.js 界面，支持数学公式渲染（KaTeX）
- **智能评估** - 难度级别和论文类型检测，实现自适应内容生成

---

## 快速开始

### 安装全部支持的 Agent

一条命令安装 Claude Code、Codex、OpenCode 和 DeepSeek Harness，无需克隆仓库：

```bash
npx --yes @zlzliqing/claude-paper@latest install
```

默认的 `all` target 会覆盖四个 Agent。对于 Claude Code，安装器通过官方 Claude CLI 注册包内 Marketplace，并安装或升级用户级插件；对于其他 Agent，则安装共享 Skill，并在适用时添加 OpenCode 命令。

也可以只安装指定 Agent：

```bash
npx --yes @zlzliqing/claude-paper@latest install --target claude-code
npx --yes @zlzliqing/claude-paper@latest install --target codex
npx --yes @zlzliqing/claude-paper@latest install --target opencode
npx --yes @zlzliqing/claude-paper@latest install --target deepseek-harness
```

通过同一正式分发渠道升级已有安装：

```bash
# 升级全部支持的 Agent
npx --yes @zlzliqing/claude-paper@latest upgrade

# 继续只升级安装时选择的 Agent
npx --yes @zlzliqing/claude-paper@latest upgrade --target codex,opencode
```

升级默认 target 为 `all`。如果已有安装只选择了部分 Agent，升级时请传入相同的 `--target` 列表，避免额外添加其他 Agent 的集成。

npm 包会把包内的插件运行时复制到用户数据目录；选择共享 Skill 宿主时，会把自动生成的兼容 Skill 放到 `~/.agents/skills/`；选择 OpenCode 时还会安装命令包装。只有在论文库不存在时才会初始化 `~/claude-papers/`。安装或升级后请重启对应 Agent。

### 仅使用 Claude Code 的 Marketplace 安装方式

如果只使用 Claude Code，仍然可以直接从它的 Marketplace 安装：

```bash
/plugin marketplace add alaliqing/claude-paper
/plugin install claude-paper
```

Claude Paper 当前通过 Agent Skills 运行，无需单独安装或配置 MCP 服务。

### 系统要求

- **Node.js**: 20.19.x，或 22.12.0 及以上版本
- **npm**: 随 Node.js 一起安装
- **Agent 宿主**: Claude Code、Codex、OpenCode 或 DeepSeek Harness
- **Claude Code CLI**: 选择 `all` 或 `claude-code` 时必须已安装
- **poppler-utils**: 用于 PDF 图像提取（通过系统包管理器安装）
  - **macOS**: `brew install poppler`
  - **Ubuntu/Debian**: `sudo apt-get install poppler-utils`
  - **Arch Linux**: `sudo pacman -S poppler`

---

## 使用方法

### 快速总结研究论文

直接让所使用的 Agent 快速总结论文，或使用对应宿主命令：

```bash
# Claude Code
/claude-paper:summary /path/to/paper.pdf

# OpenCode
/claude-paper-summary /path/to/paper.pdf
```

在 Codex 或 DeepSeek Harness 中，可以直接要求 Agent 快速总结论文，或显式加载 `claude-paper-summary` Skill。该流程会生成 `quick-summary.md`，并把原始 PDF、完整 `paper.txt` 和元数据保存到共享论文库。

### 学习研究论文

直接让所使用的 Agent 学习论文：

```
帮我学习 ~/Downloads/attention-is-all-you-need.pdf 这篇论文
```

您也可以使用 URL：

```
# 直接 PDF 链接
帮我学习 https://arxiv.org/pdf/1706.03762.pdf 这篇论文

# arXiv 摘要链接（自动转换为 PDF）
帮我学习 https://arxiv.org/abs/1706.03762 这篇论文
```

Agent 将自动触发学习工作流程并：
1. 解析 PDF 并提取元数据
2. 分析论文复杂性和类型
3. 生成自适应学习材料
4. 创建代码演示（如适用）
5. 提取并包含原始代码（如有）
6. 提取关键图表和图像
7. 更新全局搜索索引
8. 自动启动网页查看器

### 启动网页查看器

```bash
# Claude Code
/claude-paper:webui

# OpenCode
/claude-paper-webui
```

在 Codex 或 DeepSeek Harness 中，可以直接要求 Agent 启动 Claude Paper 网页查看器，或显式加载 `claude-paper-webui` Skill。

在 **http://localhost:5815** 打开交互式网页界面，您可以：
- 浏览所有已学习的论文
- 查看生成的材料和数学公式
- 访问代码演示和笔记本
- 搜索论文库

---

## 论文存储结构

论文按 `~/claude-papers/papers/{paper-slug}/` 组织：

```
~/claude-papers/
├── papers/
│   └── {paper-slug}/
│       ├── paper.pdf                     # 原始 PDF 文件
│       ├── paper.txt                     # 完整提取文本
│       ├── meta.json                     # 论文元数据（标题、作者等）
│       ├── quick-summary.md               # 精简筛选摘要（快速流程）
│       ├── README.md                     # 快速导航和概览
│       ├── summary.md                    # 详细摘要
│       ├── insights.md                   # 核心洞察力（最重要！）
│       ├── method.md                     # 方法论（如复杂）
│       ├── mental-model.md              # 论文分类（如需要）
│       ├── reflection.md                # 未来方向（如需要）
│       ├── qa.md                         # 学习问题
│       ├── index.html                    # 交互式 HTML 探索器
│       ├── images/                       # 提取的图表和表格
│       │   ├── fig1.png
│       │   └── fig2.png
│       └── code/                         # 代码演示
│           ├── core-demo.py              # 清晰的参考实现
│           └── concept-demo.ipynb        # 交互式 Jupyter 笔记本
│
└── index.json                           # 全局搜索索引
```

---

## 架构

### 插件结构

```
claude-paper/
├── package.json                       # npm 正式分发清单
├── bin/
│   └── claude-paper.mjs              # npx 安装和升级入口
├── .claude-plugin/
│   └── marketplace.json              # Claude Code 市场目录
├── .codex-plugin/
│   └── plugin.json                   # Codex 插件清单
├── .agents/skills/                   # OpenCode 与 DSH 自动发现入口
├── .opencode/commands/               # OpenCode 命令包装
├── skills/                           # Codex 打包 Skill 适配层
├── scripts/
│   ├── sync-agent-adapters.mjs       # 确定性适配生成器
│   └── install-agent-adapters.mjs    # 跨 Agent 安装和升级器
├── plugin/
│   ├── .claude-plugin/
│   │   └── plugin.json              # 插件清单
│   ├── skills/
│   │   ├── study/
│   │   │   ├── SKILL.md             # 学习工作流程定义
│   │   │   └── scripts/
│   │   │       ├── parse-pdf.js    # PDF 解析工具
│   │   │       └── extract-images.py  # 图像提取
│   │   ├── summary/
│   │   │   └── SKILL.md             # 快速摘要工作流程定义
│   │   └── webui/
│   │       └── SKILL.md             # 网页查看器工作流程定义
│   ├── commands/
│   │   └── webui.md                # /webui 命令
│   ├── hooks/
│   │   ├── hooks.json              # 会话生命周期钩子
│   │   └── check-install.sh        # 安装验证
│   ├── src/
│   │   └── web/                    # Nuxt.js 网页查看器
│   │       ├── components/         # Vue 组件
│   │       ├── composables/        # Vue 组合式函数
│   │       ├── server/             # API 端点
│   │       └── package.json
│   └── package.json
└── README.md
```

### 核心组件

1. **学习技能** - 编排论文深度处理的主要工作流程代理
2. **摘要技能** - 精简的论文筛选工作流程
3. **PDF 解析器** - 使用 pdf-parse 提取文本、元数据和代码链接
4. **图像提取器** - PDF 图表提取的 Python 脚本
5. **网页查看器** - 带 Nitro API 服务器的 Nuxt.js 应用
6. **钩子系统** - Claude Code 生命周期设置
7. **Agent 适配层** - 为 Codex、OpenCode 和 DeepSeek Harness 生成发现及调用包装

---

## 开发

### 运行测试

```bash
# 验证跨 Agent 适配及已审查的 canonical Claude Skills
npm test

# 验证生成的适配文件保持同步
npm run check:adapters

# 测试 PDF 解析
node plugin/skills/study/scripts/parse-pdf.js /path/to/paper.pdf

# 测试网页查看器
cd plugin/src/web
npm run dev

# 测试完整工作流程
cd /path/to/claude-paper
claude --plugin-dir ./plugin
/claude-paper:study /path/to/paper.pdf
```

### 校验 npm 分发包

```bash
# 生成待发布文件列表前会自动执行适配检查和测试
npm pack --dry-run
```

### 生产构建

```bash
# 构建网页查看器
cd plugin/src/web
npm run build

# 构建的查看器将在 .output/ 目录中
```

---

## 配置

### 环境变量

无需配置！插件使用合理的默认值：

- **论文目录**: `~/claude-papers/`
- **网页查看器端口**: `5815`
- **元数据预览限制**: `50,000` 字符；完整提取文本保存在 `paper.txt`

### 高级自定义

您可以通过编辑技能文件来修改行为：
`plugin/skills/study/SKILL.md`

---

## 贡献

欢迎贡献！请：

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 进行更改
4. 如适用，添加测试
5. 提交更改 (`git commit -m 'add amazing feature'`)
6. 推送到分支 (`git push origin feature/amazing-feature`)
7. 打开 Pull Request

---

## 许可证

本项目采用 **MIT 许可证** - 详见 [LICENSE](LICENSE) 文件。

---

## 致谢

- 基于 [Claude Code](https://code.claude.com) 构建
- PDF 解析由 [pdf-parse](https://github.com/ffalt/json2csv-converter) 提供支持
- 网页查看器由 [Nuxt.js](https://nuxt.com) 构建
- 数学渲染由 [KaTeX](https://katex.org) 提供支持
