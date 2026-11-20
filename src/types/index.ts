export interface AgentExecution {
  id: string
  title: string
  prompt: string
  status: 'completed' | 'processing' | 'failed'
  model: string
  executionTime: string
  tokensUsed: number
  steps: {
    title: string
    detail: string
    status: 'done' | 'active' | 'pending'
  }[]
  output: string
  metrics: {
    confidence: number
    latencyMs: number
  }
}

export interface MetricCard {
  label: string
  value: string
  change: string
  positive: boolean
  description: string
}
