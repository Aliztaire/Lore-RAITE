'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  ZoomIn, ZoomOut, Maximize2, Sparkles, Loader2,
  Plus, FileText, Lightbulb, BookMarked,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBuddyStore } from '@/lib/store'
import type { CanvasNode, CanvasEdge } from '@/lib/types'

// ─── Visual config ─────────────────────────────────────────────────────────
const NODE_R = { section: 13, concept: 8, evidence: 9 }
const NODE_FILL = { section: '#d4547a', concept: '#7fabd4', evidence: '#3dab68' }
const EDGE_COLORS: Record<string, string> = {
  supports:    '#3dab68',
  contradicts: '#d63e5a',
  references:  '#94a3b8',
  elaborates:  '#d4547a',
}

const genId = () => Math.random().toString(36).substring(2, 15)

// Extract a 2-word keyword label from paragraph text
function shortLabel(text: string): string {
  const STOP = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from',
    'is','are','was','were','be','been','have','has','had','that','this','these','those',
    'it','its','we','they','our','their','as','not','which','who','also','can','such',
    'study','research','found','shows','suggests','however','therefore','thus','while',
    'more','most','other','both','each','many','some','may','might','would','could',
    'should','will','use','used','using','based','about','than','then',
  ])
  const words = text
    .replace(/[^a-zA-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP.has(w.toLowerCase()))
  return words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Paragraph'
}

// ─── Force simulation constants ────────────────────────────────────────────
const K_REPEL      = 5500
const K_SPRING     = 0.038
const IDEAL_STRUCT = 130
const IDEAL_CROSS  = 230
const K_CENTER     = 0.0025
const DAMPING      = 0.8

interface SimNode { x: number; y: number; vx: number; vy: number }

interface NodeCanvasProps {
  onNodeDoubleClick?: (nodeId: string) => void
  isMiniMap?: boolean
}

