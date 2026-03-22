'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, FolderOpen, Sparkles, Pencil, Trash2, Check, X, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useBuddyStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const PLACEHOLDER_EXAMPLES = [
  'e.g., "Communicating with patients with schizophrenia"',
  'e.g., "The effect of childhood trauma on adult attachment styles"',
  'e.g., "Cognitive behavioral therapy for generalized anxiety disorder"',
  'e.g., "The psychology of social conformity in adolescent peer groups"',
  'e.g., "Mindfulness-based stress reduction in college students"',
  'e.g., "The relationship between sleep deprivation and emotional regulation"',
  'e.g., "Impostor syndrome among first-generation university students"',
  'e.g., "Parenting styles and their effects on children\'s self-esteem"',
  'e.g., "The role of empathy in reducing workplace aggression"',
  'e.g., "Procrastination and its link to perfectionism in young adults"',
]

export function Onboarding() {
  const [text, setText] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(i => (i + 1) % PLACEHOLDER_EXAMPLES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const { createProject, updateProject, deleteProject, projects, selectProject, setShowOnboarding } = useBuddyStore()

  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filteredProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .filter(p => p.title.toLowerCase().includes(search.toLowerCase()))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    createProject(text.trim(), text.trim())
  }

  const handleSelectExisting = (projectId: string) => {
    if (selectMode) {
      setSelected(prev => {
        const next = new Set(prev)
        next.has(projectId) ? next.delete(projectId) : next.add(projectId)
        return next
      })
      return
    }
    selectProject(projectId)
    setShowOnboarding(false)
  }

  const handleDeleteSelected = () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} project${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return
    selected.forEach(id => deleteProject(id))
    setSelected(new Set())
    setSelectMode(false)
  }

  const toggleSelectAll = () => {
    if (selected.size === filteredProjects.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filteredProjects.map(p => p.id)))
    }
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelected(new Set())
  }

  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  const startEditing = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation()
    setEditingId(id)
    setEditingTitle(title)
  }

  const commitEdit = () => {
    if (editingId && editingTitle.trim()) {
      updateProject(editingId, { title: editingTitle.trim() })
    }
    setEditingId(null)
    setEditingTitle('')
  }

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    setEditingId(null)
    setEditingTitle('')
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this project?')) {
      deleteProject(id)
    }
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left sidebar — existing projects */}
      {projects.length > 0 && (
        <aside className="w-80 shrink-0 border-r border-border bg-card flex flex-col p-4 gap-2 h-full overflow-hidden">
          {/* Header row */}
          <div className="flex items-center justify-between px-2 py-3 mb-1 shrink-0">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Your Projects</span>
            </div>
            {!selectMode ? (
              <button
                onClick={() => setSelectMode(true)}
                className="text-xs font-medium px-2.5 py-1 rounded-md border border-border bg-secondary hover:bg-primary/10 hover:border-primary/30 hover:text-primary text-muted-foreground transition-colors"
              >
                Select
              </button>
            ) : (
              <button
                onClick={exitSelectMode}
                className="text-xs font-medium px-2.5 py-1 rounded-md border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Select-mode toolbar */}
          {selectMode && (
            <div className="flex items-center justify-between px-2 pb-1 gap-2 shrink-0">
              <button
                onClick={toggleSelectAll}
                className="text-xs font-medium px-2.5 py-1 rounded-md border border-border bg-secondary hover:bg-primary/10 hover:border-primary/30 hover:text-primary text-muted-foreground transition-colors"
              >
                {selected.size === filteredProjects.length ? 'Deselect all' : 'Select all'}
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={selected.size === 0}
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors',
                  selected.size > 0
                    ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20'
                    : 'border-border bg-secondary text-muted-foreground/40 cursor-not-allowed'
                )}
              >
                <Trash2 className="h-3 w-3" />
                Delete{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            </div>
          )}

          {/* Search input */}
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search your projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-secondary/50 placeholder:text-muted-foreground/60 outline-none focus:border-primary/40 transition-colors"
            />
          </div>

          <div className="overflow-y-auto flex-1 min-h-0 flex flex-col gap-2 pr-0.5">
            {filteredProjects.length === 0 && search && (
              <p className="text-xs text-muted-foreground px-2 py-3 text-center">No projects match &ldquo;{search}&rdquo;</p>
            )}

            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className={cn(
                  'w-full text-left px-3 py-3 rounded-xl border transition-all',
                  'group flex items-start gap-2',
                  selectMode && selected.has(project.id)
                    ? 'bg-primary/10 border-primary/30'
                    : 'border-transparent hover:bg-primary/8 hover:border-primary/20'
                )}
              >
                {/* Checkbox in select mode */}
                {selectMode && (
                  <button
                    onClick={() => handleSelectExisting(project.id)}
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center transition-colors',
                      selected.has(project.id)
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-border bg-background'
                    )}
                  >
                    {selected.has(project.id) && <Check className="h-2.5 w-2.5" />}
                  </button>
                )}

                {editingId === project.id ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                    <input
                      ref={editInputRef}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      onBlur={commitEdit}
                      className="flex-1 min-w-0 text-sm font-medium bg-secondary rounded px-2 py-0.5 outline-none border border-primary/40"
                    />
                    <button
                      onMouseDown={(e) => { e.preventDefault(); commitEdit() }}
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-primary/20 text-primary shrink-0"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); cancelEdit(e) }}
                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => handleSelectExisting(project.id)}
                    >
                      <div className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                        {project.title}
                      </div>
                    </button>

                    {!selectMode && (
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                        <button
                          onClick={(e) => startEditing(e, project.id, project.title)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, project.id)}
                          className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-serif text-3xl font-bold mb-1">Hey, Buddy!</h1>
            <p className="text-muted-foreground text-sm">
              Tell me what you&apos;d like to work on, and I&apos;ll set up a project for it.
            </p>
          </div>

          {/* Input form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-secondary/50 border border-border rounded-2xl px-5 py-4 focus-within:border-primary transition-all shadow-sm">
              <Textarea
                placeholder={PLACEHOLDER_EXAMPLES[placeholderIndex]}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="bg-transparent border-0 focus-visible:ring-0 px-1 py-0 text-lg placeholder:text-muted-foreground/50 resize-none font-medium leading-relaxed"
              />
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!text.trim()}
            >
              Create Project
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
