---
name: commit
description: Stage all changes and generate a concise conventional git commit.
argument-hint: [optional-message-hint]
---

# Commit Workflow

1. Check current status with `git status`.
2. Inspect diff with `git diff`.
3. Stage appropriate files (never commit `.env` or temporary artifacts).
4. Create a clean conventional commit: `feat(...)`, `fix(...)`, `chore(...)`, or `style(...)`.
