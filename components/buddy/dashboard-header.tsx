'use client'

import Image from 'next/image'
import { LayoutGrid, PenTool, Network, TestTube2, Library, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectSwitcher } from './project-switcher'
import { UserProfile } from './user-profile'
import { InstallAppButton } from './install-app-button'
import { useBuddyStore } from '@/lib/store'
import type { ViewMode } from '@/lib/types'

interface DashboardHeaderProps {
  showProjectActions?: boolean
}

export function DashboardHeader({ showProjectActions = true }: DashboardHeaderProps) {
  const { viewMode, setViewMode, getCurrentProject, setShowOnboarding } = useBuddyStore()
  const project = getCurrentProject()

  const viewModes: { mode: ViewMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'dashboard', label: 'Dashboard', icon: <LayoutGrid className="h-4 w-4" /> },
    { mode: 'canvas', label: 'Canvas', icon: <Network className="h-4 w-4" /> },
    { mode: 'writing', label: 'Writing', icon: <PenTool className="h-4 w-4" /> },
    { mode: 'analyzer', label: 'Stats', icon: <TestTube2 className="h-4 w-4" /> },
    { mode: 'literature', label: 'Lit Gap', icon: <Library className="h-4 w-4" /> },
  ]

  return (
    <header className="h-14 border-b border-white/10 flex items-center justify-between px-4" style={{ backgroundColor: '#381d18' }}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Image src="/BUDDY_LOGO_CIRCLE.png" alt="Buddy" width={36} height={36} className="object-contain rounded-full" />
          <span className="font-serif font-semibold text-lg tracking-tight text-white">Buddy</span>
        </div>

        {showProjectActions && (
          <>
            <div className="h-6 w-px bg-white/20" />
            <ProjectSwitcher />
          </>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {project && showProjectActions && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => setShowOnboarding(true)}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
            </Button>

            <div className="flex items-center rounded-lg p-1" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              {viewModes.map(({ mode, label, icon }) => (
                <Button
                  key={mode}
                  variant="ghost"
                  size="sm"
                  className={`gap-2 transition-colors ${
                    viewMode === mode
                      ? 'text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                  style={viewMode === mode ? { backgroundColor: '#a0ad6d' } : {}}
                  onClick={() => setViewMode(mode)}
                >
                  {icon}
                  {viewMode === mode && <span className="hidden sm:inline">{label}</span>}
                </Button>
              ))}
            </div>

          </>
        )}
        <InstallAppButton />
        <UserProfile />
      </div>
    </header>
  )
}
