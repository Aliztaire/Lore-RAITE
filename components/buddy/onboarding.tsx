'use client'

import { useState } from 'react'
import { BookOpen, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBuddyStore } from '@/lib/store'
import { UserProfile } from './user-profile'

export function Onboarding() {
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { createProject, projects, selectProject, setShowOnboarding } = useBuddyStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !topic.trim()) return

    setIsLoading(true)
    // Simulate AI processing delay
    await new Promise(resolve => setTimeout(resolve, 800))
    createProject(title.trim(), topic.trim())
    setIsLoading(false)
  }

  const handleSelectExisting = (projectId: string) => {
    selectProject(projectId)
    setShowOnboarding(false)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <UserProfile />
      </div>
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold mb-2">Welcome to Buddy</h1>
          <p className="text-muted-foreground">Your AI-powered research companion</p>
        </div>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Start a New Research Project
            </CardTitle>
            <CardDescription>
              Tell me about your research and I will help scaffold your paper
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="title" className="text-sm font-medium">
                  Research Title
                </label>
                <Input
                  id="title"
                  placeholder="e.g., The Impact of AI on Modern Education"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-input"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="topic" className="text-sm font-medium">
                  Research Topic & Context
                </label>
                <Textarea
                  id="topic"
                  placeholder="Describe your research focus, key questions, and any specific requirements..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={4}
                  className="bg-input resize-none"
                />
              </div>

              <Button
                type="submit"
                className="w-full gap-2"
                disabled={!title.trim() || !topic.trim() || isLoading}
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
          </CardContent>
        </Card>

        {projects.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground text-center mb-3">
              Or continue with an existing project
            </p>
            <div className="space-y-2">
              {projects.slice(0, 3).map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleSelectExisting(project.id)}
                  className="w-full p-3 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-left"
                >
                  <div className="font-medium truncate">{project.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {project.topic}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
