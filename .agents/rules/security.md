# Security Rules for Antigravity

- **Zero Hardcoded Secrets**: Never commit or hardcode API keys, passwords, database URLs, or private tokens in code or comments. Always use environment variables (`.env`).
- **No Client Secrets Exposure**: Never expose sensitive secret keys using client-accessible prefixes (e.g. `VITE_*` or `NEXT_PUBLIC_*`).
- **Input Sanitization**: Always sanitize and validate user input. Bound input lengths to prevent runaway DOM loops or memory exhaustion.
- **Error Privacy**: Never leak raw database queries, stack traces, or internal server paths in client responses.
- **Safe SQL**: Always enforce parameterized queries or ORM models to prevent SQL injection.
