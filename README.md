# 🚀 Astra — Hackathon Project

> Built with **Google Antigravity (AGY)** for [Hackathon Name / Track].

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
- **AI Models / APIs**: [e.g. Gemini 2.5 / Antigravity Agents]

---

## ⚡ Antigravity Agent Configuration

This repository is configured natively for **Google Antigravity (AGY)**:

### 📜 Rules & Directives
- **`GEMINI.md` / `AGENTS.md`**: Core hackathon principles enforcing demo-first reliability, rapid scoping, and zero secret leaks.
- **`.agents/rules/`**:
  - `security.md`: Enforces parameterization, zero hardcoded secrets, and input sanitization.
  - `code-quality.md`: Enforces minimal diffs, visual loading states, and error handling.

### 🧠 Antigravity Skills (`.agents/skills/`)
- **`plan-feature`**: Interviews and architects an implementation plan before touching code.
- **`fix-issue`**: Rapid diagnosis and failing-test verification loop.
- **`verify`**: Pre-commit build, lint, and type check.
- **`commit`**: Conventional git commit generator.
- **`security-audit`**: Runs the **5 Pre-Launch Security Checks** (Secrets, PII data flow, Pre-deploy checklist, Deep logic, and Attacker perspective review).
- **`mvp-scoper`**: Trims any hackathon idea down to a winning 2-minute "Hero Feature".
- **`demo-pitch`**: Generates a 3-slide pitch formula and judge Q&A defense.

### 🔒 Lifecycle Hooks (`.agents/hooks.json`)
- **`PreToolUse`**: Enforced safety hook (`.agents/hooks/protect-paths.sh`) guarding `.env` and internal git structures from accidental overwrite.

---

## 🚀 Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Setup environment variables
cp .env.example .env

# 3. Run development server
npm run dev

# 4. Run pre-launch 5-point security audit
npm run audit
```

---

## 👥 Team
- **Himanshu Saurabh** ([@Himanshusaurabh0411](https://github.com/Himanshusaurabh0411))
