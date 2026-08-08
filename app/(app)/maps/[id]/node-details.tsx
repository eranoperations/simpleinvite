'use client'

import type { MapEdgeDto, MapNodeDto } from '@/lib/api/serialize'
import { statusCodeClass } from '@/lib/ui'

/**
 * The side panel answers the question the graph raises: what is this page, and
 * exactly which controls lead in and out of it.
 */
export function NodeDetails({
  node,
  edges,
  nodes,
  onClose,
}: {
  node: MapNodeDto
  edges: MapEdgeDto[]
  nodes: MapNodeDto[]
  onClose: () => void
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = edges.filter((e) => e.from === node.id)
  const incoming = edges.filter((e) => e.to === node.id)

  return (
    <aside className="w-[340px] shrink-0 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/60 p-4 [max-height:calc(100vh-320px)]">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-100">{node.title || node.path}</h2>
        <button
          onClick={onClose}
          aria-label="Close details"
          className="shrink-0 rounded px-1.5 text-slate-500 hover:text-slate-200"
        >
          ✕
        </button>
      </div>

      <a
        href={node.url}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-1 block break-all text-xs text-sky-400 hover:text-sky-300"
      >
        {node.url}
      </a>

      {node.screenshotUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={node.screenshotUrl}
          alt={`Screenshot of ${node.path}`}
          className="mt-3 w-full rounded-lg border border-slate-800"
        />
      )}

      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Stat label="Status">
          <span className={statusCodeClass(node.statusCode)}>{node.statusCode || '—'}</span>
        </Stat>
        <Stat label="Load time">{node.loadTimeMs ? `${node.loadTimeMs}ms` : '—'}</Stat>
        <Stat label="Depth">{node.depth}</Stat>
        <Stat label="Forms">{node.formCount}</Stat>
      </dl>

      {node.error && (
        <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {node.error}
        </p>
      )}

      {node.consoleErrors.length > 0 && (
        <section className="mt-4">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Console errors
          </h3>
          <ul className="mt-2 space-y-1">
            {node.consoleErrors.slice(0, 8).map((error, i) => (
              <li key={i} className="break-words rounded bg-slate-950 px-2 py-1 text-[11px] text-rose-300">
                {error}
              </li>
            ))}
          </ul>
        </section>
      )}

      <EdgeList
        title={`Leads to (${outgoing.length})`}
        edges={outgoing}
        resolve={(e) => byId.get(e.to)}
      />
      <EdgeList
        title={`Reached from (${incoming.length})`}
        edges={incoming}
        resolve={(e) => byId.get(e.from)}
      />
    </aside>
  )
}

function EdgeList({
  title,
  edges,
  resolve,
}: {
  title: string
  edges: MapEdgeDto[]
  resolve: (edge: MapEdgeDto) => MapNodeDto | undefined
}) {
  if (!edges.length) return null

  return (
    <section className="mt-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</h3>
      <ul className="mt-2 space-y-1.5">
        {edges.slice(0, 25).map((edge) => (
          <li key={edge.id} className="rounded-lg bg-slate-950 px-2.5 py-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                  edge.kind === 'button'
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {edge.kind}
              </span>
              <span className="truncate text-[11px] text-slate-200">{edge.label || '—'}</span>
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slate-500">
              {resolve(edge)?.path ?? 'unknown'}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-950 px-2.5 py-1.5">
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-200">{children}</dd>
    </div>
  )
}
