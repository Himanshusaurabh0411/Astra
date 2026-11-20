# Project: Astra (Antigravity Hackathon Workspace)

This project is configured specifically for **Antigravity (AGY)** agentic development. The goal is maximum development velocity, flawless live demo reliability, and robust pre-launch security.

## Core Hackathon Principles for Antigravity
1. **Demo-First Execution**: The "Golden Path" shown to judges must never crash or freeze. Every external AI or network call must have graceful fallback handling and visual loading feedback.
2. **Ruthless Scoping**: Prioritize the 2-minute "Hero Feature" first. Defer auth flows, profile editing, and auxiliary settings until after the core demo path is locked.
3. **Zero Leaked Secrets**: All API keys live in `.env` (strictly gitignored). Never hardcode API keys or credentials.
4. **Clean Verification**: Before presenting or committing, always run build checks and the 5-point security audit.

## Primary Commands
- Dev Server: `npm run dev`
- Build Verification: `npm run build`
- 5-Point Security Audit: `npm run audit` (or `./scripts/security-check.sh`)
- Preview: `npm run preview`

## Antigravity Workflow
1. **Explore**: Inspect files without mutating them.
2. **Plan**: Activate the `plan-feature` or `mvp-scoper` skill for any multi-file feature.
3. **Build**: Write concise, modular code with clean error boundaries.
4. **Verify**: Use the `verify` skill to ensure zero compiler/build errors.
5. **Security Pass**: Run the `security-audit` skill before final submission.
