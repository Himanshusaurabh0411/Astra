---
name: fix-issue
description: Use when the user wants to debug, troubleshoot, or fix a bug or error in the codebase.
---

# Issue Remediation Loop

1. **Root Cause Analysis**:
   - Inspect the error stack trace, network logs, or erroneous behavior.
   - Trace the exact file and line where the defect originates.

2. **Reproduction**:
   - Create a failing test or isolated reproduction case to prove the bug.

3. **Minimal Fix**:
   - Implement the fix with minimal surgical changes.
   - Avoid unnecessary refactoring that could introduce secondary defects.

4. **Verification**:
   - Run the reproduction test and project build check (`npm run build`).
   - Confirm the error is resolved with zero regressions.
