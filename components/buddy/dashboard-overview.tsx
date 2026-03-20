'use client'

import {
  CheckCircle2, TrendingUp,
  MessageSquare, Sparkles, ArrowRight
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
      percentage: allSections.length ? completedSections / allSections.length : 0,
      stroke: '#3dab68',
    },
    {
      label: 'Word Count',
      value: totalWords.toLocaleString(),
      subtext: 'words written',
      percentage: Math.min(totalWords / 2000, 1),
      stroke: '#d4547a',
    },
    {
      label: 'References',
      value: totalReferences,
      subtext: 'citations added',
      percentage: Math.min(totalReferences / 10, 1),
      stroke: '#3dab68',
    },
    {
      label: 'Last Updated',
      value: new Date(project.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      subtext: new Date(project.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      percentage: 1,
      stroke: '#d4547a',
    },
  ]

  const handleContinueWriting = () => {
    if (nextIncompleteSection) {
      selectSection(nextIncompleteSection.id)
      setViewMode('writing')
    }
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto bg-[#f8f7f8]">
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

        {/* Stats — donut rings */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat) => {
            const r = 40
            const circ = 2 * Math.PI * r
            const offset = circ * (1 - stat.percentage)
            return (
              <div key={stat.label} className="flex flex-col items-center gap-2">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    {/* White fill inside */}
                    <circle cx="50" cy="50" r={r} fill="#f8f7f8" />
                    {/* Gray track */}
                    <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e0e2" strokeWidth="8" />
                    {/* Colored progress */}
                    <circle
                      cx="50" cy="50" r={r}
                      fill="none"
                      stroke={stat.stroke}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circ}
                      strokeDashoffset={offset}
                      className="transition-all duration-500"
                    />
                  </svg>
                  {/* Center text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-lg font-bold leading-tight">{stat.value}</p>
                    {stat.label === 'Last Updated' && (
                      <p className="text-[10px] text-muted-foreground">{stat.subtext}</p>
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{stat.label}</p>
                  {stat.label !== 'Last Updated' && (
                    <p className="text-xs text-muted-foreground">{stat.subtext}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Hourglass Section Progress */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Research Structure</CardTitle>
            <CardDescription>Your paper's progression through the research hourglass</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-8 items-center">

              {/* Hourglass SVG */}
              <div className="shrink-0">
                {(() => {
                  // boundary widths at y = 0,60,120,180,240,300,360
                  const bw = [200, 130, 60, 4, 60, 130, 200]
                  const SH = 60 // section height
                  const W  = 200
                  const colors = ['#3dab68','#5dc48a','#e87aaa','#d4547a','#5dc48a','#3dab68']

                  return (
                    <svg viewBox="0 0 200 360" width="160" height="360">
                      {allSections.map((section, i) => {
                        const lt = (W - bw[i])   / 2
                        const rt = (W + bw[i])   / 2
                        const lb = (W - bw[i+1]) / 2
                        const rb = (W + bw[i+1]) / 2
                        const yt = i * SH
                        const yb = (i + 1) * SH
                        const cy = yt + SH / 2
                        const fill = section.completed ? colors[i] : '#e2e0e2'

                        return (
                          <g
                            key={section.id}
                            className="cursor-pointer"
                            onClick={() => { selectSection(section.id); setViewMode('writing') }}
                          >
                            <polygon
                              points={`${lt},${yt} ${rt},${yt} ${rb},${yb} ${lb},${yb}`}
                              fill={fill}
                              opacity={0.88}
                            />
                            {/* Number badge */}
                            <circle cx={100} cy={cy} r={13} fill="white" stroke={fill} strokeWidth={2} />
                            <text
                              x={100} y={cy + 4.5}
                              textAnchor="middle"
                              fontSize="11"
                              fontWeight="700"
                              fill={section.completed ? colors[i] : '#aaa'}
                            >
                              {i + 1}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  )
                })()}
              </div>

              {/* Section labels */}
              <div className="flex-1 space-y-1">
                {allSections.map((section) => {
                  const wordCount = section.content?.split(/\s+/).filter(Boolean).length || 0
                  return (
                    <button
                      key={section.id}
                      onClick={() => { selectSection(section.id); setViewMode('writing') }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary/50 transition-colors flex items-start gap-3 group"
                    >
                      <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 transition-colors ${section.completed ? 'text-accent' : 'text-muted-foreground/25 group-hover:text-muted-foreground/50'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${section.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {section.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{section.description}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{wordCount}w</span>
                    </button>
                  )
                })}
              </div>

            </div>
          </CardContent>
        </Card>

        {/* AI Suggestions */}
        <Card className="bg-white border-primary/20">
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
