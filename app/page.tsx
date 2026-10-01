'use client'

import { useEffect, useState } from 'react'
import { useBuddyStore } from '@/lib/store'
import { Onboarding } from '@/components/buddy/onboarding'
import { AppSidebar, MobileTopBar } from '@/components/buddy/app-sidebar'
import { ChecklistSidebar } from '@/components/buddy/checklist-sidebar'
import { DashboardOverview } from '@/components/buddy/dashboard-overview'
import { NodeCanvas } from '@/components/buddy/node-canvas'
import { WritingView } from '@/components/buddy/writing-view'
import { VoiceNoteTaker } from '@/components/buddy/voice-note-taker'
import { GlobalAIChat } from '@/components/buddy/global-ai-chat'
import { Analyzer } from '@/components/Analyzer'
import { IntegratedLiteratureAnalyzer } from '@/components/buddy/integrated-literature-analyzer'
import { exportToDocx, downloadBlob } from '@/lib/export'
import { DocumentPreviewModal } from '@/components/buddy/document-preview-modal'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { useConfirm } from '@/components/buddy/confirm-dialog'
import { Appear } from '@/components/buddy/appear'
import type { ViewMode } from '@/lib/types'

interface ViewContext {
  openPreview: () => void
}

/**
 * One entry per ViewMode. Typed as a full Record, so adding a ViewMode (e.g. 'adviser',
 * 'ai-log') fails to compile until its view is registered here; then add a NavItem in
 * components/buddy/navigation.ts.
 */
const VIEWS: Record<ViewMode, (ctx: ViewContext) => React.ReactNode> = {
  dashboard: () => <DashboardOverview />,
  canvas: () => <NodeCanvas />,
  writing: () => <WritingView />,
  literature: ({ openPreview }) => <IntegratedLiteratureAnalyzer onPreview={openPreview} />,
  analyzer: () => <Analyzer />,
}

export default function BuddyApp() {
  const { showOnboarding, viewMode, getCurrentProject, projects, focusMode, chatSidebarOpen, chatSidebarPinned } = useBuddyStore()
  const project = getCurrentProject()
  const [isHydrated, setIsHydrated] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const { user, loading } = useAuth()
  const router = useRouter()
  const { confirm, notify } = useConfirm()

  // Handle hydration mismatch with localStorage
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!loading && !user && isHydrated) {
      router.push('/login')
    }
  }, [user, loading, router, isHydrated])

  const handleExport = async () => {
    if (!project) return

    const filename = `${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`
    const confirmed = await confirm({
      title: 'Export as Word document',
      description: <>&ldquo;{project.title}&rdquo; will be saved as <span className="text-foreground">{filename}</span>.</>,
      confirmLabel: 'Export',
    })
    if (!confirmed) return

    try {
      const blob = await exportToDocx(project)
      downloadBlob(blob, filename)
    } catch (error) {
      console.error('[v0] Export failed:', error)
      await notify({ title: 'Export failed', description: 'The document could not be generated. Please try again.' })
    }
  }

  // Show loading state during hydration
  if (!isHydrated || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  // Auth protection overlay or redirect
  if (!user && !loading) {
    return null // We don't render anything while redirecting
  }

  const onboarding = showOnboarding || (projects.length === 0 && !project)
  // When the assistant is pinned open beside the manuscript, the outline gives way so the page keeps a readable width.
  const assistantPinnedOpen = chatSidebarOpen && chatSidebarPinned

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <AppSidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar />

        {showPreview && project && (
          <DocumentPreviewModal project={project} onClose={() => setShowPreview(false)} onExport={handleExport} />
        )}

        <div className="flex-1 flex overflow-hidden relative">
          {onboarding ? (
            <Onboarding />
          ) : (
            <>
              {project && <VoiceNoteTaker />}

              <main className="flex-1 min-w-0 flex">
                <Appear id={viewMode} className="flex-1 min-w-0 flex">
                  {VIEWS[viewMode]({ openPreview: () => setShowPreview(true) })}
                </Appear>
              </main>

              {viewMode === 'writing' && !focusMode && project && !assistantPinnedOpen && (
                <ChecklistSidebar />
              )}

              <GlobalAIChat />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
