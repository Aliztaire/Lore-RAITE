'use client'

import { useState } from 'react'
import { ChevronDown, Trash2, FolderOpen } from 'lucide-react'
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
  const { projects, currentProjectId, selectProject, deleteProject } = useBuddyStore()
  const currentProject = projects.find(p => p.id === currentProjectId)

  const handleDeleteProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (confirm('Are you sure you want to delete this project?')) {
      deleteProject(id)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 px-3 py-2 h-auto text-foreground hover:bg-secondary"
        >
          <FolderOpen className="h-4 w-4 text-primary" />
          <span className="font-medium truncate max-w-[180px]">
            {currentProject?.title || 'Select Project'}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {projects.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            No projects yet
          </div>
        ) : (
          projects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onClick={() => selectProject(project.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-medium truncate">{project.title}</span>
                <span className="text-xs text-muted-foreground truncate">
                  {project.topic}
                </span>
              </div>
              {currentProjectId !== project.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 ml-2 hover:bg-destructive/20 hover:text-destructive"
                  onClick={(e) => handleDeleteProject(e, project.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
