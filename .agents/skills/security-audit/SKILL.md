---
name: security-audit
description: Use when the user asks to run a security audit, check for secret leaks, audit personal data flow, or perform pre-deploy security checks before launch.
---

# 5 Pre-Launch Security Audit Checks

Execute these 5 checks based on industry security standards:

### 1. Secret Leak Prevention (based on Gitleaks)
- Ensure all API keys, database URLs, passwords, and tokens are stored in environment variables (`.env`).
- Ensure `.env` is listed in `.gitignore` and `.env.example` provides placeholders without real secrets.
- Verify no secrets appear client-side via public env prefixes.
- Check `console.log` and error handlers to ensure no credentials or tokens are printed.

### 2. Personal Data Flow Audit (based on Bearer)
- Map user PII collection points (emails, phones, passwords, tokens).
- Verify passwords use robust hashing (bcrypt / argon2 / scrypt).
- Ensure no sensitive PII is stored unencrypted in `localStorage` or leaked in client responses.
- Ensure sensitive cookies use `httpOnly`, `secure`, and `sameSite` flags.

### 3. Pre-Deploy Production Audit (based on ECC Production Audit)
- Confirm all required environment variables are set and validated on app startup.
- Remove debug code, console dumps, commented secrets, and test backdoors.
- Ensure generic error responses to clients with detailed logs kept server-side.
- Verify security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Content-Security-Policy`.
- Ensure auth endpoints have rate limiting.

### 4. Deep Security Audit for Complex Logic (based on Trail of Bits)
- Authentication & Authorization: check every route for proper auth middleware and no IDOR vulnerabilities.
- Payment Logic: verify server-side calculation and webhook signature verification.
- Input Handling: check parameterized SQL queries, XSS prevention, and file upload validation.

### 5. Attacker's Perspective Review (based on ECC Security Review)
- Test ID manipulation (URL/payload tampering).
- Test login bypass, privilege escalation, and role checks.
- Test content injection (XSS/SQL injection) through text fields and search bars.
- Check internal exposure (.git directory, internal health checks, database endpoints).

Run the automated script to test baseline checks:
```bash
npm run audit
```
