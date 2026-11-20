# Security Rules
- Never hardcode API keys, passwords, database URLs, or secrets in code or comments. Always use environment variables.
- Never expose secret keys in client-side bundles (e.g. `NEXT_PUBLIC_*`, `VITE_*`).
- Always validate and sanitize external user inputs.
- Never output stack traces, database schemas, or raw error objects to client responses.
- Always use parameterized queries for database operations to prevent SQL injection.
