'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { 
  ZoomIn, ZoomOut, Maximize2, Grid3X3, GitBranch, 
  Plus, FileText, Lightbulb, BookMarked
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBuddyStore } from '@/lib/store'
import type { CanvasNode, CanvasEdge } from '@/lib/types'

const NODE_COLORS = {
  section: 'bg-white border-primary/40',
  concept: 'bg-pink-50 border-primary/30',
  evidence: 'bg-green-50 border-accent/30',
}

const NODE_ICONS = {
  section: FileText,
  concept: Lightbulb,
  evidence: BookMarked
}

const EDGE_COLORS = {
  supports: 'stroke-edge-supports',
  contradicts: 'stroke-edge-contradicts',
  references: 'stroke-edge-references',
  elaborates: 'stroke-edge-elaborates'
}

interface NodeCanvasProps {
  onNodeDoubleClick?: (nodeId: string) => void
  isMiniMap?: boolean
}

export function NodeCanvas({ onNodeDoubleClick, isMiniMap = false }: NodeCanvasProps) {
  const { getCurrentProject, updateNode, addNode, addEdge, selectSection, setViewMode } = useBuddyStore()
  const project = getCurrentProject()
  
  const canvasRef = useRef<HTMLDivElement>(null)
  const savedForcePositionsRef = useRef<Record<string, {x: number, y: number}>>({})
  const [zoom, setZoom] = useState(isMiniMap ? 0.4 : 1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [layoutMode, setLayoutMode] = useState<'force' | 'hierarchical'>('hierarchical')

  const nodes = project?.nodes || []
  const edges = project?.edges || []

  // Force-directed layout simulation (Static solver)
  const applyForceLayout = useCallback(() => {
    if (!project || layoutMode !== 'force') return
    
    // Check if we have saved positions
    const saved = savedForcePositionsRef.current
    const updatedNodes = nodes.map(node => ({
       ...node,
       x: saved[node.id] ? saved[node.id].x : node.x,
       y: saved[node.id] ? saved[node.id].y : node.y
    }))

    const IDEAL_DISTANCE = 400
    const centerX = 400
    const centerY = 300
    
    // Run an invisible physics simulation to settle the graph
    for (let i = 0; i < 200; i++) {
      let maxMovement = 0

      updatedNodes.forEach((node, idx) => {
        let fx = 0, fy = 0
        
        // Repulsion from other nodes
        updatedNodes.forEach((other, otherIdx) => {
          if (idx === otherIdx) return
          let dx = node.x - other.x
          let dy = node.y - other.y
          if (dx === 0 && dy === 0) {
            dx = Math.random() - 0.5
            dy = Math.random() - 0.5
          }
          const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
          
          if (distance < IDEAL_DISTANCE) {
            const force = 40000 / (distance * distance)
            fx += (dx / distance) * force
            fy += (dy / distance) * force
          } else {
            const force = 1000 / (distance * Math.max(distance, 1))
            fx += (dx / distance) * force
            fy += (dy / distance) * force
          }
        })
        
        // Attraction to connected nodes
        edges.forEach(edge => {
          if (edge.source === node.id || edge.target === node.id) {
            const isSource = edge.source === node.id
            const otherNode = updatedNodes.find(n => n.id === (isSource ? edge.target : edge.source))
            if (!otherNode) return
            
            const dx = otherNode.x - node.x
            const dy = otherNode.y - node.y
            const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
            
            const force = (distance - IDEAL_DISTANCE * 0.8) * 0.05
            fx += (dx / distance) * force
            fy += (dy / distance) * force
          }
        })
        
        // Center gravity
        fx += (centerX - node.x) * 0.005
        fy += (centerY - node.y) * 0.005
        
        node.x += fx * 0.5
        node.y += fy * 0.5
        maxMovement = Math.max(maxMovement, Math.abs(fx * 0.5), Math.abs(fy * 0.5))
      })

      if (maxMovement < 0.5) break // Settled early
    }
    
    // Save back to Zustand
    updatedNodes.forEach(node => {
      const original = nodes.find(n => n.id === node.id)
      if (original && (Math.abs(original.x - node.x) > 2 || Math.abs(original.y - node.y) > 2)) {
        updateNode(node.id, { x: node.x, y: node.y })
      }
    })
  }, [project, nodes, edges, updateNode, layoutMode])

  useEffect(() => {
    if (layoutMode === 'force') {
      applyForceLayout()
    }
  }, [nodes.length, edges.length, layoutMode])

  const applyHierarchicalLayout = useCallback(() => {
    if (!project) return

    const NODE_W = 200
    const NODE_H = 60
    const COL_X = 500
    const ROW_GAP = NODE_H + 60 // 120px between section rows

    const sectionNodes = nodes.filter(n => n.type === 'section')
    const otherNodes   = nodes.filter(n => n.type !== 'section')

    // Place section nodes in a centered vertical column
    sectionNodes.forEach((node, idx) => {
      updateNode(node.id, { x: COL_X, y: 80 + idx * ROW_GAP })
    })

    // Place concept/evidence nodes alternating left/right, aligned to nearest section
    otherNodes.forEach((node, idx) => {
      const sectionIdx = Math.min(Math.floor(idx / 2), sectionNodes.length - 1)
      const side = idx % 2 === 0 ? -1 : 1
      const baseY = sectionNodes[sectionIdx]
        ? 80 + sectionIdx * ROW_GAP
        : 80 + idx * (NODE_H + 40)
      updateNode(node.id, {
        x: COL_X + side * (NODE_W + 80),
        y: baseY,
      })
    })
  }, [project, nodes, updateNode])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.min(Math.max(z * delta, 0.25), 3))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
      setSelectedNode(null)
    }
  }, [pan])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    }
    if (draggingNode) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x
        const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y
        updateNode(draggingNode, { x, y })
      }
    }
  }, [isPanning, panStart, draggingNode, dragOffset, pan, zoom, updateNode])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
    setDraggingNode(null)
  }, [])

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string, node: CanvasNode) => {
    e.stopPropagation()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const mouseX = (e.clientX - rect.left - pan.x) / zoom
      const mouseY = (e.clientY - rect.top - pan.y) / zoom
      setDragOffset({ x: mouseX - node.x, y: mouseY - node.y })
    }
    setDraggingNode(nodeId)
    setSelectedNode(nodeId)
  }, [pan, zoom])

  const handleNodeDoubleClick = useCallback((nodeId: string, node: CanvasNode) => {
    if (node.sectionId) {
      selectSection(node.sectionId)
      setViewMode('writing')
    }
    onNodeDoubleClick?.(nodeId)
  }, [selectSection, setViewMode, onNodeDoubleClick])

  const addNewNode = (type: CanvasNode['type']) => {
    const newNode: CanvasNode = {
      id: Math.random().toString(36).substring(2, 15),
      type,
      label: type === 'section' ? 'New Section' : type === 'concept' ? 'New Concept' : 'New Evidence',
      x: 300 + Math.random() * 200,
      y: 200 + Math.random() * 200
    }
    addNode(newNode)
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const getNodeInfo = (node: CanvasNode) => {
    let sectionContent = node.data?.content
    if (node.type === 'section' && node.sectionId && project) {
      if (project.outline.introduction.id === node.sectionId) sectionContent = project.outline.introduction.content
      else if (project.outline.conclusion.id === node.sectionId) sectionContent = project.outline.conclusion.content
      else {
        const bodySection = project.outline.body.find(s => s.id === node.sectionId)
        if (bodySection) sectionContent = bodySection.content
      }
    }
    const hasContent = !!(sectionContent && sectionContent.trim().length > 0)
    return {
      width: hasContent ? 280 : 160,
      height: hasContent ? 140 : 44,
      hasContent,
      sectionContent
    }
  }

  const renderEdge = (edge: CanvasEdge) => {
    const sourceNode = nodes.find(n => n.id === edge.source)
    const targetNode = nodes.find(n => n.id === edge.target)
    if (!sourceNode || !targetNode) return null

    const sourceInfo = getNodeInfo(sourceNode)
    const targetInfo = getNodeInfo(targetNode)

    const x1 = sourceNode.x + (sourceInfo.width / 2)
    const y1 = sourceNode.y + (sourceInfo.height / 2)
    const x2 = targetNode.x + (targetInfo.width / 2)
    const y2 = targetNode.y + (targetInfo.height / 2)

    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2

    return (
      <g key={edge.id}>
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          className={`${EDGE_COLORS[edge.label]} opacity-60`}
          strokeWidth={2}
          strokeDasharray={edge.label === 'contradicts' ? '6,4' : undefined}
          markerEnd="url(#arrowhead)"
        />
        <text
          x={midX} y={midY - 8}
          textAnchor="middle"
          fontSize="10"
          className="fill-muted-foreground"
          opacity="0.8"
        >
          {edge.label}
        </text>
      </g>
    )
  }

  const renderNode = (node: CanvasNode) => {
    const Icon = NODE_ICONS[node.type]
    const isSelected = selectedNode === node.id
    
    const { width, height, hasContent, sectionContent } = getNodeInfo(node)

    if (!hasContent) {
      return (
        <div
          key={node.id}
          className={`
            absolute cursor-move select-none
            px-3 py-2 rounded-full border-2
            transition-shadow duration-200 flex items-center gap-2
            ${NODE_COLORS[node.type]}
            ${isSelected ? 'ring-2 ring-primary shadow-lg scale-[1.02]' : 'hover:shadow-md hover:scale-[1.01]'}
          `}
          style={{
            left: node.x,
            top: node.y,
            width,
            height,
          }}
          onMouseDown={(e) => handleNodeMouseDown(e, node.id, node)}
          onDoubleClick={() => handleNodeDoubleClick(node.id, node)}
        >
          <Icon className="h-4 w-4 text-foreground/80 flex-shrink-0" />
          <span className="text-sm font-medium text-foreground truncate flex-1">
            {node.label}
          </span>
          {node.data?.importance && (
            <div className={`
              text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0
              ${node.data.importance === 'high' ? 'bg-destructive/20 text-destructive' : 
                node.data.importance === 'medium' ? 'bg-primary/20 text-primary' : 
                'bg-muted text-muted-foreground'}
            `}>
              {node.data.importance}
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        key={node.id}
        className={`
          absolute cursor-move select-none
          p-4 rounded-xl border-2 overflow-hidden
          transition-shadow duration-200
          flex flex-col
          ${NODE_COLORS[node.type]}
          ${isSelected ? 'ring-2 ring-primary shadow-xl scale-[1.02]' : 'hover:shadow-lg hover:scale-[1.01]'}
        `}
        style={{
          left: node.x,
          top: node.y,
          width,
          height,
        }}
        onMouseDown={(e) => handleNodeMouseDown(e, node.id, node)}
        onDoubleClick={() => handleNodeDoubleClick(node.id, node)}
      >
        <div className="flex items-center justify-between mb-3 border-b border-foreground/10 pb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Icon className="h-4 w-4 text-foreground/80 flex-shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">
              {node.label}
            </span>
          </div>
          {node.data?.importance && (
            <div className={`
              text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0
              ${node.data.importance === 'high' ? 'bg-destructive/20 text-destructive' : 
                node.data.importance === 'medium' ? 'bg-primary/20 text-primary' : 
                'bg-muted text-muted-foreground'}
            `}>
              {node.data.importance}
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground line-clamp-4 leading-relaxed whitespace-pre-wrap flex-1">
          {sectionContent ? sectionContent : <span className="italic opacity-60">No content yet...</span>}
        </div>
      </div>
    )
  }

  if (!project) {
    if (isMiniMap) return null
    return (
      <div className="flex-1 flex items-center justify-center bg-canvas-bg">
        <p className="text-muted-foreground">Select or create a project to view the canvas</p>
      </div>
    )
  }

  return (
    <div className={`flex-1 flex flex-col overflow-hidden ${isMiniMap ? 'bg-transparent' : 'bg-canvas-bg'}`}>
      {/* Canvas Toolbar */}
      {!isMiniMap && (
        <div className="h-12 border-b border-border bg-card/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Node
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => addNewNode('section')}>
                <FileText className="h-4 w-4 mr-2" />
                Section Node
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addNewNode('concept')}>
                <Lightbulb className="h-4 w-4 mr-2" />
                Concept Node
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addNewNode('evidence')}>
                <BookMarked className="h-4 w-4 mr-2" />
                Evidence Node
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="h-4 w-px bg-border" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (layoutMode === 'force') {
                // Save current positions before switching to hierarchical
                const positions: Record<string, {x: number, y: number}> = {}
                nodes.forEach(n => positions[n.id] = { x: n.x, y: n.y })
                savedForcePositionsRef.current = positions
                setLayoutMode('hierarchical')
                applyHierarchicalLayout()
              } else {
                setLayoutMode('force')
                const saved = savedForcePositionsRef.current
                if (Object.keys(saved).length > 0) {
                  nodes.forEach(n => {
                    if (saved[n.id]) updateNode(n.id, { x: saved[n.id].x, y: saved[n.id].y })
                  })
                }
              }
            }}
            className="gap-2"
          >
            {layoutMode === 'force' ? (
              <>
                <Grid3X3 className="h-4 w-4" />
                <span className="hidden sm:inline">Hierarchical</span>
              </>
            ) : (
              <>
                <GitBranch className="h-4 w-4" />
                <span className="hidden sm:inline">Force</span>
              </>
            )}
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(z * 1.2, 3))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(z * 0.8, 0.25))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={resetView}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      )}

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className={`flex-1 relative overflow-hidden ${isMiniMap ? '' : 'cursor-grab active:cursor-grabbing'}`}
        onWheel={isMiniMap ? undefined : handleWheel}
        onMouseDown={isMiniMap ? undefined : handleMouseDown}
        onMouseMove={isMiniMap ? undefined : handleMouseMove}
        onMouseUp={isMiniMap ? undefined : handleMouseUp}
        onMouseLeave={isMiniMap ? undefined : handleMouseUp}
        style={{
          backgroundImage: isMiniMap ? undefined : `radial-gradient(circle, var(--canvas-grid) 1px, transparent 1px)`,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'relative',
          }}
        >
          {/* Edges — zero-size SVG with overflow:visible shares node coordinate space */}
          <svg
            style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'visible' }}
            className="pointer-events-none"
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" opacity="0.7" />
              </marker>
            </defs>
            {edges.map(renderEdge)}
          </svg>

          {/* Nodes Layer */}
          {nodes.map(renderNode)}
        </div>

        {/* Legend */}
        {!isMiniMap && (
          <div className="absolute bottom-4 left-4 p-3 rounded-lg bg-card/80 backdrop-blur-sm border border-border">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Node Types</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded bg-node-section" />
                <span>Section</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded bg-node-concept" />
                <span>Concept</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded bg-node-evidence" />
                <span>Evidence</span>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!isMiniMap && (
          <div className="absolute bottom-4 right-4 p-2 rounded-lg bg-card/60 backdrop-blur-sm border border-border">
            <p className="text-[10px] text-muted-foreground">
              Double-click a section to open editor
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
