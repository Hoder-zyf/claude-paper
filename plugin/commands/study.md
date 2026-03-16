---
allowed-tools: Bash, Write, Edit, Read
description: Study research papers - parse PDF(s), generate materials, code demos, and interactive explorer
---

## Your task

Study one or more research papers using the full paper study workflow.

### Usage

The user should provide one of:
- A local PDF path: `~/Downloads/paper.pdf`
- A direct PDF URL: `https://arxiv.org/pdf/1706.03762.pdf`
- An arXiv URL: `https://arxiv.org/abs/1706.03762`
- Multiple paths/URLs for batch processing
- A directory containing PDF files: `~/papers/`

If the user didn't provide a paper path or URL, ask them for one before proceeding.

### Execute the study workflow

Read and follow the complete study workflow defined in the skill file:

```bash
cat "${CLAUDE_PLUGIN_ROOT}/skills/study/SKILL.md"
```

Follow every step in that SKILL.md file from Step 0 through Step 9. Do not skip any steps.
When processing multiple papers, run Steps 2-8 for each paper, then launch Web UI once at the end.
