'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { statusCodeClass } from '@/lib/ui'

export interface PageNodeData extends Record<string, unknown> {
  title: string
  path: string
  statusCode: number
  kind: string
  screenshotUrl: string | null
  errorCount: number
  dimmed: boolean
  [key: string]: unknown
}

const KIND_LABEL: Record<string, string> = {
  external: 'external',
  unvisited: 'not crawled',
}

/**
 * A thumbnail makes the map recognizable at a glance — you find the page you
 * mean by its shape, long before you can read its path.
 */
export function PageNode({ data, selected }: NodeProps) {
  const node = data as PageNodeData
  const isPage = node.kind === 'page'

  return (
    <div
      className={`w-[240px] overflow-hidden rounded-xl border bg-slate-900 transition-opacity ${
        selected ? 'border-sky-400 ring-2 ring-sky-400/40' : 'border-slate-700'
      } ${node.dimmed ? 'opacity-25' : 'opacity-100'}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-500" />

      <div className="relative h-[112px] bg-slate-800">
        {node.screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={node.screenshotUrl}
            alt=""
            className="h-full w-full object-cover object-top"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            {KIND_LABEL[node.kind] ?? 'no screenshot'}
          </div>
        )}

        {node.errorCount > 0 && (
          <span className="absolute right-2 top-2 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {node.errorCount} error{node.errorCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="px-3 py-2">
        <div className="truncate text-xs font-medium text-slate-100">
          {node.title || node.path}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-slate-500">{node.path}</span>
          <span className={`shrink-0 text-[11px] ${statusCodeClass(node.statusCode)}`}>
            {isPage ? node.statusCode || '—' : (KIND_LABEL[node.kind] ?? '')}
          </span>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-slate-500" />
    </div>
  )
}
