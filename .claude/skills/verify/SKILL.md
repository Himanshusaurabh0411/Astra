---
name: verify
description: Verify the project builds cleanly with zero errors before committing or presenting. Run before pushing to main or going on stage.
---

# Pre-Demo Verification

1. Run build verification:
   - For Node: `npm run build`
   - For Python: check syntax / tests
2. Verify all environment variables in `.env.example` are documented.
3. Check for obvious uncaught promise rejections or unhandled exceptions in the main user flow.
4. Report any blocking failures immediately with file:line recommendations.
