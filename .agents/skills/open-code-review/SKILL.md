---
name: open-code-review
description: >
  Performs AI-powered code review on Git changes using the `ocr` CLI from
  alibaba/open-code-review. Use when the user asks to review code, review
  a pull request, review staged/unstaged changes, review a commit, or
  compare branches for code quality issues. Produces line-level review
  comments and can automatically apply fixes when requested.
license: Apache-2.0
compatibility: >
  Requires the `ocr` CLI installed (via `npm install -g
  @alibaba-group/open-code-review` or GitHub release binary).
metadata:
  author: alibaba
  homepage: https://github.com/alibaba/open-code-review
  version: "1.12.4"
---

# Open Code Review (Alibaba)

Skill invoking [open-code-review](https://github.com/alibaba/open-code-review) (`ocr`) — an open-source AI code review CLI that reads Git diffs and generates structured, line-level review comments.

## Workflow

### Step 1: Run Code Review
Run the OCR command:
```bash
ocr review --audience agent --background "Lycero / TeacherAI EdTech Platform"
```

Common flags:
- `ocr review` — review current staged, unstaged, untracked changes.
- `ocr review --preview` — preview which files will be reviewed without running LLM.
- `ocr review --from main --to <branch>` — compare branch with main.
- `ocr review --commit <sha>` — review a specific commit.
- `ocr delegate preview` — get reviewable files without needing OCR API keys.

### Step 2: Evaluation Criteria
Group review comments into:
- **CRITICAL**: System crash, data leak, multi-tenant breach (`orgId` missing).
- **HIGH**: Logic bugs, unhandled exception, NPE, performance waterfalls.
- **MEDIUM**: Input schema tolerance, stale cache.
- **LOW**: Minor formatting, naming.
