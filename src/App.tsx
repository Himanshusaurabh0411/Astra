export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold border border-indigo-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Environment Ready for Hackathon Build
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
          Astra Workspace
        </h1>

        <p className="text-slate-400 text-sm leading-relaxed">
          Your dev environment, Claude Code skills, subagents, lifecycle hooks, and security audit suite are configured and ready.
        </p>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-left text-xs font-mono text-slate-300 space-y-2">
          <div className="text-slate-400 font-bold uppercase tracking-wider text-[11px]">Quick Commands:</div>
          <div>• <code className="text-indigo-400">/plan-feature</code> — Interview & architecture plan</div>
          <div>• <code className="text-indigo-400">/fix-issue</code> — Failing test & fix loop</div>
          <div>• <code className="text-indigo-400">/verify</code> — Pre-commit build & lint check</div>
          <div>• <code className="text-indigo-400">/security-audit</code> — 5-point launch security check</div>
          <div>• <code className="text-indigo-400">@code-reviewer</code> — Subagent code review</div>
        </div>
      </div>
    </div>
  )
}

export default App
