import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Rec, Scope, Ui } from '../types'

const PANE = 'subagent-tree'
const MAIN = 'main'
const QUIET_MS = 30_000
const MAX_HISTORY = 150
const MAX_LOG = 40

const activity = atom({ plugin: 'subagent-tree', key: 'activity' } as const, {})
const past = atom({ plugin: 'subagent-tree', key: 'past' } as const, [])
const now = atom({ plugin: 'subagent-tree', key: 'now' } as const, 0)
const collapsed = atom({ plugin: 'subagent-tree', key: 'collapsed' } as const, [])
const ui = atom({ plugin: 'subagent-tree', key: 'ui' } as const, { selected: null, scope: 'live', query: '' })

// The module's working copy; `activity` is its projection for drawing, `$.store` its memory between sessions.
let live: Record<string, Rec> = {}
let pastRecs: Rec[] = []
let sid = 0
let dirty = false
let isLight = false

// Segmented control colors: the light pair is the pattern lexicon's `.seg`; the dark pair sits just above the dark pane.
const SEG = {
  light: { track: '#DEE4EC', on: '#FFFFFF', line: '#C9D2DE' },
  dark: { track: '#262624', on: '#3B3B38', line: '#3F3F3C' },
}

async function readTheme($: EngineInterface) {
  try {
    const row = (await $.config.list()).find(r => r.key === 'theme') as { value?: unknown } | undefined
    isLight = String(row?.value ?? '').toLowerCase().startsWith('light')
  } catch {
    isLight = false
  }
}

const fresh = (id: string, t: number): Rec => ({
  id,
  sid,
  label: id === MAIN ? 'main' : id,
  type: id === MAIN ? 'main' : 'agent',
  status: 'running',
  log: [],
  lastAt: t,
  tokens: 0,
  startedAt: t,
})

