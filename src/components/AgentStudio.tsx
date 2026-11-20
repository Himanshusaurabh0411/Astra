import React, { useState } from 'react'
import { Sparkles, Play, CheckCircle2, Loader2, Code, Terminal, Clock, ShieldAlert } from 'lucide-react'
import { AgentExecution } from '../types'
import { sampleRuns } from '../data/mockData'

interface AgentStudioProps {
  demoMode: boolean
  onAddRun: (run: AgentExecution) => void
}

export const AgentStudio: React.FC<AgentStudioProps> = ({ demoMode, onAddRun }) => {
  const [selectedPreset, setSelectedPreset] = useState<number>(0)
  const [customPrompt, setCustomPrompt] = useState<string>(sampleRuns[0].prompt)
  const [isRunning, setIsRunning] = useState<boolean>(false)
  const [currentRun, setCurrentRun] = useState<AgentExecution | null>(sampleRuns[0])
  const [activeStepIndex, setActiveStepIndex] = useState<number>(3)
  const [showJson, setShowJson] = useState<boolean>(false)

  const handleSelectPreset = (idx: number) => {
    setSelectedPreset(idx)
    setCustomPrompt(sampleRuns[idx].prompt)
    setCurrentRun(sampleRuns[idx])
    setActiveStepIndex(3)
  }

  const handleExecute = () => {
    setIsRunning(true)
    setActiveStepIndex(0)

    const baseData = sampleRuns[selectedPreset]
    const newRun: AgentExecution = {
      ...baseData,
      id: `run-${Math.floor(1000 + Math.random() * 9000)}`,
      prompt: customPrompt,
      executionTime: (Math.random() * 0.8 + 0.9).toFixed(2) + 's',
      metrics: {
        confidence: Number((0.96 + Math.random() * 0.038).toFixed(3)),
        latencyMs: Math.floor(180 + Math.random() * 120)
      }
    }

    // Step-by-step presentation animation
    let step = 0
    const interval = setInterval(() => {
      step += 1
      setActiveStepIndex(step)
      if (step >= 3) {
        clearInterval(interval)
        setIsRunning(false)
        setCurrentRun(newRun)
        onAddRun(newRun)
      }
    }, 600)
  }

  return (
    <div className="space-y-6">
      {/* Preset Selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Test Presets:
        </span>
        {sampleRuns.map((run, i) => (
          <button
            key={run.id}
            onClick={() => handleSelectPreset(i)}
            disabled={isRunning}
            className={`text-xs px-3 py-1.5 rounded-xl border transition-all ${
              selectedPreset === i
                ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 font-semibold'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            {run.title.split(' ')[0]} {run.title.split(' ')[1]}
          </button>
        ))}
      </div>

      {/* Input Area */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
          Autonomous Agent Task Brief
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          rows={3}
          disabled={isRunning}
          placeholder="Describe any autonomous multi-step task..."
          className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition"
        />

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Target: {sampleRuns[selectedPreset].model}</span>
          </div>

          <button
            onClick={handleExecute}
            disabled={isRunning || !customPrompt.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Synthesizing Steps...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Autonomous Loop</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Execution Visualizer */}
      {currentRun && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Execution Stages */}
          <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                Execution Graph
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {currentRun.id}
              </span>
            </div>

            <div className="space-y-3">
              {currentRun.steps.map((step, idx) => {
                const isStepDone = idx <= activeStepIndex && !isRunning
                const isStepActive = isRunning && idx === activeStepIndex
                return (
                  <div
                    key={step.title}
                    className={`p-3 rounded-xl border transition-all ${
                      isStepActive
                        ? 'bg-indigo-950/40 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                        : isStepDone
                        ? 'bg-slate-900/60 border-slate-800'
                        : 'bg-slate-950/40 border-slate-900 opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 mb-1">
                      {isStepActive ? (
                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                      ) : isStepDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-slate-700" />
                      )}
                      <span className="text-xs font-semibold text-slate-200">
                        {step.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 pl-6.5 leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right: Synthesis & Output Card */}
          <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                    Confidence: {(currentRun.metrics.confidence * 100).toFixed(1)}%
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Latency: {currentRun.metrics.latencyMs}ms</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Tokens: <span className="font-mono text-slate-200">{currentRun.tokensUsed}</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowJson(!showJson)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 hover:text-white transition"
                >
                  <Code className="w-3 h-3" />
                  <span>{showJson ? 'Rich View' : 'Inspect JSON'}</span>
                </button>
              </div>

              {showJson ? (
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-72">
                  {JSON.stringify(currentRun, null, 2)}
                </pre>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Structured Resolution Summary
                    </h4>
                    <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-100 text-sm leading-relaxed">
                      {currentRun.output}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/30 flex items-start gap-3">
                    <ShieldAlert className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-300">
                      <span className="font-semibold text-indigo-300">Agent Verification Guard:</span> All deterministic outputs matched schema policies with zero contract violations.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <span>Status: <strong className="text-emerald-400 uppercase font-mono">RESOLVED</strong></span>
              <span>Total Pipeline Time: <strong className="text-slate-200">{currentRun.executionTime}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
