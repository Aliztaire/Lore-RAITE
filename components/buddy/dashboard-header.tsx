'use client'

import { BookOpen, LayoutGrid, PenTool, Download, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectSwitcher } from './project-switcher'
import { useBuddyStore } from '@/lib/store'
import type { ViewMode } from '@/lib/types'

interface DashboardHeaderProps {
  onExport?: () => void
}

export function DashboardHeader({ onExport }: DashboardHeaderProps) {
  const { viewMode, setViewMode, getCurrentProject } = useBuddyStore()
  const project = getCurrentProject()

  const viewModes: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'dashboard', label: 'Dashboard', icon: <LayoutGrid className="h-4 w-4" /> },
    { mode: 'canvas', label: 'Canvas', icon: <Sparkles className="h-4 w-4" /> },
    { mode: 'writing', label: 'Writing', icon: <PenTool className="h-4 w-4" /> },
  ]

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span className="font-serif font-semibold text-lg tracking-tight">Buddy</span>
        </div>
        
        <div className="h-6 w-px bg-border" />
        
        <ProjectSwitcher />
      </div>

      {project && (
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary rounded-lg p-1">
            {viewModes.map(({ mode, label, icon }) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'default' : 'ghost'}
                size="sm"
                className={`gap-2 ${viewMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setViewMode(mode)}
              >
                {icon}
                <span className="hidden sm:inline">{label}</span>
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      )}
    </header>
  )
}
