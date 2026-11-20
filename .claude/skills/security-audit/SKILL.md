---
name: security-audit
description: Run the 5-Point Pre-Launch Security Audit (Secret Leaks, PII, Production Config, Logic Vulnerabilities, Attacker Review).
allowed-tools: Bash(./scripts/security-check.sh) Read Grep
---

# 5 Security Checks Before You Launch

Execute the automated security test suite:
1. Run `./scripts/security-check.sh` to check for hardcoded credentials, secret leaks, missing CSP headers, and client exposure.
2. Verify that all user inputs are sanitized and length-capped.
3. Verify that any PII or sensitive tokens displayed in logs are redacted.
4. Verify that the production build compiles with zero errors using `npm run build`.
