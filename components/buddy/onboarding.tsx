'use client'

import { useState } from 'react'
import { BookOpen, ArrowRight, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useBuddyStore } from '@/lib/store'
import { UserProfile } from './user-profile'
import { cn } from '@/lib/utils'

export function Onboarding() {
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { createProject, projects, selectProject, setShowOnboarding } = useBuddyStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return

    // First line = title, rest = topic. If single line, use as both.
    const lines = text.trim().split('\n')
    const title = lines[0].trim()
    const topic = lines.slice(1).join('\n').trim() || title

    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 800))
    createProject(title, topic)
    setIsLoading(false)
  }

  const handleSelectExisting = (projectId: string) => {
    selectProject(projectId)
    setShowOnboarding(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left sidebar — existing projects */}
      {projects.length > 0 && (
        <aside className="w-64 shrink-0 border-r border-border bg-card flex flex-col p-4 gap-2">
          <div className="flex items-center gap-2 px-2 py-3 mb-1">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Your Projects</span>
          </div>
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleSelectExisting(project.id)}
              className={cn(
                'w-full text-left px-3 py-3 rounded-xl border border-transparent',
                'hover:bg-primary/8 hover:border-primary/20 transition-all',
                'group'
              )}
            >
              <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                {project.title}
              </div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {project.topic}
              </div>
            </button>
          ))}
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-8 -mt-16 relative">
        <div className="absolute top-4 right-4">
          <UserProfile />
        </div>
        <div className="w-full max-w-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-serif text-3xl font-bold mb-1">Hey, Buddy!</h1>
            <p className="text-muted-foreground text-sm">What are we researching today?</p>
          </div>

          {/* Single big textbox */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-secondary/50 border border-border rounded-2xl px-5 py-4 focus-within:border-primary transition-all">
              <Textarea
                placeholder={"Start with your research title on the first line,\nthen describe your focus, key questions, and context below..."}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                className="bg-transparent border-0 focus-visible:ring-0 px-0 py-0 text-base placeholder:text-muted-foreground/50 resize-none font-serif leading-relaxed"
              />
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={!text.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating Project...
                </>
              ) : (
                <>
                  Create Project
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