const ago = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m${String(s % 60).padStart(2, '0')}` : `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`
}

const tok = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)

const shorten = (s: string, n = 40) => (s.length > n ? `…${s.slice(-(n - 1))}` : s)

const stamp = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const targetOf = (e: Record<string, unknown>) => {
  const v = e.file_path ?? e.path ?? e.command ?? e.pattern ?? e.url ?? e.query ?? e.description
  return typeof v === 'string' ? shorten(v.replace(/\s+/g, ' ')) : undefined
}

const key = (r: Rec) => `${r.sid}:${r.id}`

const push = ($: EngineInterface) => update($, activity, () => ({ ...live }))

async function bump($: EngineInterface, id: string, fn: (a: Rec, t: number) => Rec) {
  const t = await $.clock.now()
  live[id] = fn(live[id] ?? fresh(id, t), t)
  await push($)
}

async function persist($: EngineInterface) {
  const mine = Object.values(live)
  if (mine.length < 2) return
  const merged = [...pastRecs.filter(r => r.sid !== sid), ...mine].sort((a, b) => a.startedAt - b.startedAt).slice(-MAX_HISTORY)
  await $.store.set('history', merged)
  pastRecs = merged.filter(r => r.sid !== sid)
  await update($, past, () => pastRecs)
}

// Loads history and adopts the session's identity; a new session id (a /clear) files the old one away first.
async function syncSession($: EngineInterface) {
  const u = await $.session.usage()
  if (u.startedAt === sid) return
  if (sid !== 0) {
    await persist($)
    live = {}
  } else {
    const stored = ((await $.store.get('history')) as Rec[] | undefined) ?? []
    const { value } = await $.state.get({ plugin: 'subagent-tree', key: 'activity' } as const)
    const kept = Object.values(value ?? {}).filter(r => r.sid === u.startedAt)
    live = Object.fromEntries(kept.map(r => [r.id, r]))
    pastRecs = stored.filter(r => r.sid !== u.startedAt)
  }
  sid = u.startedAt
  await update($, past, () => pastRecs)
  await push($)
}

async function refresh($: EngineInterface) {
  const [list, t] = await Promise.all([$.agent.list(), $.clock.now()])
  live[MAIN] ??= fresh(MAIN, t)
  for (const a of list) {
    const c = live[a.id] ?? fresh(a.id, t)
    const isDone = a.status !== 'running'
    if (isDone && c.endedAt === undefined) dirty = true
    live[a.id] = {
      ...c,
      label: a.description || c.label,
      type: a.type,
      status: a.status,
      parentId: a.parentId ?? MAIN,
      endedAt: isDone ? (c.endedAt ?? t) : undefined,
    }
  }
  await push($)
  await update($, now, () => t)
  if (dirty) {
    dirty = false
    await persist($)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'agents', description: 'Show the subagent tree pane' })
    void $.ui.open({ id: PANE, title: 'Agents' })
    const result = await next(e)
    await readTheme($)
    await syncSession($)
    await bump($, MAIN, a => a)
    await refresh($)
    $.clock.every(1000, () => void refresh($))
    return result
  })

  on('command.run', { command: 'agents' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Agents' })
    return { text: 'Agents pane opened.' }
  })

  on('prompt.submit', async ($, e, next) => {
    await bump($, MAIN, a => ({ ...a, prompt: e.text.slice(0, 1500), title: a.title ?? e.text.replace(/\s+/g, ' ').slice(0, 60) }))
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    if ('agentId' in r && r.agentId) {
      const parent = (e as { parentAgentId?: string }).parentAgentId
      await bump($, r.agentId, a => ({ ...a, prompt: e.prompt.slice(0, 1500), label: e.description, type: e.subagentType, parentId: parent ?? MAIN }))
    }
    return r
  })

  on('tool.call', async ($, e, next) => {
    const target = targetOf(e as unknown as Record<string, unknown>)
    await bump($, e.agentId ?? MAIN, (a, t) => ({
      ...a,
      tool: e.tool,
      target,
      lastAt: t,
      log: [...a.log, { t, tool: e.tool, target }].slice(-MAX_LOG),
    }))
    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const u = result.usage
    if (u) await bump($, e.agentId ?? MAIN, a => ({ ...a, tokens: a.tokens + u.input_tokens + u.output_tokens }))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const text = result.text
    if (text) await bump($, e.agentId ?? MAIN, a => ({ ...a, report: text.slice(0, 3000) }))
    await syncSession($)
    await refresh($)
    await persist($)
    return result
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const [rawAct, rawOld, nowMs, hidden, view] = await Promise.all([read($, activity), read($, past), read($, now), read($, collapsed), read($, ui)])
    const setUi = (fn: (u: Ui) => Ui) => void update($, ui, fn)

    try {
    // State from an older version of this mod, or a store file, may lack fields: fill them in.
    const sane = (r: Rec): Rec => ({
      ...r,
      sid: r.sid ?? 0,
      label: r.label ?? r.id,
      type: r.type ?? 'agent',
      status: r.status ?? 'completed',
      log: Array.isArray(r.log) ? r.log : [],
      tokens: r.tokens ?? 0,
      startedAt: r.startedAt ?? 0,
      lastAt: r.lastAt ?? 0,
    })
    const usable = (r: Rec | null | undefined): r is Rec => !!r && typeof r.id === 'string'
    const act: Record<string, Rec> = Object.fromEntries(Object.values(rawAct ?? {}).filter(usable).map(r => [r.id, sane(r)]))
    const old: Rec[] = (rawOld ?? []).filter(usable).map(sane)

    const all: Rec[] = [...Object.values(act), ...old]
    const runtime = (r: Rec) => ago((r.endedAt ?? nowMs) - r.startedAt)

    const nav = (trail: Rec[], suffix: string) => (
      <Box key={`nav-${suffix}`}>
        <Button key={`top-${suffix}`} label="↑ Agents" plain hotkey={suffix === 'top' ? 't' : undefined} onPress={() => setUi(u => ({ ...u, selected: null }))} />
        {trail.map((r, i) => (
          <Button
            key={`bc-${suffix}-${i}`}
            label={`› ${r.id === MAIN ? 'main' : r.label}`}
            plain
            onPress={() => setUi(u => ({ ...u, selected: key(r) }))}
          />
        ))}
      </Box>
    )

    const statusColor = (r: Rec) => {
      if (r.status !== 'running') return r.status === 'completed' ? 'gray' : 'red'
      return nowMs - r.lastAt > QUIET_MS ? 'yellow' : 'green'
    }

    // ---- detail view ----
    const sel = view.selected === null ? undefined : all.find(r => key(r) === view.selected)
    if (sel) {
      const color = statusColor(sel)
      // Ancestors, outermost first, then the agent itself; breadcrumbs repeat below so neither end is far.
      const trail: Rec[] = [sel]
      for (let p = sel.parentId; p && trail.length < 8; ) {
        const up = all.find(r => r.sid === sel.sid && r.id === p)
        if (!up || trail.includes(up)) break
        trail.unshift(up)
        p = up.parentId
      }
      const children = all.filter(r => r.sid === sel.sid && r.parentId === sel.id && r.id !== sel.id)
      const room = Math.max(6, (e.viewport?.rows ?? 30) - 16)
      const lines = sel.log.slice().reverse().slice(0, room)
      return (
        <Box flexDirection="column">
          {nav(trail, 'top')}
          <Box>
            <Text color={color}>{sel.status === 'running' ? '● ' : '○ '}</Text>
            <Text bold>{sel.id === MAIN ? 'main' : `${sel.type}: ${sel.label}`}</Text>
          </Box>
          <Text dimColor>{`${sel.status} · ${tok(sel.tokens)} tok · ${runtime(sel)} · started ${stamp(sel.startedAt)}`}</Text>
          <Text bold>Prompt</Text>
          <Text>{sel.prompt ?? '(not captured)'}</Text>
          <Text bold>Result</Text>
          <Text>{sel.report ?? (sel.status === 'running' ? 'Still running…' : '(not captured)')}</Text>
          {children.length > 0 && <Text bold>{`Subagents (${children.length})`}</Text>}
          {children.map(c => (
            <Box key={`k-${key(c)}`}>
              <Text color={statusColor(c)}>{c.status === 'running' ? '● ' : '○ '}</Text>
              <Button key={`kb-${key(c)}`} label={`${c.type}: ${c.label}`} plain onPress={() => setUi(u => ({ ...u, selected: key(c) }))} />
              <Text dimColor>{`  ${tok(c.tokens)} · ${runtime(c)}`}</Text>
            </Box>
          ))}
          <Text bold>{`Activity (${lines.length} of ${sel.log.length}, newest first)`}</Text>
          {sel.log.length === 0 && <Text dimColor>No tool calls recorded.</Text>}
          {lines.map((l, i) => (
            <Text key={`l${i}`} dimColor>{`+${ago(l.t - sel.startedAt)}  ${l.tool}${l.target ? ` ${l.target}` : ''}`}</Text>
          ))}
          {nav(trail, 'bottom')}
        </Box>
      )
    }

    // ---- list view ----
    const q = view.query.trim().toLowerCase()
    const inScope = (r: Rec) => (view.scope === 'all' ? true : view.scope === 'live' ? r.sid === sid : r.sid !== sid)
    const hay = (r: Rec) =>
      [r.label, r.type, r.status, r.title, r.prompt, r.report, r.tool, r.target, ...r.log.map(l => `${l.tool} ${l.target ?? ''}`)].join(' ').toLowerCase()
    const shown = all.filter(r => inScope(r) && (q === '' || hay(r).includes(q)))

    const live_ = Object.values(act)
    const running = live_.filter(r => r.status === 'running' && r.id !== MAIN).length
    const total = live_.reduce((s, r) => s + r.tokens, 0)

    const rowFor = (r: Rec, depth: number, kids: Rec[], byParent: (id: string) => Rec[]): unknown[] => {
      const color = statusColor(r)
      const idle = nowMs - r.lastAt
      const isRun = r.status === 'running'
      const isOpen = !hidden.includes(key(r))
      const label = r.id === MAIN ? (r.sid === sid ? 'main' : `main · ${r.title ?? 'session'}`) : `${r.type}: ${r.label}`
      const last = isRun ? (r.tool ? `${r.tool}${r.target ? ` ${r.target}` : ''}` : 'starting…') : `${r.status}${r.tool ? ` · ${r.tool}` : ''}`
      const out: unknown[] = [
        <Box key={key(r)} flexDirection="column" paddingLeft={depth * 2}>
          <Box>
            {kids.length > 0 ? (
              <Button
                key={`t-${key(r)}`}
                label={isOpen ? '▾' : '▸'}
                plain
                onPress={() => void update($, collapsed, (c: string[]) => (c.includes(key(r)) ? c.filter(i => i !== key(r)) : [...c, key(r)]))}
              />
            ) : (
              <Text> </Text>
            )}
            <Text color={color}>{isRun && idle <= QUIET_MS ? '● ' : '○ '}</Text>
            <Button key={`o-${key(r)}`} label={label} plain onPress={() => setUi(u => ({ ...u, selected: key(r) }))} />
            <Text dimColor>{`  ${tok(r.tokens)} · ${runtime(r)}`}</Text>
          </Box>
          <Box paddingLeft={4}>
            <Text dimColor>{last}</Text>
            {r.sid === sid && (
              <Text color={color === 'yellow' ? 'yellow' : undefined} dimColor={color !== 'yellow'}>{`  ${ago(idle)} ago${color === 'yellow' ? ' · quiet' : ''}`}</Text>
            )}
          </Box>
        </Box>,
      ]
      if (isOpen) for (const c of kids) out.push(...rowFor(c, depth + 1, byParent(c.id), byParent))
      return out
    }

    // Groups by session, the current one first; a search lists matches flat.
    const sessions = [...new Set(shown.map(r => r.sid))].sort((a, b) => (a === sid ? -1 : b === sid ? 1 : b - a))
    const body: unknown[] = []
    if (shown.length === 0) {
      body.push(<Text key="none" dimColor>{q ? 'No agents match.' : view.scope === 'past' ? 'No past agents saved yet.' : 'No agents yet.'}</Text>)
    } else if (q !== '') {
      for (const r of shown) body.push(...rowFor(r, 0, [], () => []))
    } else {
      for (const s of sessions) {
        const group = shown.filter(r => r.sid === s)
        const ids = new Set(group.map(r => r.id))
        const byParent = (id: string) => group.filter(r => r.parentId === id && r.id !== id)
        const roots = group.filter(r => !r.parentId || !ids.has(r.parentId))
        if (s !== sid) {
          const title = group.find(r => r.id === MAIN)?.title ?? 'session'
          body.push(<Text key={`h${s}`} dimColor>{`${stamp(s)} · ${title} · ${group.length} agents`}</Text>)
        }
        for (const r of roots) body.push(...rowFor(r, 0, byParent(r.id), byParent))
      }
    }

    const seg = isLight ? SEG.light : SEG.dark
    const chip = (scope: Scope, label: string) => (
      <Box
        key={`seg-${scope}`}
        backgroundColor={view.scope === scope ? seg.on : undefined}
        borderStyle="round"
        borderColor={seg.line}
        borderDimColor
        hover={{ borderDimColor: false }}
        padding={0}
      >
        <Button
          key={`c-${scope}`}
          label={label}
          plain
          dimColor={view.scope !== scope}
          onPress={() => setUi(u => ({ ...u, scope }))}
        />
      </Box>
    )

    return (
      <Box flexDirection="column">
        <Box>
          <Text bold>Agents</Text>
          <Text dimColor>{`  ${running} running · Σ ${tok(total)} tok · ${old.length} saved`}</Text>
        </Box>
        <Box backgroundColor={seg.track} borderStyle="round" borderColor={seg.line} alignSelf="flex-start">
          {chip('live', 'Live')}
          {chip('past', 'Past')}
          {chip('all', 'All')}
        </Box>
        <Input
          key="q"
          placeholder="Search agents, tools, prompts…"
          value={view.query}
          onInput={v => setUi(u => ({ ...u, query: v }))}
          onSubmit={() => {}}
        />
        {body}
      </Box>
    )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return (
        <Box flexDirection="column">
          <Button key="top-err" label="↑ Agents" plain onPress={() => setUi(u => ({ ...u, selected: null }))} />
          <Text color="red">{`subagent-tree failed to draw: ${msg}`}</Text>
        </Box>
      )
    }
  })
}
