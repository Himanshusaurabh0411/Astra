# Code Quality & Hackathon Velocity Rules

- **Minimal Diffs**: Make minimal, focused edits. Touch only the files necessary for the requested feature.
- **Fail Fast with Feedback**: Every asynchronous network or LLM call must have try/catch error handling and clear visual feedback (spinners, toasts) so the UI never appears broken.
- **Strict Typing**: Maintain clean TypeScript types; avoid `any`.
- **Pre-Seed Demo Data**: Ensure components have clean fallback data so the application looks rich and alive even if backend calls are delayed.
