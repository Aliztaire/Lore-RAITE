'use client'

import { useState } from 'react'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { useBuddyStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function DashboardOverview() {
  const { getCurrentProject, setViewMode, selectSection, setVoiceNotePanelOpen, isVoiceNotePanelOpen, updateProject } = useBuddyStore()
  const project = getCurrentProject()
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [paperName, setPaperName] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  const allSections = project ? [
    project.outline.introduction,
    ...project.outline.body,
    project.outline.conclusion
  ] : []

  const completedSections = allSections.filter(s => s.completed).length

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Select or create a paper to get started.</p>
      </div>
    )
  }
  const totalWords = allSections.reduce((acc, s) =>
    acc + (s.content?.split(/\s+/).filter(Boolean).length || 0), 0
  )
  const totalReferences = allSections.reduce((acc, s) => acc + s.references.length, 0)
  const nextIncompleteSection = allSections.find(s => !s.completed)
  const progressPct = allSections.length ? Math.round((completedSections / allSections.length) * 100) : 0
  const updated = new Date(project.updatedAt)

  const handleContinueWriting = () => {
    if (nextIncompleteSection) {
      selectSection(nextIncompleteSection.id)
      setViewMode('writing')
    }
  }

  const openCompleteModal = () => {
    setPaperName(project.title)
    setSuggestions([])
    setShowCompleteModal(true)
    fetchSuggestions(project.title)
  }

  const fetchSuggestions = async (currentTitle: string) => {
    setLoadingSuggestions(true)
    try {
      const res = await fetch('/api/suggest-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTitle,
          topic: project.topic,
          sectionTitles: allSections.map(s => s.title),
        }),
      })
      const data = await res.json()
      setSuggestions(data.titles || [])
    } catch {
      setSuggestions([])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleConfirmComplete = () => {
    const name = paperName.trim() || project.title
    if (name !== project.title) {
      updateProject(project.id, { title: name, updatedAt: new Date().toISOString() })
    }
    setShowCompleteModal(false)
    setViewMode('literature')
  }

  const stats = [
    { label: 'Sections complete', value: `${completedSections} of ${allSections.length}` },
    { label: 'Words written', value: totalWords.toLocaleString() },
    { label: 'Sources collected', value: totalReferences.toString() },
    { label: 'Last edited', value: updated.toLocaleDateString([], { month: 'short', day: 'numeric' }), meta: updated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) },
  ]

  const tools = [
    { label: 'Concept map', desc: 'See how ideas and sections connect across the paper.', onClick: () => setViewMode('canvas') },
    { label: 'Voice notes', desc: 'Record and transcribe quick thoughts while you research.', onClick: () => setVoiceNotePanelOpen(!isVoiceNotePanelOpen) },
    { label: 'Statistical analysis', desc: 'Choose and run the right test for your data.', onClick: () => setViewMode('analyzer') },
    { label: 'Literature gap analysis', desc: 'Compare your draft against your bibliography.', onClick: () => setViewMode('literature') },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-10 py-12">

        {/* Title block */}
        <header className="pb-8 border-b border-border">
          <p className="eyebrow mb-3">Research paper</p>
          <h1 className="font-serif text-[2rem] leading-tight font-semibold text-foreground max-w-3xl">
            {project.title}
          </h1>
          {project.topic && project.topic !== project.title && (
            <p className="mt-3 text-muted-foreground max-w-2xl leading-relaxed">{project.topic}</p>
          )}

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {nextIncompleteSection ? (
              <Button onClick={handleContinueWriting}>
                Continue writing: {nextIncompleteSection.title}
                <ArrowRight />
              </Button>
            ) : (
              <Button onClick={() => setViewMode('writing')}>
                Open manuscript
                <ArrowRight />
              </Button>
            )}
            <Button variant="outline" onClick={openCompleteModal}>
              Finalize paper
            </Button>
          </div>
        </header>

        {/* Stats */}
        <dl className="grid grid-cols-2 md:grid-cols-4 border-b border-border">
          {stats.map((s, i) => (
            <div key={s.label} className={cn('py-6', i > 0 && 'md:pl-6 md:border-l border-border', i % 2 === 1 && 'pl-6 border-l md:border-l')}>
              <dt className="eyebrow">{s.label}</dt>
              <dd className="mt-2 font-serif text-2xl text-foreground tabular-nums">
                {s.value}
                {s.meta && <span className="ml-2 font-sans text-sm text-subtle-foreground">{s.meta}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <div className="grid md:grid-cols-[1fr_18rem] gap-12 pt-10">

          {/* Sections */}
          <section aria-labelledby="sections-heading">
            <div className="flex items-baseline justify-between mb-3">
              <h2 id="sections-heading" className="font-serif text-xl font-semibold">Outline</h2>
              <span className="text-sm text-muted-foreground tabular-nums">{progressPct}% complete</span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden mb-4" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary transition-[width] duration-200" style={{ width: `${progressPct}%` }} />
            </div>

            <ol className="divide-y divide-border border-y border-border">
              {allSections.map((section, i) => {
                const wordCount = section.content?.split(/\s+/).filter(Boolean).length || 0
                const status = section.completed ? 'Complete' : wordCount > 0 ? 'In progress' : 'Not started'
                return (
                  <li key={section.id}>
                    <button
                      onClick={() => { selectSection(section.id); setViewMode('writing') }}
                      className="w-full text-left flex items-center gap-4 px-2 py-3.5 hover:bg-accent/60 transition-colors duration-150 group"
                    >
                      <span className="w-6 text-sm text-subtle-foreground tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[0.95rem] text-foreground truncate">{section.title}</span>
                        {section.description && (
                          <span className="block text-xs text-subtle-foreground truncate mt-0.5">{section.description}</span>
                        )}
                      </span>
                      <span className="text-xs text-subtle-foreground tabular-nums w-16 text-right">{wordCount.toLocaleString()} words</span>
                      <span className={cn(
                        'text-xs w-24 text-right flex items-center justify-end gap-1',
                        section.completed ? 'text-primary' : 'text-muted-foreground',
                      )}>
                        {section.completed && <Check className="h-3.5 w-3.5" />}
                        {status}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>

          {/* Tools */}
          <aside aria-labelledby="tools-heading">
            <h2 id="tools-heading" className="font-serif text-xl font-semibold mb-4">Tools</h2>
            <ul className="space-y-1">
              {tools.map(t => (
                <li key={t.label}>
                  <button
                    onClick={t.onClick}
                    className="w-full text-left px-3 py-3 -mx-3 rounded-md hover:bg-accent/60 transition-colors duration-150 group"
                  >
                    <span className="flex items-center justify-between text-sm font-medium text-foreground">
                      {t.label}
                      <ArrowRight className="h-3.5 w-3.5 text-subtle-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                    </span>
                    <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.desc}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>

      {/* Finalize dialog */}
      <Dialog open={showCompleteModal} onOpenChange={setShowCompleteModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Finalize your paper</DialogTitle>
            <DialogDescription>Confirm or revise the title before running the literature gap analysis.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <label htmlFor="paper-title" className="eyebrow block mb-2">Paper title</label>
              <input
                id="paper-title"
                type="text"
                value={paperName}
                onChange={e => setPaperName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md border border-input bg-card text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15 transition-colors"
                placeholder="Enter your paper title…"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="eyebrow">Suggested titles</span>
                {loadingSuggestions && <Loader2 className="h-3 w-3 animate-spin text-subtle-foreground" />}
              </div>

              {loadingSuggestions ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <div key={i} className="h-9 rounded-md bg-muted" />)}
                </div>
              ) : suggestions.length > 0 ? (
                <div className="space-y-1.5">
                  {suggestions.map((s, i) => {
                    const on = paperName === s
                    return (
                      <button
                        key={i}
                        onClick={() => setPaperName(s)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-md border text-sm transition-colors duration-150',
                          on ? 'border-primary bg-primary-soft text-foreground' : 'border-border hover:bg-accent/60',
                        )}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No suggestions available. You can still edit the title above.</p>
              )}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setShowCompleteModal(false)}>Cancel</Button>
            <Button onClick={handleConfirmComplete}>Save and continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
