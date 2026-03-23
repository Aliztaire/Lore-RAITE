'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import {
  ZoomIn, ZoomOut, Maximize2, Network, Loader2,
  Plus, FileText, Lightbulb, BookMarked, X, ImageIcon, Link2, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBuddyStore } from '@/lib/store'
import type { CanvasNode, CanvasEdge } from '@/lib/types'

// ─── Visual config ─────────────────────────────────────────────────────────
const NODE_R = { section: 13, concept: 8, evidence: 9 }
const NODE_FILL = { section: '#381d18', concept: '#fb804a', evidence: '#ffce5d' }
const EDGE_COLORS: Record<string, string> = {
  supports:    '#fb804a',
  contradicts: '#381d18',
  references:  '#ffce5d',
  elaborates:  '#ffaa75',
}

const EDGE_LABELS: CanvasEdge['label'][] = ['supports', 'contradicts', 'references', 'elaborates']

const genId = () => Math.random().toString(36).substring(2, 15)

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

interface NodePanelState {
  open: boolean
  mode: 'create' | 'edit'
  id: string | null
  type: CanvasNode['type']
  label: string
  content: string
  imageUrl: string | null
  resolved: boolean
}

interface EdgePickerState {
  open: boolean
  sourceId: string
  targetId: string
  screenX: number
  screenY: number
}

interface NodeCanvasProps {
  onNodeDoubleClick?: (nodeId: string) => void
  isMiniMap?: boolean
}

