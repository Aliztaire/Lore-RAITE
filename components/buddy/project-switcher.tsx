'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronsUpDown, Trash2, Pencil, Check, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBuddyStore } from '@/lib/store'
import { useConfirm } from './confirm-dialog'

export function ProjectSwitcher() {
  const { projects, currentProjectId, selectProject, deleteProject, updateProject, setShowOnboarding } = useBuddyStore()
  const currentProject = projects.find(p => p.id === currentProjectId)
  const { confirm } = useConfirm()

  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) inputRef.current?.focus()
  }, [editingId])

  const startEditing = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation()
    setOpen(false)
    setEditingId(id)
    setEditingTitle(title)
  }

  const commitEdit = () => {
    if (editingId && editingTitle.trim()) {
      updateProject(editingId, { title: editingTitle.trim() })
      selectProject(editingId)
    }
    setEditingId(null)
    setEditingTitle('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  const handleDeleteProject = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation()
    setOpen(false)
    const ok = await confirm({
      title: 'Delete this paper?',
      description: <>&ldquo;{title}&rdquo; and all of its sections will be permanently removed.</>,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (ok) deleteProject(id)
  }

  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  if (editingId) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') cancelEdit()
          }}
          className="text-sm font-medium bg-card rounded-md px-2 py-1 outline-none border border-input focus:border-ring w-56"
        />
        <button
          onClick={commitEdit}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-primary shrink-0"
          title="Save"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={cancelEdit}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground shrink-0"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-8 px-2 gap-1.5 text-foreground font-normal min-w-0"
        >
          <span className="truncate max-w-[260px]">
            {currentProject?.title || 'Select a paper'}
          </span>
          <ChevronsUpDown className="text-subtle-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {projects.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            No papers yet
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[528px]">
            <p className="eyebrow px-2 pt-1.5 pb-1">Your papers</p>
            {sortedProjects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                className={`group flex items-center gap-2 cursor-pointer ${project.id === currentProjectId ? "bg-accent" : ""}`}
                onSelect={(e) => e.preventDefault()}
              >
                <div
                  className="flex flex-col flex-1 min-w-0"
                  onClick={() => { selectProject(project.id); setOpen(false) }}
                >
                  <span className="truncate">{project.title}</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 ml-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-150">
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded text-subtle-foreground hover:text-foreground"
                    onClick={(e) => startEditing(e, project.id, project.title)}
                    title="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded text-subtle-foreground hover:text-destructive"
                    onClick={(e) => handleDeleteProject(e, project.id, project.title)}
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
        {projects.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem
          onClick={() => { setShowOnboarding(true); setOpen(false) }}
          className="flex items-center gap-2 cursor-pointer text-primary focus:text-primary"
          onSelect={(e) => e.preventDefault()}
        >
          <Plus className="h-4 w-4 text-primary" />
          <span>New paper</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
