# Project: Astra
Hackathon development workspace configured with the 6-layer Agentic Playbook architecture.

## Commands (Fill in when stack is chosen tomorrow)
- Install: `npm install` (or `pnpm i` / `uv pip install -r requirements.txt`)
- Dev: `npm run dev`
- Test: `npm test`
- Build check: `npm run build`
- Security check: `npm run audit` (or `./scripts/security-check.sh`)

## Conventions
- Clean, modular architecture. Keep business logic separate from UI components.
- Strong typing; avoid `any`. Validate external inputs with schemas (e.g. Zod / Pydantic).
- Error handling: Every network/AI call must handle timeouts and errors gracefully (never blank the UI).
- Never hardcode secrets; read only from environment variables.

## Daily Workflow
1. **Explore**: Read relevant files without modifying them.
2. **Plan**: Use `/plan-feature` for anything touching multiple files before coding.
3. **Code**: Implement step-by-step; write tests for critical paths.
4. **Verify**: Run `/verify` and have `@code-reviewer` inspect changes.
5. **Commit**: Use `/commit` for clean, conventional commits.

## Pre-Launch Checks
- Run `/security-audit` to execute the 5-point security verification before presentation or submission.
