<div align="center">

# Claude Paper

### Inspired by and based on [alaliqing/claude-paper](https://github.com/alaliqing/claude-paper)

**把论文变成可积累、可检索、可交互的研究知识系统**

[English](README.md) | [中文](README.zh-CN.md)

[License: MIT](./LICENSE)
[Node Version](https://nodejs.org)
[Claude Code Plugin](https://code.claude.com)

</div>

这是一个定制版 **Claude Code 插件**，面向论文学习与研究沉淀，支持中文优先材料生成、AlphaXiv 辅助理解、知识图谱、全局知识库，以及可编辑的 Web 阅读器。



---

## 这个 Fork 的增强点

相对原始版 `claude-paper`，这个仓库更强调研究工作流的完整性：

- **中文优先输出**：默认将 `README.md`、`summary.md`、`method.md`、`reflection.md` 等学习材料生成为中文。
- **AlphaXiv 集成**：遇到 arXiv 论文时，优先获取 `alphaxiv.md`，并与 PDF 解析结果交叉验证。
- **跨论文知识库**：每研究完一篇论文，都会向 `~/claude-papers/paper.md` 追加一条带链接的知识记录。
- **标签与图谱视图**：为论文生成 2-3 个可复用语义标签，并在 Web UI 中展示知识图谱。
- **可编辑研究工作台**：在浏览器里直接编辑生成文件、运行示例代码、预览 HTML、保存片段到个人笔记。

---

## 功能特性

- **多种输入方式**：支持本地 PDF、直接 PDF 链接、arXiv 链接、多篇论文批量输入，以及整个 PDF 目录。
- **结构化 PDF 解析**：提取标题、作者、摘要、章节、参考文献、代码链接和全文内容。
- **AlphaXiv 补充理解**：通过 [AlphaXiv](https://www.alphaxiv.org/) 为 arXiv 论文补充结构化概述。
- **学习材料生成**：生成 `README.md`、`summary.md`、`method.md`、`reflection.md`、`user.md`。
- **图像提取**：将论文中的关键图表提取到 `images/` 目录。
- **代码示例**：对可实现的方法生成 `code/` 目录下的演示代码。
- **交互式探索页**：对适合交互展示的论文生成独立的 `index.html`。
- **知识库更新**：自动把论文洞察追加进全局 `paper.md`。
- **丰富 Web UI**：支持论文库、阅读器、知识图谱、全局知识库、标签编辑、已读/收藏、删除、编辑、运行等能力。

---

## 快速开始

### 从 Marketplace 安装

```bash
/plugin marketplace add https://github.com/Hoder-zyf/claude-paper
/plugin install claude-paper
/reload-plugins
```

### 或本地运行这个仓库

```bash
cd /path/to/claude-paper
claude --plugin-dir ./plugin
```

### 系统要求

- **Node.js**: 18+
- **npm**
- **Claude Code**：支持插件
- **Python 3**
- **poppler-utils**：用于提取论文图片
  - macOS: `brew install poppler`
  - Ubuntu/Debian: `sudo apt-get install poppler-utils`
  - Arch Linux: `sudo pacman -S poppler`

首次运行时，插件会自动安装依赖并初始化 `~/claude-papers/`。

---

## 使用方式

### 学习一篇或多篇论文

示例：

```text
帮我学习 ~/Downloads/attention-is-all-you-need.pdf
帮我学习 https://arxiv.org/pdf/1706.03762.pdf
帮我学习 https://arxiv.org/abs/1706.03762
帮我同时研究这两篇论文：<url-1> <url-2>
帮我研究 ~/papers/ 目录下的所有论文
```

也可以直接使用内置命令：

```bash
/claude-paper:study /path/to/paper.pdf
```

工作流会自动完成：

1. 解析输入并在需要时下载 PDF。
2. 提取论文内容并保存 `meta.json`。
3. 对 arXiv 论文尝试获取 `alphaxiv.md`。
4. 将关键图片提取到 `images/`。
5. 读取并更新全局知识库。
6. 生成学习材料和可选代码示例。
7. 更新 `~/claude-papers/index.json` 与标签注册表。
8. 启动 Web UI。

### 启动 Web UI

```bash
/claude-paper:webui
```

默认访问地址为 [http://localhost:5815](http://localhost:5815)。

---

## 生成后的目录结构

每篇论文会存放在 `~/claude-papers/papers/{paper-slug}/`：

```text
~/claude-papers/
├── index.json
├── paper.md
├── tags.json
└── papers/
    └── {paper-slug}/
        ├── paper.pdf
        ├── meta.json
        ├── alphaxiv.md              # 可选，仅 arXiv 论文
        ├── README.md
        ├── summary.md
        ├── method.md
        ├── reflection.md
        ├── user.md
        ├── index.html               # 可选交互式页面
        ├── images/
        │   └── ...
        └── code/
            └── ...
```

全局文件说明：

- `~/claude-papers/index.json`：Web UI 使用的论文索引。
- `~/claude-papers/paper.md`：跨论文知识库。
- `~/claude-papers/tags.json`：标签注册表。

---

## Web UI 能做什么

这个基于 Nuxt 的 Web 界面包含：

- **Library**：浏览、搜索、筛选、排序、收藏、标记已读、改标签、删除论文。
- **Paper Reader**：查看单篇论文下的所有生成文件。
- **Knowledge Graph**：按共享标签、共享作者、相关思想连接论文。
- **Knowledge Base**：查看和编辑全局 `paper.md`。
- **浏览器内编辑**：直接修改 Markdown 和代码文件。
- **Run 按钮**：运行本地 `.py`、`.js`、`.ts`、`.sh` 示例文件。
- **Save to Notes**：把选中的内容追加到 `user.md`。

---

## 仓库结构

```text
claude-paper/
├── .claude-plugin/
├── plugin/
│   ├── .claude-plugin/
│   ├── commands/
│   │   ├── study.md
│   │   └── webui.md
│   ├── hooks/
│   ├── skills/
│   │   └── study/
│   │       ├── SKILL.md
│   │       ├── alphaxiv-paper-lookup.md
│   │       └── scripts/
│   ├── src/
│   │   └── web/
│   └── package.json
├── README.md
└── README.zh-CN.md
```

关键文件：

- `plugin/skills/study/SKILL.md`：完整论文学习工作流。
- `plugin/skills/study/alphaxiv-paper-lookup.md`：AlphaXiv 查询辅助说明。
- `plugin/commands/study.md`：学习命令入口。
- `plugin/commands/webui.md`：生产模式 Web UI 启动命令。
- `plugin/src/web/`：Nuxt 前端与 Nitro API。

---

## 开发

### 测试 PDF 解析

```bash
node plugin/skills/study/scripts/parse-pdf.js /path/to/paper.pdf
```

### 以开发模式运行 Web

```bash
cd plugin/src/web
npm install
npm run dev
```

### 构建生产版 Web Viewer

```bash
cd plugin/src/web
npm run build
```

### 本地测试插件

```bash
cd /path/to/claude-paper
claude --plugin-dir ./plugin
```

然后执行：

```bash
/claude-paper:study /path/to/paper.pdf
```

---

## 配置说明

默认配置：

- 论文目录：`~/claude-papers/`
- Web UI 端口：`5815`
- Web UI 代码运行超时：`30s`

主工作流位于 `plugin/skills/study/SKILL.md`，若要调整生成规范、语言偏好或步骤逻辑，可直接修改该文件。

---

## 许可证

本项目采用 **MIT License**，详见 [LICENSE](LICENSE)。

---

## 致谢

- 基于 [Claude Code](https://code.claude.com) 构建
- 灵感来源并感谢原始项目 [alaliqing/claude-paper](https://github.com/alaliqing/claude-paper)
- 感谢 [AlphaXiv](https://www.alphaxiv.org/) 提供机器可读的论文概述
- Web UI 基于 [Nuxt.js](https://nuxt.com)
- 数学公式渲染使用 [KaTeX](https://katex.org)
- PDF 解析使用 [pdf-parse](https://www.npmjs.com/package/pdf-parse)

