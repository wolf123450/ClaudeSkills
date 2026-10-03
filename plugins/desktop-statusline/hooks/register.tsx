import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Snapshot, Tokens } from '../types'

const tokens = atom({ plugin: 'desktop-statusline', key: 'tokens' } as const, { startedAt: 0, total: 0 })
const snapshot = atom({ plugin: 'desktop-statusline', key: 'snapshot' } as const, null)
const now = atom({ plugin: 'desktop-statusline', key: 'now' } as const, 0)

// Same thresholds as ~/.claude/statusline-command.sh
const trafficLight = (pct: number, low: string) => (pct >= 75 ? 'red' : pct >= 50 ? 'yellow' : low)

const formatTokens = (n: number) =>
  n >= 1_000_000 ? `${Math.floor(n / 1_000_000)}M tok` : n >= 1000 ? `${Math.floor(n / 1000)}k tok` : n > 0 ? `${n} tok` : null

const formatReset = (resetsAt: string | undefined, nowMs: number) => {
  if (!resetsAt) return ''
  const remaining = Math.floor((Date.parse(resetsAt) - nowMs) / 1000)
  if (!(remaining > 0)) return ''
  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  return h > 0 ? ` (resets ${h}h${m}m)` : ` (resets ${m}m)`
}

async function refresh($: EngineInterface) {
  const [usage, model, t] = await Promise.all([$.session.usage(), $.session.model(), $.clock.now()])
  const snap: Snapshot = {
    model,
    contextPercent: usage.context.percent ?? null,
    rateLimits: usage.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })),
  }
  // /clear restarts the session clock: start the token count over with it.
  await update($, tokens, (cur: Tokens) => (cur.startedAt === usage.startedAt ? cur : { startedAt: usage.startedAt, total: 0 }))
  await update($, snapshot, () => snap)
  await update($, now, () => t)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    // Keeps the reset countdown moving between turns.
    $.clock.every(60_000, () => void refresh($))
    return result
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage = result.usage
    if (usage) {
      await update($, tokens, (cur: Tokens) => ({ ...cur, total: cur.total + usage.input_tokens + usage.output_tokens }))
    }
    await refresh($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    await refresh($)
    return result
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The terminal already runs the real status line command.
    if (e.surface === 'terminal' || e.props.hasSurvey) return next(e)

    const snap = await read($, snapshot)
    if (snap === null) return next(e)

    const { total } = await read($, tokens)
    const nowMs = await read($, now)
    const { Box, Text } = $.ui.resolve(e)

    const parts: { key: string; text: string; color?: string; dim?: boolean }[] = [
      { key: 'model', text: snap.model, color: 'cyan' },
    ]
    const tok = formatTokens(total)
    if (tok) parts.push({ key: 'tok', text: tok, color: 'white' })
    if (snap.contextPercent !== null) {
      const used = Math.round(snap.contextPercent)
      parts.push({ key: 'ctx', text: `ctx:${used}% (${100 - used}% left)`, color: trafficLight(used, 'green') })
    }
    const limits = snap.rateLimits.filter(r => r.kind === 'five_hour' || r.kind === 'seven_day')
    for (const r of limits) {
      const pct = Math.round(r.percentUsed)
      const label = r.kind === 'five_hour' ? '5h' : '7d'
      const reset = r.kind === 'five_hour' ? formatReset(r.resetsAt, nowMs) : ''
      const color = trafficLight(pct, '')
      parts.push({ key: label, text: `${label}:${pct}%${reset}`, color: color || undefined, dim: !color })
    }

    return (
      <Box>
        {parts.map((p, i) => (
          <Text key={p.key} color={p.color} dimColor={p.dim}>
            {i > 0 ? ' | ' : ''}
            {p.text}
          </Text>
        ))}
      </Box>
    )
  })
}
