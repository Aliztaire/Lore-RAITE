'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Menu, MessageSquare, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useBuddyStore } from '@/lib/store'
import type { ViewMode } from '@/lib/types'
import { cn } from '@/lib/utils'
import { NAV_SECTIONS, isNavItemActive } from './navigation'
import { ProjectSwitcher } from './project-switcher'
import { UserProfile } from './user-profile'
import { ThemeToggle } from './theme-toggle'
import { InstallAppButton } from './install-app-button'

function Brand({ onCollapse }: { onCollapse?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-2">
      <Image src="/BUDDY_LOGO_CIRCLE.png" alt="" width={28} height={28} className="object-contain rounded-full" />
      <span className="flex-1 font-serif text-lg font-semibold tracking-tight text-foreground">Buddy</span>
      {onCollapse && (
        <button
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="h-8 w-8 -mr-2 flex items-center justify-center rounded-full text-subtle-foreground hover:text-highlight-strong transition-colors duration-150"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/** Sidebar body, shared by the desktop rail and the mobile drawer. */
function SidebarContent({ onNavigate, onCollapse }: { onNavigate?: () => void; onCollapse?: () => void }) {
  const {
    viewMode, setViewMode, getCurrentProject, showOnboarding, setShowOnboarding,
    chatSidebarOpen, setChatSidebarOpen, selectedSectionId, selectSection,
  } = useBuddyStore()
  const project = getCurrentProject()
  const hasProject = !!project

  const go = (mode: ViewMode) => {
    // Write opens straight into a section: the current one, else the first unfinished one
    if (mode === 'writing' && project) {
      const sections = [project.outline.introduction, ...project.outline.body, project.outline.conclusion]
      if (!sections.some(s => s.id === selectedSectionId)) {
        selectSection((sections.find(s => !s.completed) ?? sections[0]).id)
      }
    }
    setShowOnboarding(false)
    setViewMode(mode)
    onNavigate?.()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-5 pb-4 space-y-5">
        <Brand onCollapse={onCollapse} />
        {hasProject && <ProjectSwitcher />}
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-4 space-y-6">
        {hasProject && NAV_SECTIONS.map((section, i) => (
          <div key={section.label ?? i}>
            {section.label && <p className="eyebrow px-3 mb-2">{section.label}</p>}
            <ul className="space-y-1">
              {section.items.map(item => {
                const active = !showOnboarding && isNavItemActive(item, viewMode)
                const Icon = item.icon
                return (
                  <li key={item.mode}>
                    <button
                      onClick={() => go(item.mode)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-full px-4 py-2 text-sm transition-colors duration-150',
                        active
                          ? 'bg-primary-soft text-primary font-medium'
                          : 'text-muted-foreground hover:text-highlight-strong',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {hasProject && !showOnboarding && (
          <div className="pt-4 border-t border-border">
            <button
              onClick={() => { setChatSidebarOpen(!chatSidebarOpen); onNavigate?.() }}
              aria-pressed={chatSidebarOpen}
              className={cn(
                'w-full flex items-center gap-3 rounded-full px-4 py-2 text-sm transition-colors duration-150',
                chatSidebarOpen ? 'text-foreground bg-accent' : 'text-muted-foreground hover:text-highlight-strong',
              )}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              Research assistant
            </button>
          </div>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-border space-y-1">
        <InstallAppButton />
        <ThemeToggle />
        <UserProfile />
      </div>
    </div>
  )
}

const COLLAPSED_KEY = 'buddy-sidebar-collapsed'

/**
 * Persistent left sidebar (lg and up). Collapses to a slim labelled rail rather than an
 * icon-only strip; the choice is remembered per browser.
 */
export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1') } catch { /* storage unavailable */ }
  }, [])

  const setAndRemember = (value: boolean) => {
    setCollapsed(value)
    try { localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0') } catch { /* storage unavailable */ }
  }

  return (
    <aside
      className={cn(
        'hidden lg:flex shrink-0 h-full flex-col border-r border-border bg-card overflow-hidden transition-[width] duration-200',
        collapsed ? 'w-11' : 'w-64',
      )}
    >
      {collapsed ? (
        <button
          onClick={() => setAndRemember(false)}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="flex-1 flex flex-col items-center pt-5 gap-3 text-muted-foreground hover:text-highlight-strong transition-colors duration-150"
        >
          <PanelLeftOpen className="h-4 w-4" />
          <span className="text-xs [writing-mode:vertical-rl] rotate-180 tracking-wide">Menu</span>
        </button>
      ) : (
        <div className="w-64 h-full">
          <SidebarContent onCollapse={() => setAndRemember(true)} />
        </div>
      )}
    </aside>
  )
}

/** Top bar with a navigation drawer, shown below lg. */
export function MobileTopBar() {
  const [open, setOpen] = useState(false)
  const { getCurrentProject, chatSidebarOpen, setChatSidebarOpen, showOnboarding } = useBuddyStore()
  const project = getCurrentProject()

  return (
    <header className="lg:hidden h-14 shrink-0 flex items-center gap-3 px-4 border-b border-border bg-card">
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-4 flex items-center gap-2 rounded-full border border-input text-sm transition-colors duration-150 hover:text-highlight-strong"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
        Menu
      </button>
      <span className="flex-1 min-w-0 truncate text-sm text-foreground">
        {project && !showOnboarding ? project.title : 'Buddy'}
      </span>
      {/* Mounted here (not just in the desktop AppSidebar) so the post-install
          pin-the-shortcut tip can actually show on mobile, where it matters most. */}
      <InstallAppButton />
      {project && !showOnboarding && (
        <button
          onClick={() => setChatSidebarOpen(!chatSidebarOpen)}
          aria-pressed={chatSidebarOpen}
          className="h-9 px-4 flex items-center gap-2 rounded-full text-sm text-muted-foreground hover:text-highlight-strong transition-colors duration-150"
        >
          <MessageSquare className="h-4 w-4" />
          Assistant
        </button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 p-0 gap-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  )
}
