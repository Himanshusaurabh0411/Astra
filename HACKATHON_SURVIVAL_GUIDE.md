# 🏆 The Ultimate Hackathon Survival & Winning Playbook

This playbook combines elite hackathon winning strategies with the **AI Agentic Playbook** architecture.

---

## ⏱️ 1. The Hackathon Timeline (Hour-by-Hour)

### Hours 0 – 2: Scoping & The "Demo Script First" Approach
- [ ] **Define the 2-Minute Demo First**: Do NOT write code yet. Write the exact 120-second pitch and click-path you will show the judges.
- [ ] **Determine the "Hero Feature"**: The single "WOW" moment that judges will remember.
- [ ] **Lock the Scope**: Cut all auth, profile settings, and payment gateways. Use mocked user state.
- [ ] **Scaffold the Stack**: Initialize repository, install core dependencies, verify local dev server runs.

### Hours 2 – 75% Time: The Core MVP Sprint
- [ ] **Build The Golden Path**: Code only the exact flow shown in the demo script.
- [ ] **AI-Assisted Velocity**: Use the agent loop (`Explore -> Plan -> Code -> Verify -> Commit`).
- [ ] **Visual Polish**: In hackathons, **UI design accounts for 40% of perceived quality**. Add clean typography, smooth transitions, and glowing status pills.
- [ ] **Graceful Fallbacks**: Add fallback data for all external AI/API calls so network latency or rate limits never break your app.

### Final 25% Time: The Ship & Pitch Lockdown (NO NEW FEATURES)
- [ ] **Deploy to Production Early**: Push to Vercel/Railway/Render 3 hours before deadline.
- [ ] **Record a 60-second Backup Screen Video**: If venue Wi-Fi drops on stage, play the video. This has saved countless winning teams.
- [ ] **Rehearse the Pitch 3x**: Practice transitions between team members and live clicking.

---

## 🧠 2. How Hackathon Judges Actually Grade

Judges evaluate dozens of projects back-to-back while tired. Here is how to hack their rubric:

| Criteria | Weight | How to Win It |
| :--- | :---: | :--- |
| **Problem & Impact** | 30% | Start with a punchy, relatable story: *"Every day, 50,000 doctors spend 3 hours doing X..."* |
| **Working Demo (Execution)**| 35% | No slides-only talk. Show working software within 45 seconds of starting. |
| **Technical Innovation / AI**| 20% | Explain why AI is critical here (not just a wrapper, but intelligent workflow/agents). |
| **Design & UX** | 15% | Clean dark/light theme, snappy loading skeletons, clear typography. |

---

## 🛡️ 3. "Never Fail On Stage" Rules
1. **Pre-seed Data**: Ensure the database already has realistic demo items so the app doesn't look like an empty dashboard.
2. **Offline/Mock Toggle**: Keep a hidden toggle or environment flag `USE_MOCK_DATA=true` to instantly switch to instant mock responses if the LLM API is slow.
3. **High Contrast**: Ensure text is readable on low-quality presentation projectors.
4. **Tab Preparation**: Keep all demo browser tabs already open and logged in before stepping onto the stage.
