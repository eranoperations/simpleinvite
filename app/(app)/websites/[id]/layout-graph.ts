import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'

export const NODE_WIDTH = 240
export const NODE_HEIGHT = 168

/**
 * Dagre ranks the graph left-to-right, which reads naturally for a site: the
 * entry page sits on the left and each click moves one rank right. Positions
 * are computed once per data change rather than per render — the layout is
 * deterministic, so recomputing on every frame would only cost time.
 */
export function layoutGraph(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: 'LR', ranksep: 140, nodesep: 40, marginx: 40, marginy: 40 })

  for (const node of nodes) {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    // Dagre throws if an edge names a node it was never given.
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target)
    }
  }

  dagre.layout(graph)

  return nodes.map((node) => {
    const positioned = graph.node(node.id)
    return {
      ...node,
      // Dagre reports a center point; React Flow positions from the top-left.
      position: positioned
        ? { x: positioned.x - NODE_WIDTH / 2, y: positioned.y - NODE_HEIGHT / 2 }
        : { x: 0, y: 0 },
    }
  })
}
