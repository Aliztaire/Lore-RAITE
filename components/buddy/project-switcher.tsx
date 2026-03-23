'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Trash2, FolderOpen, Pencil, Check, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useBuddyStore } from '@/lib/store'

export function ProjectSwitcher() {
  const { projects, currentProjectId, selectProject, deleteProject, updateProject, setShowOnboarding } = useBuddyStore()
  const currentProject = projects.find(p => p.id === currentProjectId)

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

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this project?')) {
      deleteProject(id)
      setOpen(false)
    }
  }

  const sortedProjects = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  )

  if (editingId) {
    return (
      <div className="flex items-center gap-1 px-1">
        <FolderOpen className="h-4 w-4 text-primary shrink-0" />
        <input
          ref={inputRef}
          value={editingTitle}
          onChange={(e) => setEditingTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') cancelEdit()
          }}
          className="text-sm font-medium bg-secondary rounded px-2 py-1 outline-none border border-primary/40 w-48"
        />
        <button
          onClick={commitEdit}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-primary/20 text-primary shrink-0"
          title="Save"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={cancelEdit}
          className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground shrink-0"
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
          className="flex items-center gap-2 px-3 py-2 h-auto text-white/80 hover:text-white hover:bg-white/10"
        >
          <FolderOpen className="h-4 w-4 text-white/70" />
          <span className="font-medium truncate max-w-[180px]">
            {currentProject?.title || 'Select Project'}
          </span>
          <ChevronDown className="h-4 w-4 text-white/50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 bg-white border border-border shadow-md backdrop-filter-none">
        {projects.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            No projects yet
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[528px]">
            {sortedProjects.map((project) => (
              <DropdownMenuItem
                key={project.id}
                className="flex items-center gap-2 cursor-pointer focus:bg-secondary"
                onSelect={(e) => e.preventDefault()}
              >
                <div
                  className="flex flex-col flex-1 min-w-0"
                  onClick={() => { selectProject(project.id); setOpen(false) }}
                >
                  <span className="font-medium truncate">{project.title}</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0 ml-1">
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    onClick={(e) => startEditing(e, project.id, project.title)}
                    title="Rename"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDeleteProject(e, project.id)}
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
          className="flex items-center gap-2 cursor-pointer text-primary focus:text-primary focus:bg-primary/10"
          onSelect={(e) => e.preventDefault()}
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">New Project</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
