import { AgentExecution, MetricCard } from '../types'

export const initialMetrics: MetricCard[] = [
  {
    label: "Success Rate",
    value: "99.8%",
    change: "+4.2%",
    positive: true,
    description: "Multi-agent autonomous task resolution"
  },
  {
    label: "Avg Reasoning Latency",
    value: "214ms",
    change: "-48%",
    positive: true,
    description: "Speculative execution pipeline"
  },
  {
    label: "Compute Efficiency",
    value: "4.8x",
    change: "+380%",
    positive: true,
    description: "Token optimization vs standard LLM chains"
  },
  {
    label: "Total Actions Executed",
    value: "14,820",
    change: "+1.2k today",
    positive: true,
    description: "Autonomous sandbox operations"
  }
]

export const sampleRuns: AgentExecution[] = [
  {
    id: "run-9841",
    title: "Real-time Financial Fraud Anomaly Detection",
    prompt: "Scan 50,000 incoming transactions, flag cross-border rapid transfers exceeding risk threshold, synthesize merchant graph, and generate audit report.",
    status: "completed",
    model: "Astra-Orchestrator v2.4 (Multi-Modal)",
    executionTime: "1.24s",
    tokensUsed: 1420,
    steps: [
      { title: "Vector Ingestion & Filtering", detail: "Parsed 50k transactions into memory buffer in 110ms", status: "done" },
      { title: "Graph Anomaly Detection", detail: "Identified 3 cyclic velocity clusters across 4 foreign accounts", status: "done" },
      { title: "Deterministic Validation", detail: "Cross-referenced sanctioned entity watchlist & risk score: 94.2/100", status: "done" },
      { title: "Action Dispatch", detail: "Auto-froze pending payouts and pushed alerting payload to compliance webhook", status: "done" }
    ],
    output: "🚨 High-Risk Anomaly Quarantined: 3 flagged transactions totaling $412,850 routed through high-velocity shell entities. Payouts halted automatically. Full compliance audit packet dispatched.",
    metrics: { confidence: 0.985, latencyMs: 245 }
  },
  {
    id: "run-9842",
    title: "Autonomous Codebase Migration & Refactoring",
    prompt: "Analyze legacy monolithic API endpoints, generate typed TypeScript schemas, write unit test suites, and produce zero-downtime migration plan.",
    status: "completed",
    model: "Astra-CodeAgent 3.5 Sonnet",
    executionTime: "2.10s",
    tokensUsed: 2840,
    steps: [
      { title: "AST Parsing & Graph Analysis", detail: "Mapped 42 endpoints and external database dependencies", status: "done" },
      { title: "Schema Generation", detail: "Built strict Zod & TypeScript interfaces with zero 'any' fallbacks", status: "done" },
      { title: "Automated Test Synthesis", detail: "Generated 18 integration tests with 96.4% branch coverage", status: "done" },
      { title: "Lint & Typecheck Verification", detail: "Zero compiler errors, passing all linting guardrails", status: "done" }
    ],
    output: "✅ Monolith route refactoring succeeded with 100% type safety. All 18 generated integration tests passed in 480ms.",
    metrics: { confidence: 0.992, latencyMs: 310 }
  },
  {
    id: "run-9843",
    title: "Multimodal Medical Imaging Triaging",
    prompt: "Examine high-resolution MRI scan sequence, detect structural abnormalities in lateral ventricle regions, and output clinical triage priority.",
    status: "completed",
    model: "Astra-Vision DeepBio",
    executionTime: "1.85s",
    tokensUsed: 1950,
    steps: [
      { title: "Volumetric Slicing", detail: "Extracted 64 axial DICOM slices and normalized voxel intensity", status: "done" },
      { title: "Segmentation & Heatmap", detail: "Detected 4.2mm focal asymmetry in left periventricular zone", status: "done" },
      { title: "Clinical Confidence Scoring", detail: "Compared against 120,000 benchmarked reference scans", status: "done" },
      { title: "Physician Summary Assembly", detail: "Formatted structured report ready for radiologist review", status: "done" }
    ],
    output: "⚠️ Priority 2 Triage: Detected subtle 4.2mm focal signal elevation. Radiologist alert generated with highlighted bounding contours.",
    metrics: { confidence: 0.971, latencyMs: 280 }
  }
]