export function NodeCanvas({ onNodeDoubleClick, isMiniMap = false }: NodeCanvasProps) {
  const { getCurrentProject, updateNode, addNode, selectSection, setViewMode, updateProject } = useBuddyStore()
  const project = getCurrentProject()

  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(isMiniMap ? 0.35 : 0.9)
  const [pan, setPan] = useState({ x: 400, y: 300 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [, forceUpdate] = useState(0)

  const simRef = useRef<Map<string, SimNode>>(new Map())
  const rafRef = useRef<number | null>(null)
  const nodesRef     = useRef<CanvasNode[]>([])
  const edgesRef     = useRef<CanvasEdge[]>([])
  const updateNodeRef = useRef(updateNode)

  const nodes = project?.nodes || []
  const edges = project?.edges || []

  useEffect(() => { nodesRef.current     = nodes   }, [nodes])
  useEffect(() => { edgesRef.current     = edges   }, [edges])
  useEffect(() => { updateNodeRef.current = updateNode }, [updateNode])

  // Center pan on mount
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (width > 0) setPan({ x: width / 2, y: height / 2 })
  }, [])

  // Sync new nodes into simRef
  useEffect(() => {
    const sim = simRef.current
    nodes.forEach(n => {
      if (!sim.has(n.id)) sim.set(n.id, { x: n.x || 0, y: n.y || 0, vx: 0, vy: 0 })
    })
    const ids = new Set(nodes.map(n => n.id))
    sim.forEach((_, id) => { if (!ids.has(id)) sim.delete(id) })
  }, [nodes])

  // ─── Simulation loop ──────────────────────────────────────────────────────
  const runSimLoop = useCallback(() => {
    const sim = simRef.current
    const ns  = nodesRef.current
    const es  = edgesRef.current
    let maxV = 0

    ns.forEach(n => {
      const s = sim.get(n.id)
      if (!s) return
      let fx = 0, fy = 0

      ns.forEach(o => {
        if (o.id === n.id) return
        const os = sim.get(o.id)
        if (!os) return
        let dx = s.x - os.x, dy = s.y - os.y
        const d2 = dx * dx + dy * dy
        if (d2 < 0.01) { dx = (Math.random() - 0.5) * 2; dy = (Math.random() - 0.5) * 2 }
        const d = Math.sqrt(Math.max(d2, 0.01))
        fx += (dx / d) * K_REPEL / Math.max(d2, 100)
        fy += (dy / d) * K_REPEL / Math.max(d2, 100)
      })

      es.forEach(edge => {
        const otherId = edge.source === n.id ? edge.target : edge.target === n.id ? edge.source : null
        if (!otherId) return
        const os = sim.get(otherId)
        if (!os) return
        const dx = os.x - s.x, dy = os.y - s.y
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const ideal = edge.label === 'elaborates' ? IDEAL_STRUCT : IDEAL_CROSS
        const f = (d - ideal) * K_SPRING
        fx += (dx / d) * f; fy += (dy / d) * f
      })

      fx += -s.x * K_CENTER; fy += -s.y * K_CENTER

      s.vx = (s.vx + fx) * DAMPING
      s.vy = (s.vy + fy) * DAMPING
      s.x += s.vx; s.y += s.vy
      maxV = Math.max(maxV, Math.abs(s.vx), Math.abs(s.vy))
    })

    forceUpdate(t => t + 1)

    if (maxV > 0.25) {
      rafRef.current = requestAnimationFrame(runSimLoop)
    } else {
      sim.forEach((sn, id) => {
        const node = nodesRef.current.find(n => n.id === id)
        if (node && (Math.abs(node.x - sn.x) > 2 || Math.abs(node.y - sn.y) > 2)) {
          updateNodeRef.current(id, { x: Math.round(sn.x), y: Math.round(sn.y) })
        }
      })
    }
  }, [])

  const startSim = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(runSimLoop)
  }, [runSimLoop])

  useEffect(() => {
    if (nodes.length > 1) startSim()
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length])

  // ─── Live outline content ─────────────────────────────────────────────────
  const getSectionParagraphs = useCallback((sectionId: string): string[] => {
    if (!project) return []
    const section =
      project.outline.introduction.id === sectionId ? project.outline.introduction :
      project.outline.conclusion.id   === sectionId ? project.outline.conclusion :
      project.outline.body.find(s => s.id === sectionId)
    if (!section?.content?.trim()) return []
    return section.content.trim().split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 15)
  }, [project])

  const liveNodeIds = useMemo(() => {
    const valid = new Set<string>()
    nodes.forEach(node => {
      if (node.data?.paragraphIndex === undefined) { valid.add(node.id); return }
      const paras = getSectionParagraphs(node.sectionId!)
      if (node.data.paragraphIndex < paras.length) valid.add(node.id)
    })
    return valid
  }, [nodes, getSectionParagraphs])

  // ─── Generate nodes + AI connections ─────────────────────────────────────
  const generateAndAnalyze = useCallback(async () => {
    if (!project) return
    setIsAnalyzing(true)
    try {
      const allSections = [project.outline.introduction, ...project.outline.body, project.outline.conclusion]
      const newNodes: CanvasNode[] = []
      const paragraphItems: Array<{
        id: string; sectionId: string; sectionTitle: string; paragraphIndex: number; content: string
      }> = []

      allSections.forEach(section => {
        newNodes.push({ id: section.id, type: 'section', label: section.title, x: 0, y: 0, sectionId: section.id, location: section.title })
        const content = section.content?.trim()
        if (!content) return
        const paragraphs = content.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 15)
        paragraphs.forEach((para, paraIdx) => {
          const paraId = `${section.id}-p${paraIdx}`
          newNodes.push({
            id: paraId, type: 'concept',
            label: shortLabel(para),
            x: 0, y: 0, sectionId: section.id,
            location: `${section.title} · Para ${paraIdx + 1}`,
            data: { content: para, paragraphIndex: paraIdx },
          })
          paragraphItems.push({ id: paraId, sectionId: section.id, sectionTitle: section.title, paragraphIndex: paraIdx, content: para })
        })
      })

      const structuralEdges: CanvasEdge[] = []
      newNodes.forEach(node => {
        if (node.data?.paragraphIndex !== undefined && node.sectionId) {
          structuralEdges.push({ id: genId(), source: node.sectionId, target: node.id, label: 'elaborates' })
        }
      })

      let crossEdges: CanvasEdge[] = []
      try {
        const res = await fetch('/api/analyze-connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paragraphs: paragraphItems }),
        })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data) && data.length > 0) {
            crossEdges = data.map((e: any) => ({
              id: genId(), source: e.source, target: e.target,
              label: e.label || 'references', description: e.description,
            }))
          }
        }
      } catch (e) { console.warn('HuggingFace failed, using keyword fallback:', e) }

      if (crossEdges.length === 0 && paragraphItems.length >= 2) {
        const STOP = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','may','might','that','this','these','those','it','its','we','they','our','their','as','not','no','which','who','what','when','where','how','all','each','both','more','most','other','into','through','during','before','after','also','can','such','than','then','used','using','based'])
        const getKw = (t: string) => new Set(t.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w)))
        const overlap = (a: Set<string>, b: Set<string>) => { let n = 0; a.forEach(w => { if (b.has(w)) n++ }); return n / Math.max(Math.min(a.size, b.size), 1) }
        const sharedDesc = (a: Set<string>, b: Set<string>) => { const s = [...a].filter(w => b.has(w)).slice(0, 4); return s.length ? `Shared: ${s.join(', ')}` : 'Related concepts' }
        const kw = paragraphItems.map(p => getKw(p.content))
        const scored: { score: number; src: string; tgt: string; desc: string }[] = []
        paragraphItems.forEach((src, i) => paragraphItems.forEach((tgt, j) => {
          if (i >= j || src.sectionId === tgt.sectionId) return
          const score = overlap(kw[i], kw[j])
          if (score >= 0.12) scored.push({ score, src: src.id, tgt: tgt.id, desc: sharedDesc(kw[i], kw[j]) })
        }))
        scored.sort((a, b) => b.score - a.score)
        scored.slice(0, 8).forEach(({ src, tgt, score, desc }) => {
          const label: CanvasEdge['label'] = score >= 0.35 ? 'supports' : score >= 0.2 ? 'elaborates' : 'references'
          crossEdges.push({ id: genId(), source: src, target: tgt, label, description: desc })
        })
      }

      newNodes.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / newNodes.length
        const r = 160 + Math.random() * 50
        n.x = Math.cos(angle) * r
        n.y = Math.sin(angle) * r
      })

      const newSim = new Map<string, SimNode>()
      newNodes.forEach(n => newSim.set(n.id, { x: n.x, y: n.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4 }))
      simRef.current = newSim

      updateProject(project.id, { nodes: newNodes, edges: [...structuralEdges, ...crossEdges] })
    } finally {
      setIsAnalyzing(false)
    }
  }, [project, updateProject])

  // ─── Interaction handlers ─────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.min(Math.max(z * (e.deltaY > 0 ? 0.9 : 1.1), 0.15), 4))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return
    setIsPanning(true)
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    setSelectedNode(null)
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    if (draggingNode) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const wx = (e.clientX - rect.left - pan.x) / zoom
        const wy = (e.clientY - rect.top  - pan.y) / zoom
        const s = simRef.current.get(draggingNode)
        if (s) { s.x = wx - dragOffset.x; s.y = wy - dragOffset.y; s.vx = 0; s.vy = 0 }
        forceUpdate(t => t + 1)
      }
    }
  }, [isPanning, panStart, draggingNode, dragOffset, pan, zoom])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
    if (draggingNode) startSim()
    setDraggingNode(null)
  }, [draggingNode, startSim])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    const rect = containerRef.current?.getBoundingClientRect()
    const s = simRef.current.get(nodeId)
    if (rect && s) {
      setDragOffset({
        x: (e.clientX - rect.left - pan.x) / zoom - s.x,
        y: (e.clientY - rect.top  - pan.y) / zoom - s.y,
      })
    }
    setDraggingNode(nodeId)
    setSelectedNode(nodeId)
  }, [pan, zoom])

  const handleNodeDoubleClick = useCallback((nodeId: string, node: CanvasNode) => {
    if (node.sectionId) { selectSection(node.sectionId); setViewMode('writing') }
    onNodeDoubleClick?.(nodeId)
  }, [selectSection, setViewMode, onNodeDoubleClick])

  const addNewNode = (type: CanvasNode['type']) => {
    const id = genId()
    addNode({ id, type, label: type === 'section' ? 'New Section' : type === 'concept' ? 'New Concept' : 'New Evidence', x: 0, y: 0 })
    simRef.current.set(id, { x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200, vx: 0, vy: 0 })
    startSim()
  }

  if (!project) {
    if (isMiniMap) return null
    return (
      <div className="flex-1 flex items-center justify-center bg-canvas-bg">
        <p className="text-muted-foreground">Select or create a project to view the canvas</p>
      </div>
    )
  }

  const hasSectionContent = [project.outline.introduction, ...project.outline.body, project.outline.conclusion].some(s => s.content?.trim())

  // Tooltip: hovered takes priority, falls back to selected (info stays on click)
  const tooltipNodeId   = hoveredNode ?? selectedNode
  const tooltipNodeData = tooltipNodeId ? nodes.find(n => n.id === tooltipNodeId) : null
  const tooltipSim      = tooltipNodeId ? simRef.current.get(tooltipNodeId) : null
  const tooltipIsPara   = tooltipNodeData?.data?.paragraphIndex !== undefined
  const tooltipContent  = tooltipIsPara && tooltipNodeData?.sectionId
    ? getSectionParagraphs(tooltipNodeData.sectionId)[tooltipNodeData.data!.paragraphIndex!]
    : null

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${isMiniMap ? 'bg-transparent' : 'bg-canvas-bg'}`}>
      {/* Toolbar */}
      {!isMiniMap && (
        <div className="h-12 border-b border-border bg-card/50 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2"><Plus className="h-4 w-4" />Add Node</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => addNewNode('section')}><FileText   className="h-4 w-4 mr-2" /> Section</DropdownMenuItem>
                <DropdownMenuItem onClick={() => addNewNode('concept')}><Lightbulb  className="h-4 w-4 mr-2" /> Concept</DropdownMenuItem>
                <DropdownMenuItem onClick={() => addNewNode('evidence')}><BookMarked className="h-4 w-4 mr-2" /> Evidence</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-4 w-px bg-border" />

            <Button
              variant="default" size="sm" className="gap-2"
              disabled={isAnalyzing || !hasSectionContent}
              onClick={generateAndAnalyze}
              title={!hasSectionContent ? 'Write content in sections first' : 'Generate paragraph nodes and find connections'}
            >
              {isAnalyzing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>
                : <><Sparkles className="h-4 w-4" /> Analyze Connections</>}
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(z * 1.2, 4))}><ZoomIn  className="h-4 w-4" /></Button>
            <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(z * 0.8, 0.15))}><ZoomOut className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => {
              setZoom(0.9)
              const el = containerRef.current
              if (el) { const { width, height } = el.getBoundingClientRect(); setPan({ x: width / 2, y: height / 2 }) }
            }}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden select-none ${isMiniMap ? '' : 'cursor-grab active:cursor-grabbing'}`}
        onWheel={isMiniMap ? undefined : handleWheel}
        onMouseDown={isMiniMap ? undefined : handleMouseDown}
        onMouseMove={isMiniMap ? undefined : handleMouseMove}
        onMouseUp={isMiniMap ? undefined : handleMouseUp}
        onMouseLeave={isMiniMap ? undefined : handleMouseUp}
        style={{
          backgroundImage: isMiniMap ? undefined : `radial-gradient(circle, var(--canvas-grid) 1px, transparent 1px)`,
          backgroundSize:     `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      >
        {/* SVG — edges + nodes */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            {Object.entries(EDGE_COLORS).map(([label, color]) => (
              <marker key={label} id={`arrow-${label}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill={color} opacity="0.9" />
              </marker>
            ))}
          </defs>

          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            {/* Edges */}
            {edges.map(edge => {
              if (!liveNodeIds.has(edge.source) || !liveNodeIds.has(edge.target)) return null
              const ss = simRef.current.get(edge.source)
              const ts = simRef.current.get(edge.target)
              if (!ss || !ts) return null
              const color    = EDGE_COLORS[edge.label] ?? '#94a3b8'
              const isActive = tooltipNodeId === edge.source || tooltipNodeId === edge.target
              const dx = ts.x - ss.x, dy = ts.y - ss.y
              const mx = (ss.x + ts.x) / 2 - dy * 0.15
              const my = (ss.y + ts.y) / 2 + dx * 0.15
              return (
                <g key={edge.id} opacity={isActive ? 1 : 0.12} style={{ transition: 'opacity 0.2s' }}>
                  <path
                    d={`M ${ss.x} ${ss.y} Q ${mx} ${my} ${ts.x} ${ts.y}`}
                    fill="none" stroke={color}
                    strokeWidth={isActive ? 2 : 1.5}
                    strokeDasharray={edge.label === 'contradicts' ? '5,3' : undefined}
                    markerEnd={`url(#arrow-${edge.label})`}
                  />
                </g>
              )
            })}

            {/* Nodes */}
            {nodes.map(node => {
              if (!liveNodeIds.has(node.id)) return null
              const s = simRef.current.get(node.id)
              if (!s) return null
              const isPara     = node.data?.paragraphIndex !== undefined
              const r          = isPara ? NODE_R.concept : NODE_R.section
              const fill       = NODE_FILL[node.type]
              const isSelected = selectedNode === node.id
              const isHovered  = hoveredNode  === node.id

              return (
                <g
                  key={node.id}
                  data-node="true"
                  style={{ cursor: 'grab' }}
                  onMouseDown={e => handleNodeMouseDown(e, node.id)}
                  onDoubleClick={() => handleNodeDoubleClick(node.id, node)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {(isHovered || isSelected) && (
                    <circle cx={s.x} cy={s.y} r={r + 6} fill={fill} opacity="0.2" />
                  )}
                  <circle
                    cx={s.x} cy={s.y} r={r}
                    fill={fill}
                    stroke="white"
                    strokeWidth={isSelected ? 2.5 : isHovered ? 1.5 : 0}
                    opacity="0.93"
                  />
                  <text
                    x={s.x + r + 6} y={s.y + 4}
                    fontSize={isPara ? 10 : 12}
                    fontWeight={isPara ? '400' : '600'}
                    fill={isPara ? '#555' : '#222'}
                    style={{ paintOrder: 'stroke', stroke: 'rgba(245,244,240,0.85)', strokeWidth: 3, userSelect: 'none' } as React.CSSProperties}
                  >
                    {node.label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        {/* Hover / click tooltip */}
        {tooltipIsPara && tooltipNodeData && tooltipSim && (() => {
          const connectedEdges = edges.filter(e =>
            (e.source === tooltipNodeData.id || e.target === tooltipNodeData.id) && e.description
          )
          return (
            <div
              className="absolute pointer-events-none z-20"
              style={{
                left: tooltipSim.x * zoom + pan.x + NODE_R.concept * zoom + 12,
                top:  tooltipSim.y * zoom + pan.y - 24,
                maxWidth: 280,
              }}
            >
              <div className="bg-card/95 backdrop-blur-sm border border-border rounded-xl p-3 shadow-xl space-y-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-primary/70 mb-1">
                    {tooltipNodeData.location}
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4">
                    {tooltipContent || tooltipNodeData.label}
                  </p>
                </div>
                {connectedEdges.length > 0 && (
                  <div className="border-t border-border/50 pt-2 space-y-1.5">
                    {connectedEdges.slice(0, 3).map(e => {
                      const otherId   = e.source === tooltipNodeData.id ? e.target : e.source
                      const otherNode = nodes.find(n => n.id === otherId)
                      return (
                        <div key={e.id} className="flex items-start gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: EDGE_COLORS[e.label] }} />
                          <div>
                            <p className="text-[10px] font-semibold text-foreground/70 leading-none mb-0.5">
                              {otherNode?.location ?? otherNode?.label ?? 'Unknown'}
                            </p>
                            <p className="text-[10px] text-muted-foreground leading-snug">{e.description}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Empty state */}
        {nodes.length === 0 && !isMiniMap && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
            <p className="text-muted-foreground text-sm">No nodes yet.</p>
            <p className="text-muted-foreground/60 text-xs">Write content in your sections, then click <strong>Analyze Connections</strong>.</p>
          </div>
        )}

        {nodes.length > 0 && nodes.every(n => n.data?.paragraphIndex === undefined) && hasSectionContent && !isMiniMap && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs text-primary">
              Click <strong>Analyze Connections</strong> to map your paragraphs
            </div>
          </div>
        )}

        {/* Legend */}
        {!isMiniMap && (
          <div className="absolute bottom-4 left-4 p-3 rounded-lg bg-card/80 backdrop-blur-sm border border-border">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Connections</p>
            <div className="space-y-1">
              {Object.entries(EDGE_COLORS).map(([label, color]) => (
                <div key={label} className="flex items-center gap-2 text-xs">
                  <div className="w-6 h-0.5 rounded" style={{ backgroundColor: color }} />
                  <span className="capitalize text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isMiniMap && (
          <div className="absolute bottom-4 right-4 p-2 rounded-lg bg-card/60 backdrop-blur-sm border border-border">
            <p className="text-[10px] text-muted-foreground">Double-click a node to open editor</p>
          </div>
        )}
      </div>
    </div>
  )
}
