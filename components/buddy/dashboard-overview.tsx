'use client'

import { 
  FileText, CheckCircle2, Clock, TrendingUp, 
  MessageSquare, Sparkles, ArrowRight, BarChart3
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBuddyStore } from '@/lib/store'

export function DashboardOverview() {
  const { getCurrentProject, setViewMode, selectSection } = useBuddyStore()
  const project = getCurrentProject()

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Select or create a project to get started</p>
      </div>
    )
  }

  const allSections = [
    project.outline.introduction,
    ...project.outline.body,
    project.outline.conclusion
  ]

  const completedSections = allSections.filter(s => s.completed).length
  const totalWords = allSections.reduce((acc, s) => 
    acc + (s.content?.split(/\s+/).filter(Boolean).length || 0), 0
  )
  const totalReferences = allSections.reduce((acc, s) => acc + s.references.length, 0)

  const nextIncompleteSection = allSections.find(s => !s.completed)

  const stats = [
    {
      label: 'Progress',
      value: `${completedSections}/${allSections.length}`,
      subtext: 'sections complete',
      icon: CheckCircle2,
      color: 'text-accent'
    },
    {
      label: 'Word Count',
      value: totalWords.toLocaleString(),
      subtext: 'words written',
      icon: FileText,
      color: 'text-primary'
    },
    {
      label: 'References',
      value: totalReferences,
      subtext: 'citations added',
      icon: BarChart3,
      color: 'text-chart-3'
    },
    {
      label: 'Last Updated',
      value: new Date(project.updatedAt).toLocaleDateString(),
      subtext: new Date(project.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      icon: Clock,
      color: 'text-muted-foreground'
    }
  ]

  const handleContinueWriting = () => {
    if (nextIncompleteSection) {
      selectSection(nextIncompleteSection.id)
      setViewMode('writing')
    }
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Project Header */}
        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-bold text-balance">{project.title}</h1>
          <p className="text-muted-foreground">{project.topic}</p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button onClick={handleContinueWriting} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Continue Writing
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setViewMode('canvas')} className="gap-2">
            <TrendingUp className="h-4 w-4" />
            View Canvas
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                      {stat.label}
                    </p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.subtext}</p>
                  </div>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Section Progress */}
        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg">Section Progress</CardTitle>
            <CardDescription>Track your progress through each section</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allSections.map((section, index) => {
                const wordCount = section.content?.split(/\s+/).filter(Boolean).length || 0
                
                return (
                  <button
                    key={section.id}
                    onClick={() => {
                      selectSection(section.id)
                      setViewMode('writing')
                    }}
                    className="w-full text-left p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                          ${section.completed 
                            ? 'bg-accent text-accent-foreground' 
                            : 'bg-secondary text-muted-foreground'}
                        `}>
                          {section.completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                        </div>
                        <span className={`font-medium ${section.completed ? 'text-muted-foreground' : ''}`}>
                          {section.title}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {wordCount} words
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden ml-9">
                      <div 
                        className={`h-full transition-all ${section.completed ? 'bg-accent' : 'bg-primary'}`}
                        style={{ width: section.completed ? '100%' : `${Math.min((wordCount / 500) * 100, 100)}%` }}
                      />
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* AI Suggestions */}
        <Card className="bg-card/50 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              AI Research Assistant
            </CardTitle>
            <CardDescription>
              Ask questions about your research or get writing suggestions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <p className="text-sm text-muted-foreground mb-3">
                Try asking:
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "What's missing from my literature review?",
                  "Suggest sources for my methodology",
                  "Check coherence between sections",
                  "Help me strengthen my thesis"
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    className="text-xs px-3 py-1.5 rounded-full bg-card hover:bg-primary/10 border border-border transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
