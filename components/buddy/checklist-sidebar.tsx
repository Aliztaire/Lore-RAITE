'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Check, ChevronRight, BookOpen, FileText, Plus, Pencil, Trash2, X, GripVertical, BookMarked } from 'lucide-react'
import { useBuddyStore } from '@/lib/store'
import type { OutlineSection } from '@/lib/types'
import { cn } from '@/lib/utils'

function lerpColor(a: string, b: string, t: number) {
  const ah = a.replace('#', '')
  const bh = b.replace('#', '')
  const ar = parseInt(ah.slice(0, 2), 16)
  const ag = parseInt(ah.slice(2, 4), 16)
  const ab = parseInt(ah.slice(4, 6), 16)
  const br = parseInt(bh.slice(0, 2), 16)
  const bg = parseInt(bh.slice(2, 4), 16)
  const bb = parseInt(bh.slice(4, 6), 16)
  const rr = Math.round(ar + (br - ar) * t)
  const gg = Math.round(ag + (bg - ag) * t)
  const bb2 = Math.round(ab + (bb - ab) * t)
  return `rgb(${rr},${gg},${bb2})`
}

function RingProgress({ completed, total }: { completed: number; total: number }) {
  const r = 32
  const stroke = 6
  const nr = r - stroke / 2
  const circ = 2 * Math.PI * nr
  const pct = total === 0 ? 0 : completed / total
  const offset = circ * (1 - pct)
  const displayPct = Math.round(pct * 100)
  const color = pct <= 0.5
    ? lerpColor('#ffce5d', '#fb804a', pct * 2)
    : lerpColor('#fb804a', '#9bb067', (pct - 0.5) * 2)

  return (
    <div className="relative flex items-center justify-center" style={{ width: r * 2, height: r * 2 }}>
      <svg width={r * 2} height={r * 2} viewBox={`0 0 ${r * 2} ${r * 2}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={r} cy={r} r={nr} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={r} cy={r} r={nr} fill="none"
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ stroke: color, transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-[11px] font-bold leading-none" style={{ color }}>
        {displayPct}%
      </span>
    </div>
  )
}

export function ChecklistSidebar() {
  const {
    getCurrentProject, selectedSectionId, selectSection,
    toggleSectionComplete, setViewMode, updateSection,
    addOutlineSection, removeOutlineSection, reorderOutlineSections,
    removeFromBibliography
  } = useBuddyStore()

  const project = getCurrentProject()
  const [sidebarWidth, setSidebarWidth] = useState(288) // default w-72 = 288px
  const isResizing = useRef(false)

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      if (!isResizing.current) return
      // Sidebar is on the right, so width = window width - mouse X
      const newWidth = window.innerWidth - ev.clientX
      setSidebarWidth(Math.min(Math.max(newWidth, 220), 480))
    }

    const onMouseUp = () => {
      isResizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }, [])

  const [citationStyle, setCitationStyle] = useState<'APA 7' | 'MLA 9' | 'Chicago'>('APA 7')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const addInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editingId) editInputRef.current?.focus() }, [editingId])
  useEffect(() => { if (addingSection) addInputRef.current?.focus() }, [addingSection])

  if (!project) return null

  const allSections: OutlineSection[] = [
    project.outline.introduction,
    ...project.outline.body,
    project.outline.conclusion,
  ]

  const completedCount = allSections.filter(s => s.completed).length
  const totalWords = allSections.reduce(
    (acc, s) => acc + (s.content?.split(/\s+/).filter(Boolean).length || 0), 0
  )

  const handleSectionClick = (section: OutlineSection) => {
    if (editingId === section.id) return
    selectSection(section.id)
    setViewMode('writing')
  }

  const startEditing = (e: React.MouseEvent, section: OutlineSection) => {
    e.stopPropagation()
    setEditingId(section.id)
    setEditingTitle(section.title)
  }

  const commitEdit = () => {
    if (editingId && editingTitle.trim()) updateSection(editingId, { title: editingTitle.trim() })
    setEditingId(null)
    setEditingTitle('')
  }

  const handleDelete = (e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation()
    if (allSections.length <= 1) return
    if (confirm('Delete this section? Its content will be lost.')) removeOutlineSection(sectionId)
  }

  const commitAdd = () => {
    if (newSectionTitle.trim()) addOutlineSection(newSectionTitle.trim())
    setAddingSection(false)
    setNewSectionTitle('')
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== draggedId) setDragOverId(id)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) { setDraggedId(null); setDragOverId(null); return }
    const from = allSections.findIndex(s => s.id === draggedId)
    const to = allSections.findIndex(s => s.id === targetId)
    const reordered = [...allSections]
    const [moved] = reordered.splice(from, 1)
    reordered.splice(to, 0, moved)
    reorderOutlineSections(reordered)
    setDraggedId(null)
    setDragOverId(null)
  }

  return (
    <aside
      className="border-l border-border flex flex-col overflow-hidden relative shrink-0"
      style={{ backgroundColor: '#ffffff', width: sidebarWidth, height: '100%' }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize z-10 hover:bg-primary/30 transition-colors group"
        title="Drag to resize"
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
      </div>

      {/* Header */}
      <div className="p-4 border-b border-border shrink-0" style={{ backgroundColor: '#381d18' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-white" />
            <h2 className="font-serif font-semibold text-white">Paper Outline</h2>
          </div>
          <RingProgress completed={completedCount} total={allSections.length} />
        </div>
        <p className="text-xs text-white/70 mt-1">
          {completedCount} of {allSections.length} sections complete
        </p>
      </div>

      {/* Scrollable sections list — capped so chat panel always shows */}
      <div className="overflow-y-auto p-2 space-y-0.5 shrink-0" style={{ maxHeight: '40%', backgroundColor: '#ffffff' }}>
        {allSections.map((section) => {
          const isSelected = selectedSectionId === section.id
          const isEditing = editingId === section.id
          const isDragging = draggedId === section.id
          const isDragOver = dragOverId === section.id

          return (
            <div
              key={section.id}
              draggable
              onDragStart={(e) => handleDragStart(e, section.id)}
              onDragOver={(e) => handleDragOver(e, section.id)}
              onDrop={(e) => handleDrop(e, section.id)}
              onDragLeave={() => setDragOverId(null)}
              onDragEnd={() => { setDraggedId(null); setDragOverId(null) }}
              onClick={() => handleSectionClick(section)}
              className={cn(
                'w-full text-left px-2 py-2 rounded-lg transition-all cursor-pointer',
                'flex items-center gap-2 group',
                isSelected ? 'bg-primary/10' : 'hover:bg-secondary',
                isDragging && 'opacity-40',
                isDragOver && 'border-t-2 border-primary'
              )}
            >
              {/* Drag handle */}
              <GripVertical className="h-4 w-4 text-muted-foreground/30 shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Complete toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSectionComplete(section.id) }}
                className={cn(
                  'shrink-0 w-5 h-5 rounded-full border-2 transition-colors flex items-center justify-center',
                  section.completed
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground/40 hover:border-primary'
                )}
              >
                {section.completed && <Check className="h-3 w-3" />}
              </button>

              {/* Title */}
              {isEditing ? (
                <input
                  ref={editInputRef}
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') commitEdit()
                    if (e.key === 'Escape') { setEditingId(null); setEditingTitle('') }
                  }}
                  onBlur={commitEdit}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 text-sm font-medium bg-secondary rounded px-2 py-0.5 outline-none border border-primary/40"
                />
              ) : (
                <span className={cn(
                  'flex-1 min-w-0 text-sm font-medium truncate',
                  section.completed && 'line-through text-muted-foreground'
                )}>
                  {section.title}
                </span>
              )}

              {/* Hover actions */}
              {!isEditing && (
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => startEditing(e, section)}
                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    title="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  {allSections.length > 1 && (
                    <button
                      onClick={(e) => handleDelete(e, section.id)}
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                  <ChevronRight className={cn(
                    'h-4 w-4 text-muted-foreground ml-0.5',
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'
                  )} />
                </div>
              )}
            </div>
          )
        })}

        {/* Inline add-section input */}
        {addingSection && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="shrink-0 w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/30" />
            <input
              ref={addInputRef}
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitAdd()
                if (e.key === 'Escape') { setAddingSection(false); setNewSectionTitle('') }
              }}
              onBlur={commitAdd}
              placeholder="Section title…"
              className="flex-1 min-w-0 text-sm font-medium bg-secondary rounded px-2 py-0.5 outline-none border border-primary/40 placeholder:text-muted-foreground/50"
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); setAddingSection(false); setNewSectionTitle('') }}
              className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* Add section + word count — fixed below sections list */}
      <div className="p-3 border-t border-border shrink-0 space-y-2" style={{ backgroundColor: '#ffffff' }}>
        <button
          onClick={() => setAddingSection(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all"
        >
          <Plus className="h-4 w-4" />
          Add section
        </button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <FileText className="h-3.5 w-3.5" />
          <span>{totalWords.toLocaleString()} words written</span>
        </div>
      </div>

      {/* Bibliography — always visible */}
      {(() => {
        const bibIds = project.bibliography || []
        const allRefs = allSections.flatMap(s => s.references || [])
        const bibRefs = bibIds.map(id => allRefs.find(r => r.id === id)).filter(Boolean) as typeof allRefs
        return (
          <div className="flex-1 flex flex-col min-h-0 border-t border-border overflow-hidden">
            {/* Bib header — always visible */}
            <div className="p-3 border-b border-border shrink-0" style={{ backgroundColor: '#381d18' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookMarked className="h-4 w-4 text-white" />
                  <span className="text-sm font-semibold text-white">Bibliography</span>
                </div>
                <span className="text-xs text-white/60">{bibRefs.length} source{bibRefs.length !== 1 ? 's' : ''}</span>
              </div>
              {/* Citation style picker */}
              <div className="flex items-center gap-1 mt-2">
                {(['APA 7', 'MLA 9', 'Chicago'] as const).map(style => (
                  <button
                    key={style}
                    onClick={() => setCitationStyle(style)}
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors"
                    style={citationStyle === style
                      ? { backgroundColor: '#fb804a', color: '#fff' }
                      : { backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }
                    }
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>
            {/* Bib list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5" style={{ backgroundColor: '#ffffff' }}>
              {bibRefs.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-6 px-3 space-y-1">
                  <BookMarked className="h-6 w-6 mx-auto opacity-20" />
                  <p className="opacity-60 leading-relaxed">No references added yet. Use the &ldquo;+ Use in Paper&rdquo; button on any reference to add it here.</p>
                </div>
              ) : (
                bibRefs.map((ref, i) => (
                  <div key={ref.id} className="rounded-lg border border-border bg-white p-2 text-xs">
                    <div className="flex items-start justify-between gap-1">
                      <p className="leading-snug text-[#381d18] flex-1">
                        <span className="font-semibold text-[#a0ad6d] mr-1">[{i + 1}]</span>
                        {ref.citation || ref.title}
                      </p>
                      <button
                        onClick={() => removeFromBibliography(ref.id)}
                        className="shrink-0 h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remove from bibliography"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Finalize button — only when refs exist */}
            {bibRefs.length > 0 && (
              <div className="p-2 shrink-0 border-t border-border" style={{ backgroundColor: '#ffffff' }}>
                <button
                  className="w-full py-2 rounded-lg text-xs font-semibold text-white transition-colors"
                  style={{ backgroundColor: '#381d18' }}
                  onClick={() => {
                    const lines = bibRefs.map((ref, i) => `[${i + 1}] ${ref.citation || ref.title}`)
                    const text = `Bibliography (${citationStyle})\n\n` + lines.join('\n\n')
                    navigator.clipboard.writeText(text).catch(() => {})
                    alert(`Bibliography copied to clipboard!\n\nFormat: ${citationStyle}`)
                  }}
                >
                  Finalize &amp; Copy Bibliography
                </button>
              </div>
            )}
          </div>
        )
      })()}

    </aside>
  )
}
