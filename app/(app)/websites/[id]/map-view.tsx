'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import type { MapEdgeDto, MapNodeDto, MapSummaryDto } from '@/lib/api/serialize'
import { formatDuration, formatWhen, statusClass } from '@/lib/ui'
import { layoutGraph } from './layout-graph'
import { PageNode, type PageNodeData } from './page-node'
import { NodeDetails } from './node-details'

interface Graph {
  nodes: MapNodeDto[]
  edges: MapEdgeDto[]
}

interface ProfileOption {
  id: string
  label: string
  description: string
}

const nodeTypes = { page: PageNode }

type EdgeFilter = 'all' | 'link' | 'button'

function signInValue(map: MapSummaryDto): string {
  if (map.testUserId) return `testUser:${map.testUserId}`
  if (map.loginScenarioId) return `scenario:${map.loginScenarioId}`
  return ''
}

export function MapView({
  websiteId,
  initialMap,
  initialGraph,
  profiles,
  loginScenarios,
  testUsers,
}: {
  websiteId: string
  initialMap: MapSummaryDto
  initialGraph: Graph
  profiles: ProfileOption[]
  loginScenarios: { id: string; name: string }[]
  testUsers: { id: string; name: string }[]
}) {
  const [map, setMap] = useState(initialMap)
  const [graph, setGraph] = useState(initialGraph)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [edgeFilter, setEdgeFilter] = useState<EdgeFilter>('all')
  const [showExternal, setShowExternal] = useState(false)
  const [hideNav, setHideNav] = useState(true)
  const [search, setSearch] = useState('')

  const [depthProfile, setDepthProfile] = useState(initialMap.depthProfile)
  const [signIn, setSignIn] = useState(signInValue(initialMap))
  const [crawlBusy, setCrawlBusy] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const live = map.status === 'queued' || map.status === 'running'
  const [signInKind, signInId] = signIn.includes(':') ? signIn.split(':') : [null, null]

  // While the crawl runs, re-read the whole graph so the map visibly grows.
  useEffect(() => {
    if (!live) return
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/websites/${websiteId}/map`)
        if (!res.ok) return
        const data = await res.json()
        setMap(data.map)
        setGraph(data.graph)
      } catch {
        // A dropped poll is not worth surfacing; the next tick retries.
      }
    }, 2000)
    return () => clearInterval(timer)
  }, [live, websiteId])

  async function startCrawl() {
    setCrawlBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/websites/${websiteId}/map/crawl`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          depthProfile,
          loginScenarioId: signInKind === 'scenario' ? signInId : null,
          testUserId: signInKind === 'testUser' ? signInId : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActionError(data.error ?? 'Could not start the crawl.')
        return
      }
      const poll = await fetch(`/api/websites/${websiteId}/map`)
      if (poll.ok) {
        const fresh = await poll.json()
        setMap(fresh.map)
        setGraph(fresh.graph)
      }
    } catch {
      setActionError('Could not reach the server.')
    } finally {
      setCrawlBusy(false)
    }
  }

  async function cancelCrawl() {
    setCancelBusy(true)
    try {
      await fetch(`/api/websites/${websiteId}/map/cancel`, { method: 'POST' })
    } finally {
      setCancelBusy(false)
    }
  }

  async function clearMapNow() {
    if (!window.confirm('Clear this map? All pages and connections will be removed.')) return
    setClearBusy(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/websites/${websiteId}/map/clear`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActionError(data.error ?? 'Could not clear the map.')
        return
      }
      setMap((m) => ({
        ...m,
        status: 'idle',
        progress: { current: 0, total: 0, message: 'Not mapped yet' },
        error: null,
        stats: null,
        finishedAt: null,
      }))
      setGraph({ nodes: [], edges: [] })
      setSelectedId(null)
    } catch {
      setActionError('Could not reach the server.')
    } finally {
      setClearBusy(false)
    }
  }

  const visibleNodes = useMemo(
    () => graph.nodes.filter((n) => showExternal || n.kind !== 'external'),
    [graph.nodes, showExternal],
  )

  /**
   * A header or footer that links every page to every other page turns the map
   * into a hairball — n pages produce n² edges that say nothing about
   * structure. Targets reachable from most pages are site-wide navigation;
   * hiding all but their edge from the entry page restores the real shape
   * without orphaning anything.
   */
  const navEdgeIds = useMemo(() => {
    const pages = graph.nodes.filter((n) => n.kind === 'page')
    if (pages.length < 4) return new Set<string>()

    const pageIds = new Set(pages.map((n) => n.id))
    const entry = graph.nodes.reduce<MapNodeDto | null>(
      (best, n) => (!best || n.depth < best.depth ? n : best),
      null,
    )

    const sources = new Map<string, Set<string>>()
    for (const edge of graph.edges) {
      if (edge.kind !== 'link' || !pageIds.has(edge.from)) continue
      if (!sources.has(edge.to)) sources.set(edge.to, new Set())
      sources.get(edge.to)!.add(edge.from)
    }

    const threshold = Math.max(3, Math.ceil(pages.length * 0.6))
    const navTargets = new Set(
      [...sources].filter(([, from]) => from.size >= threshold).map(([to]) => to),
    )

    return new Set(
      graph.edges
        .filter(
          (e) => e.kind === 'link' && navTargets.has(e.to) && e.from !== entry?.id,
        )
        .map((e) => e.id),
    )
  }, [graph.nodes, graph.edges])

  const { nodes, edges } = useMemo(() => {
    const visibleIds = new Set(visibleNodes.map((n) => n.id))
    const query = search.trim().toLowerCase()

    const flowEdges: Edge[] = graph.edges
      .filter((e) => edgeFilter === 'all' || e.kind === edgeFilter)
      .filter((e) => !hideNav || !navEdgeIds.has(e.id))
      .filter((e) => visibleIds.has(e.from) && visibleIds.has(e.to))
      .map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
        label: e.label,
        // Dashed and violet marks a connection that only exists behind a click —
        // the ones a link-only crawler never finds. Dashed emerald marks one a
        // scenario walked onto, rather than the crawl itself.
        animated: false,
        style:
          e.kind === 'button'
            ? { stroke: '#a78bfa', strokeWidth: 1.5, strokeDasharray: '5 4' }
            : e.kind === 'redirect'
              ? { stroke: '#f59e0b', strokeWidth: 1.2, strokeDasharray: '2 3' }
              : e.kind === 'scenario'
                ? { stroke: '#34d399', strokeWidth: 1.5, strokeDasharray: '1 4' }
                : { stroke: '#475569', strokeWidth: 1.2 },
        labelStyle: {
          fill:
            e.kind === 'button'
              ? '#c4b5fd'
              : e.kind === 'redirect'
                ? '#fcd34d'
                : e.kind === 'scenario'
                  ? '#6ee7b7'
                  : '#cbd5e1',
          fontSize: 10,
        },
        labelBgStyle: { fill: '#0b0f19', fillOpacity: 0.85 },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 3,
      }))

    const flowNodes: Node[] = visibleNodes.map((n) => ({
      id: n.id,
      type: 'page',
      position: { x: 0, y: 0 },
      data: {
        title: n.title,
        path: n.path,
        statusCode: n.statusCode,
        kind: n.kind,
        screenshotUrl: n.screenshotUrl,
        errorCount: n.consoleErrors.length + (n.error ? 1 : 0),
        dimmed: Boolean(
          query && !`${n.title} ${n.path} ${n.url}`.toLowerCase().includes(query),
        ),
      } satisfies PageNodeData,
    }))

    return { nodes: layoutGraph(flowNodes, flowEdges), edges: flowEdges }
  }, [visibleNodes, graph.edges, edgeFilter, search, hideNav, navEdgeIds])

  const onNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    setSelectedId(node.id)
  }, [])

  const selected = graph.nodes.find((n) => n.id === selectedId) ?? null
  const buttonEdgeCount = graph.edges.filter((e) => e.kind === 'button').length
  const scenarioEdgeCount = graph.edges.filter((e) => e.kind === 'scenario').length
  const everMapped = map.status !== 'idle' || graph.nodes.length > 0

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-2 py-0.5 text-xs ring-1 ${statusClass(map.status)}`}>
            {map.status === 'idle' ? 'not mapped' : map.status}
          </span>
          {map.authenticated && (
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-300 ring-1 ring-violet-500/40">
              signed in
            </span>
          )}
        </div>

        <div className="text-right text-sm text-slate-400">
          <div>
            {graph.nodes.filter((n) => n.kind === 'page').length} pages ·{' '}
            {graph.edges.length} connections
            {buttonEdgeCount > 0 && (
              <span className="text-violet-300"> ({buttonEdgeCount} via buttons)</span>
            )}
            {scenarioEdgeCount > 0 && (
              <span className="text-emerald-300"> ({scenarioEdgeCount} found by scenarios)</span>
            )}
          </div>
          {map.finishedAt && (
            <div className="mt-0.5 text-xs text-slate-500">
              {formatWhen(map.finishedAt)}
              {map.stats?.durationMs ? ` · took ${formatDuration(map.stats.durationMs)}` : ''}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <label className="block">
          <span className="mb-1.5 block text-xs text-slate-400">How deep</span>
          <select
            value={depthProfile}
            onChange={(e) => setDepthProfile(e.target.value)}
            disabled={live}
            className={SELECT}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id} title={p.description}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs text-slate-400">Sign in first</span>
          <select
            value={signIn}
            onChange={(e) => setSignIn(e.target.value)}
            disabled={live}
            className={SELECT}
          >
            <option value="">Crawl as a signed-out visitor</option>
            {testUsers.length > 0 && (
              <optgroup label="Test users">
                {testUsers.map((t) => (
                  <option key={t.id} value={`testUser:${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
            {loginScenarios.length > 0 && (
              <optgroup label="Sign-in scenarios">
                {loginScenarios.map((s) => (
                  <option key={s.id} value={`scenario:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-2">
          {live ? (
            <button
              onClick={cancelCrawl}
              disabled={cancelBusy}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-rose-500 hover:text-rose-300 disabled:opacity-50"
            >
              {cancelBusy ? 'Cancelling…' : 'Cancel'}
            </button>
          ) : (
            <button
              onClick={startCrawl}
              disabled={crawlBusy}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
            >
              {crawlBusy ? 'Starting…' : everMapped ? 'Update map' : 'Start mapping'}
            </button>
          )}
          <button
            onClick={clearMapNow}
            disabled={live || clearBusy || graph.nodes.length === 0}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-rose-500 hover:text-rose-300 disabled:opacity-50"
          >
            {clearBusy ? 'Clearing…' : 'Clear map'}
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {actionError}
        </div>
      )}
      {live && (
        <div className="mt-4 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm text-sky-200">
          {map.progress.message} — {map.progress.current} of {map.progress.total} pages
        </div>
      )}
      {map.error && (
        <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {map.error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a page…"
          className="w-56 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-100 outline-none focus:border-sky-500"
        />

        <div className="flex rounded-lg border border-slate-700 p-0.5">
          {(['all', 'link', 'button'] as EdgeFilter[]).map((value) => (
            <button
              key={value}
              onClick={() => setEdgeFilter(value)}
              className={`rounded-md px-3 py-1 capitalize ${
                edgeFilter === value ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {value === 'all' ? 'All links' : value === 'link' ? 'Links' : 'Buttons'}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-slate-400">
          <input
            type="checkbox"
            checked={showExternal}
            onChange={(e) => setShowExternal(e.target.checked)}
          />
          Show external sites
        </label>

        <label
          className="flex items-center gap-2 text-slate-400"
          title="Hides header and footer links that appear on nearly every page, keeping one edge from the entry page"
        >
          <input
            type="checkbox"
            checked={hideNav}
            onChange={(e) => setHideNav(e.target.checked)}
          />
          Collapse site-wide nav
          {navEdgeIds.size > 0 && (
            <span className="text-xs text-slate-600">({navEdgeIds.size} hidden)</span>
          )}
        </label>

        <span className="ml-auto flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-6 bg-slate-500" /> link
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-px w-6"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg,#a78bfa 0 5px,transparent 5px 9px)' }}
            />
            button
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-px w-6"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg,#f59e0b 0 2px,transparent 2px 5px)' }}
            />
            redirect
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-px w-6"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg,#34d399 0 1px,transparent 1px 5px)' }}
            />
            scenario
          </span>
        </span>
      </div>

      <div className="mt-4 flex gap-4">
        <div className="h-[calc(100vh-420px)] min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
          {nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              {live
                ? 'Waiting for the first pages…'
                : everMapped
                  ? 'No pages were mapped.'
                  : 'Not mapped yet — configure sign-in above if this site needs it, then click Start mapping.'}
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelectedId(null)}
              fitView
              minZoom={0.1}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#1e293b" gap={20} />
              <Controls />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n) =>
                  (n.data as PageNodeData)?.kind === 'page' ? '#38bdf8' : '#475569'
                }
                maskColor="rgba(2,6,23,0.75)"
              />
            </ReactFlow>
          )}
        </div>

        {selected && (
          <NodeDetails
            node={selected}
            edges={graph.edges}
            nodes={graph.nodes}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  )
}

const SELECT =
  'rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 ' +
  'outline-none focus:border-sky-500 disabled:opacity-50'
