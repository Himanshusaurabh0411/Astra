import { useState } from 'react'
import { Header } from './components/Header'
import { MetricsOverview } from './components/MetricsOverview'
import { AgentStudio } from './components/AgentStudio'
import { HistoryLogs } from './components/HistoryLogs'
import { PresentationMode } from './components/PresentationMode'
import { AgentExecution } from './types'
import { sampleRuns } from './data/mockData'

export function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'history' | 'presentation'>('studio')
  const [demoMode, setDemoMode] = useState<boolean>(true)
  const [runs, setRuns] = useState<AgentExecution[]>(sampleRuns)

  const handleAddRun = (newRun: AgentExecution) => {
    setRuns((prev) => [newRun, ...prev])
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        demoMode={demoMode}
        setDemoMode={setDemoMode}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {activeTab !== 'presentation' && <MetricsOverview />}

        {activeTab === 'studio' && (
          <AgentStudio demoMode={demoMode} onAddRun={handleAddRun} />
        )}

        {activeTab === 'history' && (
          <HistoryLogs runs={runs} />
        )}

        {activeTab === 'presentation' && (
          <PresentationMode />
        )}
      </main>

      <footer className="border-t border-slate-800/60 py-6 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Astra Autonomous AI Engine • Hackathon 2026 Edition</span>
          <span>Configured with The Agentic Playbook Standard</span>
        </div>
      </footer>
    </div>
  )
}

export default App
