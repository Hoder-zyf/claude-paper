<div align="center">

# Claude Paper

### Inspired by and based on [alaliqing/claude-paper](https://github.com/alaliqing/claude-paper)

**Turn papers into a reusable research knowledge system**

[English](README.md) | [中文](README.zh-CN.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Claude Code Plugin](https://img.shields.io/badge/Claude_Code-Plugin-purple)](https://code.claude.com)

A customized **Claude Code plugin** for studying research papers with Chinese-first material generation, AlphaXiv-assisted understanding, a knowledge graph, a persistent knowledge base, and an interactive web reader.

</div>

---

## What This Fork Adds

Compared with the original `claude-paper`, this repo is focused on a deeper research workflow:

- **Chinese-first study output**: generated study materials default to Chinese unless the user explicitly asks for English.
- **AlphaXiv integration**: for arXiv papers, the workflow fetches `alphaxiv.md` and cross-checks it with parsed PDF content.
- **Cross-paper knowledge base**: each studied paper appends a linked note to `~/claude-papers/paper.md`.
- **Semantic tags and graph view**: papers get 2-3 reusable tags, plus a graph view connecting papers by tags, authors, and related ideas.
- **Editable web workspace**: edit generated files, preview HTML, save snippets to notes, and run local demo code directly from the web UI.

---

## Features

- **Multiple input modes**: local PDFs, direct PDF URLs, arXiv URLs, multiple papers at once, or a directory of PDFs.
- **Structured PDF parsing**: extracts title, authors, abstract, sections, references, code links, and full text.
- **AlphaXiv augmentation**: supplements arXiv papers with machine-readable summaries from [AlphaXiv](https://www.alphaxiv.org/).
- **Study material generation**: creates `README.md`, `summary.md`, `method.md`, `reflection.md`, and `user.md`.
- **Figure extraction**: saves paper figures into an `images/` directory for downstream study materials.
- **Code demos**: generates runnable examples in `code/` when a paper has an implementable method.
- **Interactive explorer**: can generate a self-contained `index.html` for architecture-, system-, or experiment-heavy papers.
- **Knowledge base updates**: appends a concise cross-paper note into the global `paper.md`.
- **Rich web UI**: library view, reader view, knowledge graph, global notes page, tag editing, read/star status, delete, edit, and run.

---

## Quick Start

### Install from Marketplace

```bash
/plugin marketplace add https://github.com/Hoder-zyf/claude-paper
/plugin install claude-paper
/reload-plugins
```

### Or Run This Repo Locally

```bash
cd /path/to/claude-paper
claude --plugin-dir ./plugin
```

### System Requirements

- **Node.js**: 18+
- **npm**
- **Claude Code** with plugin support
- **Python 3**
- **poppler-utils** for figure extraction
  - macOS: `brew install poppler`
  - Ubuntu/Debian: `sudo apt-get install poppler-utils`
  - Arch Linux: `sudo pacman -S poppler`

On first run, the plugin installs its own Node dependencies and initializes `~/claude-papers/`.

---

## Usage

### Study a Paper

Examples:

```text
Help me study ~/Downloads/attention-is-all-you-need.pdf
Help me study https://arxiv.org/pdf/1706.03762.pdf
Help me study https://arxiv.org/abs/1706.03762
Help me study these two papers: <url-1> <url-2>
Help me study all papers in ~/papers/
```

You can also invoke the bundled slash command directly:

```bash
/claude-paper:study /path/to/paper.pdf
```

The workflow will:

1. Resolve inputs and download PDFs when needed.
2. Parse the paper and save `meta.json`.
3. Fetch `alphaxiv.md` for arXiv papers when available.
4. Extract figures into `images/`.
5. Read and update the global knowledge base.
6. Generate study materials and optional code demos.
7. Update `~/claude-papers/index.json` and tag registry.
8. Launch the web UI.

### Launch the Web UI

```bash
/claude-paper:webui
```

The viewer runs at [http://localhost:5815](http://localhost:5815).

---

## Generated Paper Structure

Each paper lives under `~/claude-papers/papers/{paper-slug}/`:

```text
~/claude-papers/
├── index.json
├── paper.md
├── tags.json
└── papers/
    └── {paper-slug}/
        ├── paper.pdf
        ├── meta.json
        ├── alphaxiv.md              # optional, for arXiv papers
        ├── README.md
        ├── summary.md
        ├── method.md
        ├── reflection.md
        ├── user.md
        ├── index.html               # optional interactive explorer
        ├── images/
        │   └── ...
        └── code/
            └── ...
```

Global files:

- `~/claude-papers/index.json`: searchable paper index used by the web UI.
- `~/claude-papers/paper.md`: cross-paper knowledge base.
- `~/claude-papers/tags.json`: canonical tag registry.

---

## Web UI

The Nuxt-based web app includes:

- **Library**: browse, search, filter, sort, star, mark as read, retag, and delete papers.
- **Paper Reader**: navigate all generated files for one paper.
- **Knowledge Graph**: visualize links by shared tags, shared authors, and related ideas.
- **Knowledge Base**: edit and review the global `paper.md`.
- **In-browser editing**: modify generated Markdown/code files.
- **Run button**: execute local `.py`, `.js`, `.ts`, and `.sh` demo files.
- **Save to Notes**: clip selected content into `user.md`.

---

## Repository Structure

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

Key pieces:

- `plugin/skills/study/SKILL.md`: the end-to-end paper study workflow.
- `plugin/skills/study/alphaxiv-paper-lookup.md`: AlphaXiv lookup helper.
- `plugin/commands/study.md`: slash command entry for study.
- `plugin/commands/webui.md`: production web viewer launcher.
- `plugin/src/web/`: Nuxt UI and Nitro APIs.

---

## Development

### Run the Parser

```bash
node plugin/skills/study/scripts/parse-pdf.js /path/to/paper.pdf
```

### Run the Web App in Dev Mode

```bash
cd plugin/src/web
npm install
npm run dev
```

### Build the Production Viewer

```bash
cd plugin/src/web
npm run build
```

### Test the Plugin Locally

```bash
cd /path/to/claude-paper
claude --plugin-dir ./plugin
```

Then run:

```bash
/claude-paper:study /path/to/paper.pdf
```

---

## Configuration Notes

Defaults:

- Papers directory: `~/claude-papers/`
- Web UI port: `5815`
- Code execution timeout in web UI: `30s`

The main workflow lives in `plugin/skills/study/SKILL.md`, so prompt behavior and output conventions can be adjusted there.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE).

---

## Acknowledgments

- Built with [Claude Code](https://code.claude.com)
- Inspired by and based on [alaliqing/claude-paper](https://github.com/alaliqing/claude-paper)
- Thanks to [AlphaXiv](https://www.alphaxiv.org/) for providing machine-readable paper overviews
- Web viewer built with [Nuxt.js](https://nuxt.com)
- Math rendering powered by [KaTeX](https://katex.org)
- PDF parsing powered by [pdf-parse](https://www.npmjs.com/package/pdf-parse)
