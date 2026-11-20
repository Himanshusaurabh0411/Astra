import React from 'react'
import { AgentExecution } from '../types'
import { CheckCircle2, Clock } from 'lucide-react'
import { redactSensitiveData } from '../utils/security'

interface HistoryLogsProps {
  runs: AgentExecution[]
}

export const HistoryLogs: React.FC<HistoryLogsProps> = ({ runs }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-slate-200 tracking-wide uppercase">
          Agent Execution & Audit Log ({runs.length})
        </h3>
        <span className="text-xs text-slate-400">
          Showing latest verified tasks (PII auto-redacted)
        </span>
      </div>

      <div className="space-y-3">
        {runs.map((run) => (
          <div
            key={run.id}
            className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-slate-700 transition"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-semibold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                  {run.id}
                </span>
                <h4 className="text-sm font-bold text-slate-100">
                  {run.title}
                </h4>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  {run.executionTime}
                </span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {(run.metrics.confidence * 100).toFixed(1)}% Match
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-3 font-mono bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
              Prompt: {redactSensitiveData(run.prompt)}
            </p>

            <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/60 text-xs text-slate-300">
              <span className="font-semibold text-slate-200">Outcome:</span> {redactSensitiveData(run.output)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
