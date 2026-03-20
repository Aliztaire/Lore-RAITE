'use client'

import { useEffect, useState } from 'react'
import { useBuddyStore } from '@/lib/store'
import { Onboarding } from '@/components/buddy/onboarding'
import { DashboardHeader } from '@/components/buddy/dashboard-header'
import { ChecklistSidebar } from '@/components/buddy/checklist-sidebar'
import { DashboardOverview } from '@/components/buddy/dashboard-overview'
import { NodeCanvas } from '@/components/buddy/node-canvas'
import { WritingView } from '@/components/buddy/writing-view'
import { GlobalAIChat } from '@/components/buddy/global-ai-chat'
import { exportToDocx, downloadBlob } from '@/lib/export'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'

export default function BuddyApp() {
  const { showOnboarding, viewMode, getCurrentProject, projects } = useBuddyStore()
  const project = getCurrentProject()
  const [isHydrated, setIsHydrated] = useState(false)

  const { user, loading } = useAuth()
  const router = useRouter()

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
    
    try {
      const blob = await exportToDocx(project)
      const filename = `${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`
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
      <div className="min-h-screen bg-background flex flex-col">
        <DashboardHeader onExport={handleExport} showProjectActions={false} />
        <Onboarding />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <DashboardHeader onExport={handleExport} />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        {viewMode === 'dashboard' && <DashboardOverview />}
        {viewMode === 'canvas' && <NodeCanvas />}
        {viewMode === 'writing' && <WritingView />}

        {/* Checklist Sidebar - shown in dashboard and writing views */}
        {(viewMode === 'dashboard' || viewMode === 'writing') && project && (
          <ChecklistSidebar />
        )}
      </div>

      {/* Global AI Chat FAB */}
      {project && <GlobalAIChat />}
    </div>
  )
}
