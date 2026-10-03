export type Tokens = { startedAt: number; total: number }

export type Snapshot = {
  model: string
  contextPercent: number | null
  rateLimits: { kind: string; percentUsed: number; resetsAt?: string }[]
}

declare module 'claude-code' {
  interface PluginState {
    'desktop-statusline': { tokens: Tokens; snapshot: Snapshot | null; now: number }
  }
}
