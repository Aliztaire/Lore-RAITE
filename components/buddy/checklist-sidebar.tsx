'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Check, ChevronRight, BookOpen, FileText, Plus, Pencil, Trash2, X, GripVertical } from 'lucide-react'
import { useBuddyStore } from '@/lib/store'
import type { OutlineSection } from '@/lib/types'
import { cn } from '@/lib/utils'

function RingProgress({ completed, total }: { completed: number; total: number }) {
  const r = 32
  const stroke = 6
  const nr = r - stroke / 2
  const circ = 2 * Math.PI * nr
  const pct = total === 0 ? 0 : completed / total
  const offset = circ * (1 - pct)
  const displayPct = Math.round(pct * 100)
  const color = '#d4547a'

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
    addOutlineSection, removeOutlineSection, reorderOutlineSections
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
      className="border-l border-border bg-white flex flex-col overflow-hidden relative shrink-0"
      style={{ width: sidebarWidth, height: '100%' }}
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
      <div className="p-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="font-serif font-semibold">Paper Outline</h2>
          </div>
          <RingProgress completed={completedCount} total={allSections.length} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {completedCount} of {allSections.length} sections complete
        </p>
      </div>

      {/* Scrollable sections list — capped so chat panel always shows */}
      <div className="overflow-y-auto p-2 space-y-0.5 shrink-0" style={{ maxHeight: '40%' }}>
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

      {/* Footer */}
      <div className="p-3 border-t border-border shrink-0 space-y-2">
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

    </aside>
  )
}
