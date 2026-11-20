---
name: verify
description: Use when the user wants to verify the project build, run tests, or check for runtime errors before committing.
---

# Pre-Commit & Pre-Demo Verification

1. Run the project build check:
   ```bash
   npm run build
   ```
2. Verify that there are zero TypeScript compiler errors or missing imports.
3. Check that `.env` is never tracked in git:
   ```bash
   git status
   ```
4. Run the security audit check:
   ```bash
   npm run audit
   ```
5. Report any issues immediately with exact line numbers and fixes.