export function NodeCanvas({ onNodeDoubleClick, isMiniMap = false }: NodeCanvasProps) {
  const { getCurrentProject, updateNode, addNode, addEdge, selectSection, setViewMode, updateProject } = useBuddyStore()
  const project = getCurrentProject()

  const containerRef = useRef<HTMLDivElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
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

  // Connection mode
  const [connectMode, setConnectMode] = useState(false)
  const [connectSource, setConnectSource] = useState<string | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [edgePicker, setEdgePicker] = useState<EdgePickerState | null>(null)

  // Node editor panel
  const [panel, setPanel] = useState<NodePanelState>({
    open: false, mode: 'create', id: null, type: 'concept',
    label: '', content: '', imageUrl: null, resolved: false,
  })

  const simRef = useRef<Map<string, SimNode>>(new Map())
  const rafRef = useRef<number | null>(null)
  const nodesRef      = useRef<CanvasNode[]>([])
  const edgesRef      = useRef<CanvasEdge[]>([])
  const updateNodeRef = useRef(updateNode)

  const nodes = project?.nodes || []
  const edges = project?.edges || []

  useEffect(() => { nodesRef.current  = nodes  }, [nodes])
  useEffect(() => { edgesRef.current  = edges  }, [edges])
  useEffect(() => { updateNodeRef.current = updateNode }, [updateNode])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    if (width > 0) setPan({ x: width / 2, y: height / 2 })
  }, [])

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

  // ─── Panel helpers ─────────────────────────────────────────────────────────
  const openCreatePanel = (type: CanvasNode['type']) => {
    setPanel({ open: true, mode: 'create', id: null, type, label: '', content: '', imageUrl: null, resolved: false })
  }

  const openEditPanel = (node: CanvasNode) => {
    if (!node.data?.isCustom) return
    setPanel({
      open: true, mode: 'edit', id: node.id, type: node.type,
      label: node.label,
      content: node.data?.content ?? '',
      imageUrl: node.data?.imageUrl ?? null,
      resolved: node.data?.resolved ?? false,
    })
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setPanel(p => ({ ...p, imageUrl: ev.target?.result as string }))
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleSavePanel = () => {
    if (!panel.label.trim()) return
    if (panel.mode === 'create') {
      const id = genId()
      addNode({
        id, type: panel.type,
        label: panel.label.trim(),
        x: 0, y: 0,
        data: { isCustom: true, content: panel.content, imageUrl: panel.imageUrl ?? undefined, resolved: panel.resolved },
      })
      simRef.current.set(id, { x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200, vx: 0, vy: 0 })
      startSim()
    } else if (panel.mode === 'edit' && panel.id) {
      updateNode(panel.id, {
        label: panel.label.trim(),
        data: { isCustom: true, content: panel.content, imageUrl: panel.imageUrl ?? undefined, resolved: panel.resolved },
      })
    }
    setPanel(p => ({ ...p, open: false }))
  }

  const toggleResolved = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    if (!node?.data?.isCustom) return
    updateNode(nodeId, { data: { ...node.data, resolved: !node.data.resolved } })
  }

  // ─── Connection helpers ────────────────────────────────────────────────────
  const handleNodeConnectClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (!connectMode) return
    if (!connectSource) {
      setConnectSource(nodeId)
      return
    }
    if (connectSource === nodeId) {
      setConnectSource(null)
      return
    }
    // Open edge type picker near the target node in screen space
    const rect = containerRef.current?.getBoundingClientRect()
    const ts = simRef.current.get(nodeId)
    if (rect && ts) {
      const sx = ts.x * zoom + pan.x + rect.left
      const sy = ts.y * zoom + pan.y + rect.top
      setEdgePicker({ open: true, sourceId: connectSource, targetId: nodeId, screenX: sx, screenY: sy })
    }
    setConnectSource(null)
  }

  const confirmEdge = (label: CanvasEdge['label']) => {
    if (!edgePicker) return
    addEdge({ id: genId(), source: edgePicker.sourceId, target: edgePicker.targetId, label })
    setEdgePicker(null)
  }

  const cancelConnect = () => {
    setConnectSource(null)
    setEdgePicker(null)
  }

  // ─── Interaction handlers ─────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.min(Math.max(z * (e.deltaY > 0 ? 0.9 : 1.1), 0.15), 4))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return
    if (connectMode) { cancelConnect(); return }
    setIsPanning(true)
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    setSelectedNode(null)
  }, [pan, connectMode])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top  - pan.y) / zoom,
      })
    }
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    if (draggingNode) {
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
    if (connectMode) return
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
  }, [pan, zoom, connectMode])

  const handleNodeClick = useCallback((e: React.MouseEvent, node: CanvasNode) => {
    e.stopPropagation()
    if (connectMode) {
      handleNodeConnectClick(e, node.id)
      return
    }
    if (node.data?.isCustom) openEditPanel(node)
  }, [connectMode, connectSource])

  const handleNodeDoubleClick = useCallback((nodeId: string, node: CanvasNode) => {
    if (connectMode || node.data?.isCustom) return
    if (node.sectionId) { selectSection(node.sectionId); setViewMode('writing') }
    onNodeDoubleClick?.(nodeId)
  }, [selectSection, setViewMode, onNodeDoubleClick, connectMode])

  if (!project) {
    if (isMiniMap) return null
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Select or create a project to view the canvas</p>
      </div>
    )
  }

  const hasSectionContent = [project.outline.introduction, ...project.outline.body, project.outline.conclusion].some(s => s.content?.trim())

  const tooltipNodeId   = hoveredNode ?? selectedNode
  const tooltipNodeData = tooltipNodeId ? nodes.find(n => n.id === tooltipNodeId) : null
  const tooltipSim      = tooltipNodeId ? simRef.current.get(tooltipNodeId) : null
  const tooltipIsPara   = tooltipNodeData?.data?.paragraphIndex !== undefined
  const tooltipContent  = tooltipIsPara && tooltipNodeData?.sectionId
    ? getSectionParagraphs(tooltipNodeData.sectionId)[tooltipNodeData.data!.paragraphIndex!]
    : null

  const sourceSimNode = connectSource ? simRef.current.get(connectSource) : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
      {/* Toolbar */}
      {!isMiniMap && (
        <div className="h-12 border-b border-border flex items-center justify-between px-4 shrink-0" style={{ backgroundColor: '#fef5dd' }}>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon"><Plus className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => openCreatePanel('section')}><FileText   className="h-4 w-4 mr-2" /> Section</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openCreatePanel('concept')}><Lightbulb  className="h-4 w-4 mr-2" /> Concept</DropdownMenuItem>
                <DropdownMenuItem onClick={() => openCreatePanel('evidence')}><BookMarked className="h-4 w-4 mr-2" /> Evidence</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-4 w-px bg-border" />

            <Button
              size="icon"
              className="text-white border-0"
              style={{ backgroundColor: isAnalyzing || !hasSectionContent ? '#ffaa75' : '#fb804a' }}
              disabled={isAnalyzing || !hasSectionContent}
              onClick={generateAndAnalyze}
              title="Analyze Connections"
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
            </Button>

            <div className="h-4 w-px bg-border" />

            {/* Connect mode toggle */}
            <Button
              variant={connectMode ? 'default' : 'outline'}
              size="icon"
              style={connectMode ? { backgroundColor: '#fb804a', borderColor: '#fb804a', color: '#fff' } : {}}
              onClick={() => { setConnectMode(m => !m); cancelConnect() }}
              title={connectMode ? (connectSource ? 'Pick target…' : 'Pick source…') : 'Connect nodes'}
            >
              <Link2 className="h-4 w-4" />
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

      {/* Canvas + Panel wrapper */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Canvas */}
        <div
          ref={containerRef}
          className={`flex-1 relative overflow-hidden select-none ${isMiniMap ? '' : connectMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
          onWheel={isMiniMap ? undefined : handleWheel}
          onMouseDown={isMiniMap ? undefined : handleMouseDown}
          onMouseMove={isMiniMap ? undefined : handleMouseMove}
          onMouseUp={isMiniMap ? undefined : handleMouseUp}
          onMouseLeave={isMiniMap ? undefined : handleMouseUp}
          style={{
            backgroundImage: isMiniMap ? undefined : `radial-gradient(circle, rgba(251,128,74,0.25) 1px, transparent 1px)`,
            backgroundSize:     `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible' }}>
            <defs>
              {Object.entries(EDGE_COLORS).map(([label, color]) => (
                <marker key={label} id={`arrow-${label}`} markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                  <polygon points="0 0, 8 3, 0 6" fill={color} opacity="0.9" />
                </marker>
              ))}
            </defs>

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Live connection line */}
              {connectMode && connectSource && sourceSimNode && (
                <line
                  x1={sourceSimNode.x} y1={sourceSimNode.y}
                  x2={mousePos.x} y2={mousePos.y}
                  stroke="#fb804a" strokeWidth={1.5 / zoom} strokeDasharray={`${6 / zoom},${4 / zoom}`}
                  opacity={0.7}
                />
              )}

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
                  <g key={edge.id} opacity={isActive ? 1 : 0.5} style={{ transition: 'opacity 0.2s' }}>
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
                const isCustom   = node.data?.isCustom
                const hasImage   = !!node.data?.imageUrl
                const isResolved = !!node.data?.resolved
                const r          = isPara ? NODE_R.concept : NODE_R.section
                const fill       = isResolved ? '#7db87d' : NODE_FILL[node.type]
                const isSelected = selectedNode === node.id
                const isHovered  = hoveredNode  === node.id
                const isSource   = connectSource === node.id

                // Image card node
                if (hasImage && isCustom) {
                  const cardW = 90, cardH = 70, imgH = 52
                  return (
                    <g
                      key={node.id}
                      data-node="true"
                      style={{ cursor: connectMode ? 'crosshair' : 'pointer' }}
                      onMouseDown={e => handleNodeMouseDown(e, node.id)}
                      onClick={e => handleNodeClick(e, node)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                    >
                      <rect x={s.x - cardW / 2 + 2} y={s.y - cardH / 2 + 2} width={cardW} height={cardH} rx={8} fill="rgba(0,0,0,0.12)" />
                      <rect
                        x={s.x - cardW / 2} y={s.y - cardH / 2}
                        width={cardW} height={cardH} rx={8}
                        fill={isResolved ? '#f0faf0' : '#fff3e0'}
                        stroke={isSource ? '#3dab68' : isSelected || isHovered ? fill : '#ffaa75'}
                        strokeWidth={isSource || isSelected || isHovered ? 2.5 : 1.5}
                      />
                      <clipPath id={`card-clip-${node.id}`}>
                        <rect x={s.x - cardW / 2} y={s.y - cardH / 2} width={cardW} height={imgH} rx={8} />
                      </clipPath>
                      <image
                        href={node.data!.imageUrl}
                        x={s.x - cardW / 2} y={s.y - cardH / 2}
                        width={cardW} height={imgH}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#card-clip-${node.id})`}
                        opacity={isResolved ? 0.6 : 1}
                      />
                      <text
                        x={s.x} y={s.y - cardH / 2 + imgH + 12}
                        fontSize={9} fontWeight="600" textAnchor="middle"
                        fill={isResolved ? '#3d7a3d' : '#381d18'}
                        style={{ userSelect: 'none' } as React.CSSProperties}
                      >
                        {isResolved ? '✓ ' : ''}{node.label.length > 10 ? node.label.slice(0, 10) + '…' : node.label}
                      </text>
                    </g>
                  )
                }

                // Standard circle node
                return (
                  <g
                    key={node.id}
                    data-node="true"
                    style={{ cursor: connectMode ? 'crosshair' : isCustom ? 'pointer' : 'grab' }}
                    onMouseDown={e => handleNodeMouseDown(e, node.id)}
                    onClick={e => handleNodeClick(e, node)}
                    onDoubleClick={() => handleNodeDoubleClick(node.id, node)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    {(isHovered || isSelected || isSource) && (
                      <circle cx={s.x} cy={s.y} r={r + 6} fill={isSource ? '#3dab68' : fill} opacity="0.2" />
                    )}
                    <circle
                      cx={s.x} cy={s.y} r={r}
                      fill={fill}
                      stroke={isSource ? '#3dab68' : 'white'}
                      strokeWidth={isSource ? 2.5 : isSelected ? 2.5 : isHovered ? 1.5 : 0}
                      opacity={isResolved ? 0.75 : 0.93}
                    />
                    {/* Resolved checkmark badge */}
                    {isResolved && (
                      <>
                        <circle cx={s.x + r} cy={s.y - r} r={5} fill="#3dab68" />
                        <text x={s.x + r} y={s.y - r + 3.5} fontSize={7} textAnchor="middle" fill="white" style={{ userSelect: 'none' } as React.CSSProperties}>✓</text>
                      </>
                    )}
                    {/* Custom node dot */}
                    {isCustom && !isResolved && (
                      <circle cx={s.x + r - 2} cy={s.y - r + 2} r={3} fill="#381d18" />
                    )}
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

          {/* Edge type picker popup */}
          {edgePicker && (
            <div
              className="absolute z-40 rounded-xl border shadow-xl overflow-hidden"
              onMouseDown={e => e.stopPropagation()}
              style={{
                left: edgePicker.screenX - (containerRef.current?.getBoundingClientRect().left ?? 0) + 12,
                top:  edgePicker.screenY - (containerRef.current?.getBoundingClientRect().top  ?? 0) - 20,
                backgroundColor: '#fef5dd',
                borderColor: '#ffaa75',
              }}
            >
              <div className="px-3 py-2 border-b text-xs font-bold" style={{ borderColor: '#ffaa75', color: '#381d18' }}>
                Connection type
              </div>
              {EDGE_LABELS.map(label => (
                <button
                  key={label}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-orange-50 transition-colors capitalize"
                  onClick={() => confirmEdge(label)}
                >
                  <div className="w-4 h-0.5 rounded" style={{ backgroundColor: EDGE_COLORS[label] }} />
                  {label}
                </button>
              ))}
              <button
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:bg-orange-50 transition-colors border-t"
                style={{ borderColor: '#ffaa75' }}
                onClick={() => setEdgePicker(null)}
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          )}

          {/* Hover tooltip — auto-generated para nodes */}
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
                <div className="backdrop-blur-sm border rounded-xl p-3 shadow-xl space-y-2" style={{ backgroundColor: 'rgba(254,245,221,0.97)', borderColor: '#ffaa75' }}>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: '#fb804a' }}>
                    {tooltipNodeData.location}
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4">
                    {tooltipContent || tooltipNodeData.label}
                  </p>
                  {connectedEdges.length > 0 && (
                    <div className="border-t pt-2 space-y-1.5" style={{ borderColor: '#ffaa75' }}>
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

          {/* Legend */}
          {!isMiniMap && (
            <div className="absolute bottom-4 left-4 p-3 rounded-lg backdrop-blur-sm border" style={{ backgroundColor: 'rgba(254,245,221,0.85)', borderColor: '#ffaa75' }}>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Connections</p>
              <div className="space-y-1">
                {Object.entries(EDGE_COLORS).map(([label, color]) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <div className="w-6 h-0.5 rounded" style={{ backgroundColor: color }} />
                    <span className="capitalize text-muted-foreground">{label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs mt-1">
                  <div className="w-3 h-3 rounded-full flex items-center justify-center" style={{ backgroundColor: '#3dab68' }}>
                    <span className="text-white" style={{ fontSize: 7 }}>✓</span>
                  </div>
                  <span className="text-muted-foreground">Resolved</span>
                </div>
              </div>
            </div>
          )}

          {!isMiniMap && (
            <div className="absolute bottom-4 right-4 p-2 rounded-lg backdrop-blur-sm border" style={{ backgroundColor: 'rgba(254,245,221,0.75)', borderColor: '#ffaa75' }}>
              <p className="text-[10px] text-muted-foreground">Click custom nodes to edit · Use Connect to link nodes</p>
            </div>
          )}
        </div>

        {/* Node Editor Panel */}
        {panel.open && !isMiniMap && (
          <div className="w-80 shrink-0 border-l flex flex-col h-full z-30" style={{ backgroundColor: '#fef5dd', borderColor: '#ffaa75' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#ffaa75' }}>
              <div className="flex items-center gap-2">
                {panel.type === 'section'  && <FileText   className="h-4 w-4" style={{ color: '#381d18' }} />}
                {panel.type === 'concept'  && <Lightbulb  className="h-4 w-4" style={{ color: '#fb804a' }} />}
                {panel.type === 'evidence' && <BookMarked className="h-4 w-4" style={{ color: '#ffce5d' }} />}
                <span className="text-sm font-bold capitalize" style={{ color: '#381d18' }}>
                  {panel.mode === 'edit' ? 'Edit' : 'New'} {panel.type}
                </span>
              </div>
              <button onClick={() => setPanel(p => ({ ...p, open: false }))} className="rounded-lg p-1 hover:bg-black/10 transition-colors">
                <X className="h-4 w-4" style={{ color: '#381d18' }} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {/* Label */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#381d18' }}>Label</label>
                <input
                  value={panel.label}
                  onChange={e => setPanel(p => ({ ...p, label: e.target.value }))}
                  placeholder="Short title…"
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none transition-colors"
                  style={{ backgroundColor: '#fff3e0', borderColor: '#ffaa75', color: '#381d18' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#fb804a')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#ffaa75')}
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#381d18' }}>Content</label>
                <textarea
                  value={panel.content}
                  onChange={e => setPanel(p => ({ ...p, content: e.target.value }))}
                  placeholder="Describe this node…"
                  rows={5}
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none resize-none transition-colors"
                  style={{ backgroundColor: '#fff3e0', borderColor: '#ffaa75', color: '#381d18' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#fb804a')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#ffaa75')}
                />
              </div>

              {/* Resolved toggle — concept & evidence only */}
              {(panel.type === 'concept' || panel.type === 'evidence') && (
                <div>
                  <label className="text-xs font-semibold mb-2 block" style={{ color: '#381d18' }}>Status</label>
                  <button
                    onClick={() => setPanel(p => ({ ...p, resolved: !p.resolved }))}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border text-sm font-medium transition-all"
                    style={{
                      backgroundColor: panel.resolved ? '#e8f5e8' : '#fff3e0',
                      borderColor: panel.resolved ? '#3dab68' : '#ffaa75',
                      color: panel.resolved ? '#2e7d2e' : '#381d18',
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" style={{ color: panel.resolved ? '#3dab68' : '#ffaa75' }} />
                    {panel.resolved ? 'Resolved / Implemented' : 'Mark as Resolved'}
                  </button>
                </div>
              )}

              {/* Image upload */}
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: '#381d18' }}>Image</label>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                {panel.imageUrl ? (
                  <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: '#ffaa75' }}>
                    <img src={panel.imageUrl} alt="uploaded" className="w-full object-cover max-h-48" />
                    <button
                      onClick={() => setPanel(p => ({ ...p, imageUrl: null }))}
                      className="absolute top-2 right-2 rounded-full p-1 shadow"
                      style={{ backgroundColor: '#381d18' }}
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full border-2 border-dashed rounded-xl py-8 flex flex-col items-center gap-2 transition-colors hover:bg-orange-50"
                    style={{ borderColor: '#ffaa75' }}
                  >
                    <ImageIcon className="h-6 w-6" style={{ color: '#ffaa75' }} />
                    <span className="text-xs" style={{ color: '#fb804a' }}>Click to upload an image</span>
                  </button>
                )}
              </div>

              {/* Quick resolve from edit panel */}
              {panel.mode === 'edit' && panel.id && (panel.type === 'concept' || panel.type === 'evidence') && (
                <button
                  onClick={() => { toggleResolved(panel.id!); setPanel(p => ({ ...p, open: false })) }}
                  className="text-xs underline text-center transition-colors"
                  style={{ color: '#fb804a' }}
                >
                  {nodes.find(n => n.id === panel.id)?.data?.resolved
                    ? 'Mark as unresolved'
                    : 'Quick-resolve without saving'}
                </button>
              )}
            </div>

            <div className="p-4 border-t flex gap-2" style={{ borderColor: '#ffaa75' }}>
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setPanel(p => ({ ...p, open: false }))}>
                Cancel
              </Button>
              <Button
                size="sm" className="flex-1 text-white border-0"
                style={{ backgroundColor: panel.label.trim() ? '#fb804a' : '#ffaa75' }}
                disabled={!panel.label.trim()}
                onClick={handleSavePanel}
              >
                {panel.mode === 'edit' ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
