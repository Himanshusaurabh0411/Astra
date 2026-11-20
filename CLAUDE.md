# Project: Astra (Hackathon Edition)
Astra is an AI-powered project built for rapid hackathon delivery. The priority is a flawless 2-minute demo flow, rock-solid core user loop, and clean technical architecture.

## Golden Hackathon Rules
1. **Demo First**: The "Happy Path" shown to judges must never fail. Always gracefully fallback/mock external API timeouts.
2. **Ruthless Scoping**: Build the core differentiator first. Polish UI/UX before adding secondary features.
3. **Fail Gracefully**: Every network call / LLM call must have a try/catch with friendly UI toasts, never blank screens.
4. **No Secrets in Git**: All API keys live in `.env` (gitignored). Keep a sanitized `.env.example`.

## Commands (Update when stack is initialized)
- Install: `npm install`
- Dev: `npm run dev`
- Build check: `npm run build`
- Quick lint: `npm run lint`

## Conventions & Style
- Modern TypeScript / JavaScript or Python. Keep architecture clean and modular.
- Separate UI components, API services, and mock fallback data.
- State handling: Always show visual loaders (spinners/skeletons) for async operations so the demo feels alive.

## Workflow
- **Plan**: Always define the demo script first before coding any auxiliary feature.
- **Build**: Implement the core flow end-to-end (Frontend -> Backend/AI -> Output).
- **Verify**: Test on clean browser / incognito before presentation.
- **Ship**: Deploy early (e.g. Vercel, Railway, Render) so judges can test on their phones if needed.
