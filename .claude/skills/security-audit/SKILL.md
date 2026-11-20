---
name: security-audit
description: Run the comprehensive 5-Point Pre-Launch Security Audit (Secret Leaks, Personal Data Flow, Pre-Deploy Production, Deep Logic, and Attacker Perspective).
argument-hint: [all | 1-secrets | 2-dataflow | 3-predeploy | 4-logic | 5-attacker]
---

# 5 Pre-Launch Security Checks ($ARGUMENTS)

Execute the requested security checks based on industry standards:

### Check 01: Secret Leak Prevention (Gitleaks)
- Ensure all secrets, tokens, database credentials live in `.env` (gitignored).
- Verify no secrets appear in client-accessible bundles (`NEXT_PUBLIC_`, `VITE_`, `REACT_APP_`).
- Check `console.log` and error handlers to ensure credentials are never printed.
- Verify `.env.example` lists required variables with dummy values only.

### Check 02: Personal Data Flow Audit (Bearer)
- Map user PII collection points (emails, phones, passwords, tokens).
- Ensure passwords use strong hashing (bcrypt / argon2 / scrypt).
- Verify no user PII is stored unencrypted in `localStorage` or leaked in API responses.
- Ensure sensitive cookies use `httpOnly`, `secure`, and `sameSite` flags.

### Check 03: Pre-Deploy Production Audit (ECC)
- Confirm all required environment variables are set and validated at startup.
- Remove debug code (`console.log`, commented-out secrets, test backdoors).
- Sanitize error messages sent to clients (no raw database traces or stack traces).
- Verify security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `CSP`.
- Ensure auth endpoints have rate limiting.

### Check 04: Deep Security Audit for Complex Logic (Trail of Bits)
- Authentication & Authorization: check every route for auth middleware and IDOR protection.
- Payment Logic: verify server-side price calculation, webhook signature verification.
- Input Handling: check parameterized SQL queries, XSS sanitization, file upload validation.

### Check 05: Attacker's Perspective Review (ECC Review)
- Probe ID manipulation (URL/payload tampering).
- Test login bypass, privilege escalation, and role validation.
- Test content injection (XSS/SQL injection) in text fields.
- Check for internal exposure (.git, unauthenticated health checks, database endpoints).

Report each finding with: Vulnerability, Location, Potential Impact, and Drop-In Remediation.
