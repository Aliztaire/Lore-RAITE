'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Check, Plus, Pencil, Trash2, X, GripVertical } from 'lucide-react'
import { useBuddyStore } from '@/lib/store'
import type { OutlineSection } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useConfirm } from './confirm-dialog'

const CITATION_STYLES = ['APA 7', 'MLA 9', 'Chicago'] as const
type CitationStyle = typeof CITATION_STYLES[number]

export function ChecklistSidebar() {
  const {
    getCurrentProject, selectedSectionId, selectSection,
    toggleSectionComplete, setViewMode, updateSection,
    addOutlineSection, removeOutlineSection, reorderOutlineSections,
    removeFromBibliography
  } = useBuddyStore()
  const { confirm } = useConfirm()

  const project = getCurrentProject()
  const [sidebarWidth, setSidebarWidth] = useState(300)
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
      setSidebarWidth(Math.min(Math.max(newWidth, 240), 480))
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

  const [citationStyle, setCitationStyle] = useState<CitationStyle>('APA 7')
  const [pendingStyle, setPendingStyle] = useState<CitationStyle>('APA 7')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [addingSection, setAddingSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
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
  const progressPct = allSections.length ? Math.round((completedCount / allSections.length) * 100) : 0
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

  const handleDelete = async (e: React.MouseEvent, section: OutlineSection) => {
    e.stopPropagation()
    if (allSections.length <= 1) return
    const ok = await confirm({
      title: `Delete “${section.title}”?`,
      description: 'This section and everything written in it will be permanently removed.',
      confirmLabel: 'Delete section',
      destructive: true,
    })
    if (ok) removeOutlineSection(section.id)
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

  const bibIds = project.bibliography || []
  const allRefs = allSections.flatMap(s => s.references || [])
  const bibRefs = bibIds.map(id => allRefs.find(r => r.id === id)).filter(Boolean) as typeof allRefs

  const copyBibliography = () => {
    const lines = bibRefs.map((ref, i) => `[${i + 1}] ${ref.citation || ref.title}`)
    const text = `Bibliography (${citationStyle})\n\n` + lines.join('\n\n')
    navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <aside
      className="border-l border-border bg-card flex flex-col overflow-hidden relative shrink-0 h-full"
      style={{ width: sidebarWidth }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize z-10 hover:bg-highlight transition-colors duration-150"
        title="Drag to resize"
      />

      {/* Outline header */}
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-base font-semibold">Outline</h2>
          <span className="text-xs text-muted-foreground tabular-nums">{completedCount} of {allSections.length} complete</span>
        </div>
        <div className="mt-3 h-1 w-full bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Sections list */}
      <div className="overflow-y-auto px-2 pb-2 shrink-0" style={{ maxHeight: '42%' }}>
        {allSections.map((section, i) => {
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
                'relative w-full text-left pl-2 pr-3 py-2 rounded-full cursor-pointer flex items-center gap-2 group transition-colors duration-150',
                isSelected ? 'bg-accent' : ' hover:text-highlight-strong',
                isDragging && 'opacity-40',
                isDragOver && 'shadow-[inset_0_2px_0_var(--primary)]'
              )}
            >
              <GripVertical className="h-3.5 w-3.5 text-subtle-foreground shrink-0 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity duration-150" />

              {/* Complete toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); toggleSectionComplete(section.id) }}
                aria-label={section.completed ? `Mark ${section.title} incomplete` : `Mark ${section.title} complete`}
                className={cn(
                  'shrink-0 w-4 h-4 rounded-full border flex items-center justify-center transition-colors duration-150',
                  section.completed
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-input bg-card'
                )}
              >
                {section.completed && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </button>

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
                  className="flex-1 min-w-0 ml-1 text-sm bg-card rounded-full px-3 py-1 outline-none border border-ring"
                />
              ) : (
                <span className={cn(
                  'flex-1 min-w-0 ml-1 text-sm truncate group-hover:text-highlight-strong transition-colors duration-150',
                  isSelected ? 'text-foreground font-medium' : 'text-foreground',
                  section.completed && 'text-muted-foreground'
                )}>
                  <span className="text-subtle-foreground tabular-nums mr-2 text-xs">{i + 1}.</span>
                  {section.title}
                </span>
              )}

              {!isEditing && (
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                  <button
                    onClick={(e) => startEditing(e, section)}
                    className="h-5 w-5 flex items-center justify-center rounded-full text-subtle-foreground hover:text-highlight-strong"
                    title="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  {allSections.length > 1 && (
                    <button
                      onClick={(e) => handleDelete(e, section)}
                      className="h-5 w-5 flex items-center justify-center rounded-full text-subtle-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {addingSection && (
          <div className="flex items-center gap-2 pl-6 pr-2 py-2">
            <div className="shrink-0 w-4 h-4 rounded-full border border-dashed border-input" />
            <input
              ref={addInputRef}
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitAdd()
                if (e.key === 'Escape') { setAddingSection(false); setNewSectionTitle('') }
              }}
              onBlur={commitAdd}
              placeholder="Section title"
              className="flex-1 min-w-0 text-sm bg-card rounded-full px-3 py-1 outline-none border border-ring placeholder:text-subtle-foreground"
            />
            <button
              onMouseDown={(e) => { e.preventDefault(); setAddingSection(false); setNewSectionTitle('') }}
              className="h-5 w-5 flex items-center justify-center rounded-full text-subtle-foreground hover:text-highlight-strong"
              aria-label="Cancel"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-border shrink-0 flex items-center justify-between">
        <button
          onClick={() => setAddingSection(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-highlight-strong transition-colors duration-150"
        >
          <Plus className="h-3.5 w-3.5" />
          Add section
        </button>
        <span className="text-xs text-subtle-foreground tabular-nums">{totalWords.toLocaleString()} words</span>
      </div>

      {/* Bibliography */}
      <div className="flex-1 flex flex-col min-h-0 border-t border-border overflow-hidden">
        <div className="px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-baseline justify-between">
            <h2 className="font-serif text-base font-semibold">Bibliography</h2>
            <span className="text-xs text-muted-foreground tabular-nums">{bibRefs.length} source{bibRefs.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="inline-flex rounded-full border border-border p-1" role="radiogroup" aria-label="Citation style">
              {CITATION_STYLES.map(style => (
                <button
                  key={style}
                  role="radio"
                  aria-checked={pendingStyle === style}
                  onClick={() => setPendingStyle(style)}
                  className={cn(
                    'text-xs px-3 py-1 rounded-full transition-colors duration-150',
                    pendingStyle === style ? 'bg-accent text-foreground font-medium' : 'text-muted-foreground hover:text-highlight-strong'
                  )}
                >
                  {style}
                </button>
              ))}
            </div>
            {pendingStyle !== citationStyle && (
              <button
                onClick={() => setCitationStyle(pendingStyle)}
                className="text-xs text-primary hover:underline hover:text-highlight-strong underline-offset-2"
              >
                Apply
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {bibRefs.length === 0 ? (
            <p className="text-xs text-muted-foreground leading-relaxed py-4">
              No sources yet. In the writing view, choose <span className="text-foreground">Use in paper</span> on any reference to add it here.
            </p>
          ) : (
            <ol className="space-y-3">
              {bibRefs.map((ref, i) => (
                <li key={ref.id} className="group flex items-start gap-2 text-xs leading-relaxed">
                  <span className="text-subtle-foreground tabular-nums shrink-0">[{i + 1}]</span>
                  <p className="flex-1 text-foreground/90 pl-0">{ref.citation || ref.title}</p>
                  <button
                    onClick={() => removeFromBibliography(ref.id)}
                    className="shrink-0 h-4 w-4 flex items-center justify-center rounded-full text-subtle-foreground hover:text-destructive opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150"
                    title="Remove from bibliography"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        {bibRefs.length > 0 && (
          <div className="px-5 py-3 shrink-0 border-t border-border">
            <button
              className="w-full h-8 rounded-full text-sm border border-input bg-card transition-colors duration-150 flex items-center justify-center gap-2 hover:text-highlight-strong"
              onClick={copyBibliography}
            >
              {copied ? <><Check className="h-3.5 w-3.5 text-primary" /> Copied to clipboard</> : 'Copy bibliography'}
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
