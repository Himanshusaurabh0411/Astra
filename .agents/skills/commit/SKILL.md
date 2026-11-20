---
name: commit
description: Use when the user wants to stage changes and create clean, conventional git commits.
---

# Git Commit Workflow

1. Inspect modified files using `git status` and `git diff`.
2. Confirm no sensitive secrets (`.env`, private keys) are being staged.
3. Stage appropriate changes.
4. Create a clean conventional commit:
   - `feat(...)`: New feature or capability
   - `fix(...)`: Bug fix
   - `chore(...)`: Maintenance or configuration
   - `style(...)`: UI or styling update
