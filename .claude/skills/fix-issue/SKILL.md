---
name: fix-issue
description: Reproduce an issue with a test, apply the fix, run verification, and prepare a clean commit.
argument-hint: [issue-description-or-id]
---

# Issue Remediation Loop: $ARGUMENTS

Follow the strict bug-fixing loop:

1. **Understand & Locate**:
   - Read the relevant code path and logs/traces.
   - Isolate the root cause.

2. **Failing Test First**:
   - Write or update a minimal test reproducing the failure.
   - Run the test to confirm it fails as expected.

3. **Minimal Fix**:
   - Make the smallest change required to resolve the bug.
   - Avoid unrelated refactoring.

4. **Verify**:
   - Run the test suite and typechecks to confirm the fix passes and introduces no regressions.

5. **Commit**:
   - Format and commit the fix with a conventional commit: `fix(...)`.
