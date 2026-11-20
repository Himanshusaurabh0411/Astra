import React from 'react'
import { initialMetrics } from '../data/mockData'
import { TrendingUp, Activity, Cpu, Layers } from 'lucide-react'

const icons = [Activity, TrendingUp, Cpu, Layers]

export const MetricsOverview: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {initialMetrics.map((metric, idx) => {
        const Icon = icons[idx % icons.length]
        return (
          <div
            key={metric.label}
            className="glass-panel glass-panel-hover p-4 rounded-2xl relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all pointer-events-none" />
            
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 tracking-wide uppercase">
                {metric.label}
              </span>
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 group-hover:text-indigo-300 transition">
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-1.5">
              <span className="text-2xl font-bold tracking-tight text-white">
                {metric.value}
              </span>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                {metric.change}
              </span>
            </div>

            <p className="text-[12px] text-slate-400 leading-tight">
              {metric.description}
            </p>
          </div>
        )
      })}
    </div>
  )
}
