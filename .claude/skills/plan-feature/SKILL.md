---
name: plan-feature
description: Plan a feature before writing code. Interviews for edge cases, inspects existing architecture, and creates an actionable implementation specification.
argument-hint: [feature-name-or-description]
---

# Feature Planning: $ARGUMENTS

Follow this structured planning workflow:

1. **Clarify Requirements**:
   - Ask clarifying questions about edge cases, inputs, and expected outcomes if ambiguous.
   - Confirm user permissions, data models, and UI/API interactions.

2. **Explore Existing Architecture**:
   - Read related files and check existing schemas/routes.
   - Identify which files will be created and which will be modified.

3. **Produce Implementation Plan**:
   - Write or update `docs/plans/$ARGUMENTS.md` with:
     - Component / Endpoint specification.
     - Step-by-step implementation order.
     - Verification criteria (tests to write, manual checks).

4. **Approval Gate**:
   - Stop and present the plan to the user for sign-off before writing any production code.
