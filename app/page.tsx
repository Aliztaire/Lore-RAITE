'use client'

import { useEffect, useState } from 'react'
import { useBuddyStore } from '@/lib/store'
import { Onboarding } from '@/components/buddy/onboarding'
import { DashboardHeader } from '@/components/buddy/dashboard-header'
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
import { useSyncPendingVoiceNotes } from '@/hooks/use-sync-pending-voice-notes'

export default function BuddyApp() {
  const { showOnboarding, viewMode, getCurrentProject, projects, focusMode, setVoiceNotePanelOpen, setAutoStartRecording } = useBuddyStore()
  const project = getCurrentProject()
  const [isHydrated, setIsHydrated] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const { user, loading } = useAuth()
  const router = useRouter()

  useSyncPendingVoiceNotes()

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

  // Quick-capture deep link from the PWA manifest's "New Voice Note" shortcut
  // (?quickCapture=voice). If there's no project yet, the flags still land —
  // VoiceNoteTaker picks them up once a project exists and the panel mounts.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('quickCapture') !== 'voice') return
    setVoiceNotePanelOpen(true)
    setAutoStartRecording(true)
    params.delete('quickCapture')
    const query = params.toString()
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleExport = async () => {
    if (!project) return

    const filename = `${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`
    const confirmed = confirm(`Export "${project.title}" as a Word document?\n\nThe file will be saved as: ${filename}`)
    if (!confirmed) return

    try {
      const blob = await exportToDocx(project)
      downloadBlob(blob, filename)
    } catch (error) {
      console.error('[v0] Export failed:', error)
      alert('Export failed. Please try again.')
    }
  }

  // Show loading state during hydration
  if (!isHydrated || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-muted-foreground">Loading Buddy...</span>
        </div>
      </div>
    )
  }

  // Auth protection overlay or redirect
  if (!user && !loading) {
    return null // We don't render anything while redirecting
  }

  // Show onboarding if no projects or explicitly showing onboarding
  if (showOnboarding || (projects.length === 0 && !project)) {
    return (
      <div className="h-screen bg-background flex flex-col">
        <DashboardHeader showProjectActions={false} />
        <Onboarding />
      </div>
    )
  }

  return (
    <div className="h-screen bg-background flex flex-col">
      <DashboardHeader />
      {showPreview && project && (
        <DocumentPreviewModal project={project} onClose={() => setShowPreview(false)} onExport={handleExport} />
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Voice Notes Panel */}
        {project && <VoiceNoteTaker />}

        {/* Main Content Area */}
        {viewMode === 'dashboard' && <DashboardOverview />}
        {viewMode === 'canvas' && <NodeCanvas />}
        {viewMode === 'writing' && <WritingView />}
        {viewMode === 'analyzer' && <Analyzer />}
        {viewMode === 'literature' && <IntegratedLiteratureAnalyzer onPreview={() => setShowPreview(true)} />}

        {/* Checklist Sidebar - shown in dashboard and writing views (hidden in writing focus mode) */}
        {(viewMode === 'dashboard' || (viewMode === 'writing' && !focusMode)) && project && (
          <ChecklistSidebar />
        )}
      </div>

      <GlobalAIChat />
    </div>
  )
}
