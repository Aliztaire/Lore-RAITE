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
  section: 'bg-node-section border-node-section/50',
  concept: 'bg-node-concept border-node-concept/50',
  evidence: 'bg-node-evidence border-node-evidence/50'
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
}

export function NodeCanvas({ onNodeDoubleClick }: NodeCanvasProps) {
  const { getCurrentProject, updateNode, addNode, addEdge, selectSection, setViewMode } = useBuddyStore()
  const project = getCurrentProject()
  
  const canvasRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [layoutMode, setLayoutMode] = useState<'force' | 'hierarchical'>('hierarchical')

  const nodes = project?.nodes || []
  const edges = project?.edges || []

  // Force-directed layout simulation
  const applyForceLayout = useCallback(() => {
    if (!project) return
    
    const updatedNodes = [...nodes]
    const centerX = 400
    const centerY = 300
    const repulsion = 5000
    const attraction = 0.01
    
    for (let i = 0; i < 50; i++) {
      updatedNodes.forEach((node, idx) => {
        let fx = 0, fy = 0
        
        // Repulsion from other nodes
        updatedNodes.forEach((other, otherIdx) => {
          if (idx === otherIdx) return
          const dx = node.x - other.x
          const dy = node.y - other.y
          const distance = Math.sqrt(dx * dx + dy * dy) || 1
          const force = repulsion / (distance * distance)
          fx += (dx / distance) * force
          fy += (dy / distance) * force
        })
        
        // Attraction to connected nodes
        edges.forEach(edge => {
          let connectedNode: typeof node | undefined
          if (edge.source === node.id) {
            connectedNode = updatedNodes.find(n => n.id === edge.target)
          } else if (edge.target === node.id) {
            connectedNode = updatedNodes.find(n => n.id === edge.source)
          }
          if (connectedNode) {
            const dx = connectedNode.x - node.x
            const dy = connectedNode.y - node.y
            fx += dx * attraction
            fy += dy * attraction
          }
        })
        
        // Center gravity
        fx += (centerX - node.x) * 0.001
        fy += (centerY - node.y) * 0.001
        
        node.x += fx * 0.1
        node.y += fy * 0.1
      })
    }
    
    updatedNodes.forEach(node => {
      updateNode(node.id, { x: node.x, y: node.y })
    })
  }, [project, nodes, edges, updateNode])

  const applyHierarchicalLayout = useCallback(() => {
    if (!project) return
    
    const sectionNodes = nodes.filter(n => n.type === 'section')
    const otherNodes = nodes.filter(n => n.type !== 'section')
    
    const startY = 80
    const spacing = 120
    
    sectionNodes.forEach((node, idx) => {
      updateNode(node.id, { x: 400, y: startY + idx * spacing })
    })
    
    otherNodes.forEach((node, idx) => {
      const side = idx % 2 === 0 ? -1 : 1
      updateNode(node.id, { 
        x: 400 + side * (150 + Math.floor(idx / 2) * 80), 
        y: 150 + Math.floor(idx / 2) * 100 
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

  const renderEdge = (edge: CanvasEdge) => {
    const sourceNode = nodes.find(n => n.id === edge.source)
    const targetNode = nodes.find(n => n.id === edge.target)
    if (!sourceNode || !targetNode) return null

    const x1 = sourceNode.x + 70
    const y1 = sourceNode.y + 20
    const x2 = targetNode.x + 70
    const y2 = targetNode.y + 20

    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2

    // Curved path
    const dx = x2 - x1
    const dy = y2 - y1
    const curve = Math.min(Math.abs(dx), Math.abs(dy)) * 0.3
    const cpX = midX + (dy > 0 ? curve : -curve)
    const cpY = midY

    return (
      <g key={edge.id}>
        <path
          d={`M ${x1} ${y1} Q ${cpX} ${cpY} ${x2} ${y2}`}
          fill="none"
          className={`${EDGE_COLORS[edge.label]} opacity-60`}
          strokeWidth={2}
          strokeDasharray={edge.label === 'contradicts' ? '5,5' : undefined}
        />
        <circle cx={x2} cy={y2} r={4} className={`${EDGE_COLORS[edge.label].replace('stroke-', 'fill-')} opacity-80`} />
        <text
          x={midX}
          y={midY - 10}
          textAnchor="middle"
          className="text-[10px] fill-muted-foreground"
        >
          {edge.label}
        </text>
      </g>
    )
  }

  const renderNode = (node: CanvasNode) => {
    const Icon = NODE_ICONS[node.type]
    const isSelected = selectedNode === node.id
    
    return (
      <div
        key={node.id}
        className={`
          absolute cursor-move select-none
          px-3 py-2 rounded-lg border-2
          transition-shadow duration-200
          ${NODE_COLORS[node.type]}
          ${isSelected ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'}
        `}
        style={{
          left: node.x,
          top: node.y,
          minWidth: 140,
        }}
        onMouseDown={(e) => handleNodeMouseDown(e, node.id, node)}
        onDoubleClick={() => handleNodeDoubleClick(node.id, node)}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-foreground/80" />
          <span className="text-sm font-medium text-foreground truncate">
            {node.label}
          </span>
        </div>
        {node.data?.importance && (
          <div className={`
            mt-1 text-[10px] px-1.5 py-0.5 rounded-full inline-block
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

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center bg-canvas-bg">
        <p className="text-muted-foreground">Select or create a project to view the canvas</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-canvas-bg overflow-hidden">
      {/* Canvas Toolbar */}
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
              setLayoutMode(layoutMode === 'force' ? 'hierarchical' : 'force')
              if (layoutMode === 'hierarchical') {
                applyForceLayout()
              } else {
                applyHierarchicalLayout()
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

      {/* Canvas Area */}
      <div
        ref={canvasRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          backgroundImage: `
            radial-gradient(circle, var(--canvas-grid) 1px, transparent 1px)
          `,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`
        }}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Edges SVG Layer */}
          <svg 
            className="absolute inset-0 pointer-events-none" 
            style={{ width: 1200, height: 800 }}
          >
            {edges.map(renderEdge)}
          </svg>

          {/* Nodes Layer */}
          {nodes.map(renderNode)}
        </div>

        {/* Legend */}
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

        {/* Instructions */}
        <div className="absolute bottom-4 right-4 p-2 rounded-lg bg-card/60 backdrop-blur-sm border border-border">
          <p className="text-[10px] text-muted-foreground">
            Double-click a section to open editor
          </p>
        </div>
      </div>
    </div>
  )
}
