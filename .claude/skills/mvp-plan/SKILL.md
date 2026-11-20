---
name: mvp-plan
description: Design a ruthless, winning MVP plan for a hackathon idea. Cuts fluff and focuses on the 2-minute judge demo flow. Use when starting a new hackathon project or feature.
argument-hint: [idea-or-problem-statement]
---

# Hackathon MVP Scoping & Architecture Plan for $ARGUMENTS

When scoping a hackathon build, follow this exact structure:

1. **The 30-Second "Hook"**:
   - What real problem does this solve?
   - Why will a judge remember this after seeing 30 other presentations?

2. **The "Hero Feature" (Must-Have)**:
   - The single core capability that must work live on stage.
   - What is the user input? What is the transformation/AI magic? What is the tangible output?

3. **Ruthless CUT List (Do NOT build during hackathon)**:
   - Auth / signup forms (use pre-authenticated demo state or bypass)
   - Settings / user profile editing
   - Complex billing/payment flows
   - Edge case configurations

4. **The 2-Minute Demo Script**:
   - 0:00 - 0:30: The hook & relatable pain point.
   - 0:30 - 1:30: Live product demonstration (The Golden Path).
   - 1:30 - 2:00: Impact, business potential, and future roadmap.

5. **Technical Architecture & Data Flow**:
   - Frontend stack & key UI components.
   - Backend / AI endpoints.
   - Fallback / Mock strategy in case LLM or external API latency exceeds 5 seconds.
