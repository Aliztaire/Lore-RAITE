'use client'

import Image from 'next/image'
import { MessageSquare, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectSwitcher } from './project-switcher'
import { UserProfile } from './user-profile'
import { useBuddyStore } from '@/lib/store'
import type { ViewMode } from '@/lib/types'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  showProjectActions?: boolean
}

const VIEW_MODES: { mode: ViewMode; label: string }[] = [
  { mode: 'dashboard', label: 'Overview' },
  { mode: 'writing', label: 'Writing' },
  { mode: 'canvas', label: 'Canvas' },
  { mode: 'analyzer', label: 'Statistics' },
  { mode: 'literature', label: 'Literature' },
]

export function DashboardHeader({ showProjectActions = true }: DashboardHeaderProps) {
  const { viewMode, setViewMode, getCurrentProject, setShowOnboarding, chatSidebarOpen, setChatSidebarOpen } = useBuddyStore()
  const project = getCurrentProject()
  const showNav = project && showProjectActions

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card flex items-center justify-between px-5 gap-6">
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <Image src="/BUDDY_LOGO_CIRCLE.png" alt="" width={28} height={28} className="object-contain rounded-full" />
          <span className="font-serif text-lg font-semibold tracking-tight text-foreground">Buddy</span>
        </div>

        {showProjectActions && (
          <>
            <div className="h-5 w-px bg-border shrink-0" />
            <ProjectSwitcher />
          </>
        )}
      </div>

      {showNav && (
        <nav aria-label="Views" className="hidden md:flex items-stretch h-full gap-1">
          {VIEW_MODES.map(({ mode, label }) => {
            const active = viewMode === mode
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative px-3 text-sm transition-colors duration-150',
                  active ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
                <span
                  className={cn(
                    'absolute left-3 right-3 bottom-0 h-0.5 bg-primary transition-opacity duration-150',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />
              </button>
            )
          })}
        </nav>
      )}

      <div className="flex items-center gap-3 shrink-0">
        {showNav && (
          <>
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={chatSidebarOpen}
              className={cn(chatSidebarOpen ? 'bg-accent text-foreground' : 'text-muted-foreground')}
              onClick={() => setChatSidebarOpen(!chatSidebarOpen)}
            >
              <MessageSquare />
              Assistant
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowOnboarding(true)}>
              <Plus />
              New paper
            </Button>
          </>
        )}
        <UserProfile />
      </div>
    </header>
  )
}
