export type LogEntry = { t: number; tool: string; target?: string }

export type Rec = {
  id: string
  sid: number
  label: string
  type: string
  status: string
  parentId?: string
  title?: string
  prompt?: string
  report?: string
  log: LogEntry[]
  tool?: string
  target?: string
  lastAt: number
  tokens: number
  startedAt: number
  endedAt?: number
}

export type Scope = 'live' | 'past' | 'all'

export type Ui = { selected: string | null; scope: Scope; query: string }

declare module 'claude-code' {
  interface PluginState {
    'subagent-tree': {
      activity: Record<string, Rec>
      past: Rec[]
      now: number
      collapsed: string[]
      ui: Ui
    }
  }
}
