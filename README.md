# 🚀 Astra — Hackathon Project

> Built for [Hackathon Name / Track].

---

## 💡 The Problem
<!-- Describe the specific problem or opportunity your project addresses -->
- **Pain Point**: 
- **Target Audience**: 

## ✨ The Solution
<!-- Describe how Astra solves this problem -->
- **Core Value Proposition**: 
- **Key Differentiator**: 

## 🎯 Features
- [ ] **Feature 1**: 
- [ ] **Feature 2**: 
- [ ] **Feature 3**: 

## 🛠️ Tech Stack & Architecture
- **Frontend**: [e.g. Next.js / React / Tailwind CSS]
- **Backend**: [e.g. Node.js / FastAPI / Supabase]
- **AI Models / APIs**: [e.g. Claude 3.5 Sonnet / Gemini 2.5]

---

## ⚡ Developer & Agent Workflows

This repository is pre-configured with the **Claude Code Agentic Playbook** architecture:

### 🤖 Built-In Slash Commands & Skills
- `/plan-feature [name]`: Interviews and generates an architectural plan before touching code.
- `/fix-issue [desc]`: Reproduces bugs with a failing test first, fixes, and verifies.
- `/verify`: Runs all build, lint, and type checks before committing.
- `/commit`: Formats and generates clean conventional commits.
- `/security-audit`: Runs the **5 Pre-Launch Security Checks** (Secrets, PII data flow, Pre-deploy checklist, Deep logic, and Attacker perspective review).

### 👥 Subagents
- `@code-reviewer`: Senior reviewer checking correctness, security, and edge cases on git diffs.
- `@test-runner`: Lightweight subagent running test suites and summarizing failures.
- `@debugger`: Diagnoses bugs with hypothesis-driven testing.

### 🔒 Enforced Security Hooks
- `PreToolUse`: Automated hook script (`.claude/hooks/protect-paths.sh`) preventing accidental edits to `.env` or sensitive files.
- `Notification`: Desktop alert when input is required.

---

## 🚀 Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Setup environment variables
cp .env.example .env

# 3. Run development server
npm run dev

# 4. Run pre-launch security audit
npm run audit
```

---

## 👥 Team
- **Himanshu Saurabh** ([@Himanshusaurabh0411](https://github.com/Himanshusaurabh0411))
