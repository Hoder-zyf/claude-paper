---
name: study
description: Use this skill when the user wants to read, study, analyze, or deeply understand a research paper (PDF).
disable-model-invocation: false
allowed-tools: Bash, Write, Edit, Read
---

# Paper Study Workflow

Invoke this skill with a paper PDF path.

**Language Detection**: Detect the user's language from their input and generate ALL materials in that language.
- Example: User says "我们学习一下这篇论文吧" → Generate materials in Chinese
- Example: User says "Let's study this paper" → Generate materials in English

---

# Core Philosophy

Primary Objective:
Facilitate deep conceptual understanding and research-level thinking.

Secondary Objective:
Create a structured, reusable paper knowledge system.

**Grounding Rule**: For key technical content — contributions, method descriptions, core formulas, and experimental results — quote the relevant passage from the paper directly, then provide your interpretation. General background or high-level explanations do not need citations.

---

# Step 0: Validate Plugin Root and Check Dependencies

If `${CLAUDE_PLUGIN_ROOT}` does not contain the expected `skills/study/scripts/parse-pdf.js`, it may have been overridden by the current working directory (e.g. when running Claude Code inside the plugin's source repo). In that case, locate the actual plugin cache path:

```bash
if [ ! -f "${CLAUDE_PLUGIN_ROOT}/skills/study/scripts/parse-pdf.js" ]; then
  # Try to find the actual plugin cache path
  CACHED=$(find ~/.claude/plugins/cache -path "*/claude-paper/*/skills/study/scripts/parse-pdf.js" 2>/dev/null | head -1)
  if [ -n "$CACHED" ]; then
    export CLAUDE_PLUGIN_ROOT="$(dirname "$(dirname "$(dirname "$(dirname "$CACHED")")")")"
    echo "Corrected CLAUDE_PLUGIN_ROOT to: ${CLAUDE_PLUGIN_ROOT}"
  fi
fi
```

```bash
if [ ! -f "${CLAUDE_PLUGIN_ROOT}/.installed" ]; then
  echo "First run - installing dependencies..."
  cd "${CLAUDE_PLUGIN_ROOT}"
  npm install || exit 1

  # Install Python dependencies for image extraction
  python3 -m pip install pymupdf --user --break-system-packages 2>/dev/null || pip3 install pymupdf --user --break-system-packages 2>/dev/null || echo "Warning: Failed to install pymupdf"

  touch "${CLAUDE_PLUGIN_ROOT}/.installed"
  echo "Dependencies installed!"
fi
```

Recommended:

* Node >= 18
* Python 3 with pip (for image extraction)

---

# Step 1: Download and Parse PDF

Supports multiple input formats:

* **Local path**: `~/Downloads/paper.pdf`
* **Direct PDF URL**: `https://arxiv.org/pdf/1706.03762.pdf`
* **arXiv URL**: `https://arxiv.org/abs/1706.03762`

## Step 1a: Check input type and download if URL

```bash
USER_INPUT="<user-input>"

# Check if input is a URL (starts with http:// or https://)
if [[ "$USER_INPUT" =~ ^https?:// ]]; then
  # Download PDF from URL
  INPUT_PATH=$(node ${CLAUDE_PLUGIN_ROOT}/skills/study/scripts/download-pdf.cjs "$USER_INPUT")
else
  # Use local path directly
  INPUT_PATH="$USER_INPUT"
fi
```

For URLs, the download script will:
* Download PDFs to `/tmp/claude-paper-downloads/`
* Convert arXiv `/abs/` URLs to PDF URLs automatically
* Validate that URLs point to PDF files
* Return the local file path for processing

For local paths, use the path directly without downloading.

## Step 1b: Parse PDF

Extract structured information:

**NOTE**: `$CLAUDE_PLUGIN_ROOT` does not persist across separate Bash tool calls. Re-resolve the plugin root each time:

```bash
PLUGIN_ROOT=$(find ~/.claude/plugins/cache -maxdepth 8 -name "parse-pdf.js" -path "*/claude-paper/*" 2>/dev/null | head -1 | sed 's|/skills/study/scripts/parse-pdf.js||')
node "${PLUGIN_ROOT}/skills/study/scripts/parse-pdf.js" "$INPUT_PATH"
```

Output includes:

* title
* authors
* abstract
* full content
* githubLinks
* codeLinks

Save to:

```
~/claude-papers/papers/{paper-slug}/meta.json
```

Copy original PDF:

```bash
cp <pdf-path> ~/claude-papers/papers/{paper-slug}/paper.pdf
```

Fallback:
If structured parsing fails, extract raw text and continue with degraded structure.

---

# Step 2: Extract Images

Extract images early so they can inform material generation.

```bash
mkdir -p ~/claude-papers/papers/{paper-slug}/images

python3 ${CLAUDE_PLUGIN_ROOT}/skills/study/scripts/extract-images.py \
  ~/claude-papers/papers/{paper-slug}/paper.pdf \
  ~/claude-papers/papers/{paper-slug}/images
```

Rename key images descriptively:

* architecture.png
* training_pipeline.png
* results_table.png

---

# Step 3: Assess Paper Before Generating Materials

Before generating any files, evaluate:

1. Difficulty Level

   * Beginner
   * Intermediate
   * Advanced
   * Highly Theoretical

2. Paper Nature

   * Theoretical
   * Architecture-based
   * Empirical-heavy
   * System design
   * Survey

3. Methodological Complexity

   * Simple pipeline
   * Multi-stage training
   * Novel architecture
   * Heavy mathematical derivation

This assessment determines:

* Explanation depth
* Whether to generate code demos (skip for Survey / pure theory)
* Whether to generate interactive HTML (only for architecture / empirical / system design)
* Code demo complexity

---

# Step 3.5: Generate 2-4 Semantic Tags (Mandatory)

Before generating files, infer 2-4 tags from semantic understanding of the paper.

Rules:

* Generate between 2 and 4 tags
* Tags must be distinct
* Each tag should be short (1-3 words)
* Avoid generic tags: `paper`, `research`, `ai`, `ml`
* Prefer a mix of problem/domain tags and method/core idea tags

Examples:

* `machine translation`, `self-attention`
* `3d detection`, `bev transformer`, `lidar fusion`
* `protein folding`, `structure prediction`, `alphafold`

Persist tags in both locations:

* `~/claude-papers/papers/{paper-slug}/meta.json` as `tags`
* `~/claude-papers/index.json` entry as `tags`

---

# Step 4: Generate Core Study Materials

Create folder:

```
~/claude-papers/papers/{paper-slug}/
```

## Citation Rule (applies to method.md and key claims in summary.md)

When describing contributions, method steps, core formulas, or experimental results, directly quote the relevant passage from the paper. Use this format:

```markdown
> "Exact quote from the paper goes here, copied verbatim from the parsed content."
> — Section X.Y / Abstract / Conclusion

**Interpretation**: Your explanation of what this means and why it matters.
```

General background explanations and high-level summaries do not require citations. But method.md should have at least 3-5 direct quotes, and summary.md should quote the paper's own contribution claims and key results.

---

## Required Files

### README.md

* What the paper is about (one paragraph)
* Difficulty level
* How to navigate materials
* Key takeaways
* Estimated study time
* Folder structure overview

---

### summary.md

Comprehensive overview with emphasis on contributions and background:

* **Background context** — what problem exists, why it matters, what prior approaches lacked
* **Contributions** — quote the paper's own contribution claims verbatim, then explain each in plain language
* Core idea explained plainly — what conceptual shift it introduces
* **Key results** with quantitative metrics (quote exact numbers from the paper)
* Trade-offs and limitations
* Comparison to prior work

---

### method.md

Detailed technical breakdown of the paper's approach:

* Component breakdown
* Algorithm flow
* Architecture diagram (ASCII if needed)
* Step-by-step explanation (quote key formulas and definitions from the paper)
* Pseudocode (balanced with explanation)
* Implementation pitfalls
* Hyperparameter sensitivity (quote reported values)
* Reproduction risks

---

### reflection.md

Focus on **what we can learn** from this paper — research context, takeaways, and forward-looking analysis:

* **What can we learn from this paper** — key lessons, transferable ideas, methodological insights
* What type of problem is this and how it fits the broader research landscape
* What prior knowledge is assumed
* What assumptions are fragile (distinguish between limitations the paper acknowledges vs. your own observations)
* If you were to extend this paper, what would you do
* What open problems remain
* Where it might fail in practice

---

# Step 4.5: Double-Check Against Original Text

After generating all materials, review each file against the parsed paper content:

1. **Verify numbers**: Check that all metrics, percentages, and quantitative claims in summary.md match the paper exactly
2. **Verify method accuracy**: Check that algorithm descriptions and formulas in method.md faithfully represent the paper's approach
3. **Verify attribution**: Check that limitations in reflection.md clearly distinguish between what the paper itself states vs. your own analysis
4. **Fix any discrepancies**: If you find misquotes, wrong numbers, or inaccurate descriptions, correct them immediately

This step is mandatory — do not skip it.

---

# Step 5: Code Demonstrations (Conditional)

**Skip this step** if the paper is a Survey, pure theoretical proof, or has no implementable method.

If generating code demos, place them in:
```
~/claude-papers/papers/{paper-slug}/code/
```

```bash
mkdir -p ~/claude-papers/papers/{paper-slug}/code
```

Guidelines:

* Self-contained
* Runnable independently
* Educational comments (explain why)
* Focus on core contribution
* Prefer clarity over completeness

Possible types:

* Simplified conceptual implementation
* Visualization script
* Minimal architecture demo
* Interactive notebook (.ipynb)

Name descriptively:

* model_demo.py
* vectorized_planning_demo.py
* contrastive_loss_visualization.ipynb

Avoid generic names.

---

# Step 6: Generate Interactive HTML Explorer (Conditional)

**Skip this step** unless the paper is architecture-based, empirical-heavy, system design, or has interactive/explorable data.

Create a single self-contained HTML file for interactively exploring the paper's core concepts.

**Output path:**
```
~/claude-papers/papers/{paper-slug}/index.html
```

## Requirements

* Single HTML file, all CSS/JS inline, zero external dependencies
* Uses **real data from the paper** (actual metrics, hyperparameters, comparisons) — never invent numbers
* Must work in a sandboxed iframe (no external fetches, no localStorage)

## Guidelines

Choose the interaction pattern that best fits the paper — architecture diagrams, parameter explorers, result dashboards, formula breakdowns, comparison matrices, etc. Let the paper's content dictate the format rather than forcing a fixed layout, focusing on the core ideas of the paper.

Every interactive control (slider, toggle, dropdown) should visibly change the visualization. Include brief explanatory text alongside interactive elements to teach concepts.

---

# Step 7: Update Index

**CRITICAL**: Read existing index.json first, then append the new paper. Never overwrite the entire file.

index.json is a **bare JSON array** (not an object). If it does not exist, initialize as `[]`.

Use this Python template to read, deduplicate, and append:

```python
import json, os

index_path = os.path.expanduser("~/claude-papers/index.json")
papers = json.load(open(index_path)) if os.path.exists(index_path) else []

new_entry = {
  "id": "paper-slug",
  "title": "Paper Title",
  "slug": "paper-slug",
  "authors": ["Author 1", "Author 2"],
  "abstract": "Paper abstract...",
  "year": 2024,
  "date": "2024-01-01",
  "tags": ["tag-1", "tag-2"],
  "githubLinks": ["https://github.com/..."],
  "codeLinks": ["https://..."]
}

# Deduplicate by id, then append
papers = [p for p in papers if p.get('id') != new_entry['id']]
papers.append(new_entry)

with open(index_path, 'w') as f:
    json.dump(papers, f, indent=2, ensure_ascii=False)
```
**IMPORTANT**: The index.json file must be located at:
```
~/claude-papers/index.json
```

---

# Step 8: Relaunch Web UI

Invoke:

```
/claude-paper:webui
```

---

# Step 9: Interactive Deep Learning Loop

After all files are generated:

## Present to User:

1. Ask:

   * What part is still unclear?
   * Do you want deeper mathematical breakdown?
   * Do you want implementation-level analysis?
   * Do you want comparison with another paper?

2. Allow user to:

   * Ask deeper questions
   * Summarize their understanding
   * Propose new ideas

---

## If user asks deeper questions:

Generate a new file inside the same folder:

Examples:

* deep-dive-contrastive-loss.md
* math-derivation-breakdown.md
* comparison-with-transformers.md
* extension-ideas.md

---

## If user provides their own summary:

1. Refine it.
2. Improve structure.
3. Save as:

* user-summary-v1.md

If iterated:

* user-summary-v2.md

---

## If user wants structured consolidation:

Create:

* consolidated-notes.md
* study-session-1.md
* exam-review.md

---

This makes the paper folder a growing knowledge node.
