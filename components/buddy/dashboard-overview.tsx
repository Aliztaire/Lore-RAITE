'use client'

import { useState } from 'react'
import { ArrowRight, BarChart3, Check, ExternalLink, Library, Loader2, Mic, Network, Plus } from 'lucide-react'
import { useBuddyStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function DashboardOverview() {
  const { getCurrentProject, setViewMode, selectSection, setVoiceNotePanelOpen, isVoiceNotePanelOpen, updateProject, addToBibliography, removeFromBibliography } = useBuddyStore()
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

  // Every reference in the paper, de-duplicated (by DOI, else title), with the section it came from
  const seenRefs = new Set<string>()
  const references = allSections.flatMap(s => s.references.map(r => ({ ref: r, section: s }))).filter(({ ref }) => {
    const key = (ref.doi || ref.title).toLowerCase()
    if (seenRefs.has(key)) return false
    seenRefs.add(key)
    return true
  })
  const bibliography = new Set(project.bibliography ?? [])
  const inBibliographyCount = references.filter(({ ref }) => bibliography.has(ref.id)).length
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
    { label: 'Sources collected', value: references.length.toString() },
    { label: 'Last edited', value: updated.toLocaleDateString([], { month: 'short', day: 'numeric' }), meta: updated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) },
  ]

  const tools = [
    { label: 'Concept map', icon: Network, desc: 'See how ideas and sections connect across the paper.', onClick: () => setViewMode('canvas') },
    { label: 'Voice notes', icon: Mic, desc: 'Record and transcribe quick thoughts while you research.', onClick: () => setVoiceNotePanelOpen(!isVoiceNotePanelOpen), pressed: isVoiceNotePanelOpen },
    { label: 'Data analysis', icon: BarChart3, desc: 'Choose and run the right statistical test for your data.', onClick: () => setViewMode('analyzer') },
    { label: 'Literature gap', icon: Library, desc: 'Compare your draft against your bibliography.', onClick: () => setViewMode('literature') },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-background @container">
      <div className="w-full px-8 py-12">

        {/* Title block */}
        <header className="pb-8 border-b border-border flex flex-col-reverse gap-8 @4xl:flex-row @4xl:items-start @4xl:justify-between">
          <div className="min-w-0">
          <p className="eyebrow mb-3">Research paper</p>
          <h1 className="font-serif text-4xl font-semibold text-foreground max-w-3xl">
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
          </div>

          {/* Tools */}
          <nav aria-label="Tools" className="flex flex-wrap gap-2 @4xl:shrink-0 @4xl:justify-end">
            {tools.map(t => (
              <Button
                key={t.label}
                variant="outline"
                size="sm"
                onClick={t.onClick}
                title={t.desc}
                aria-pressed={t.pressed}
                className={cn(t.pressed && 'bg-accent')}
              >
                <t.icon />
                {t.label}
              </Button>
            ))}
          </nav>
        </header>

        {/* Stats */}
        <dl className="grid grid-cols-2 @3xl:grid-cols-4 border-b border-border">
          {stats.map((s, i) => (
            <div key={s.label} className={cn('py-6', i > 0 && '@3xl:pl-6 @3xl:border-l border-border', i % 2 === 1 && 'pl-6 border-l')}>
              <dt className="eyebrow">{s.label}</dt>
              <dd className="mt-2 font-serif text-2xl text-foreground tabular-nums">
                {s.value}
                {s.meta && <span className="ml-2 font-sans text-sm text-subtle-foreground">{s.meta}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <div className="pt-10 grid gap-12 @4xl:grid-cols-2">

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
                      className="w-full text-left flex items-center gap-4 px-2 py-4 transition-colors duration-150 group hover:text-highlight-strong"
                    >
                      <span className="w-6 text-sm text-subtle-foreground tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-base text-foreground truncate group-hover:text-highlight-strong transition-colors duration-150">{section.title}</span>
                        {section.description && (
                          <span className="block text-xs text-subtle-foreground truncate mt-1">{section.description}</span>
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

          {/* References */}
          <section aria-labelledby="references-heading">
            <div className="flex items-baseline justify-between mb-3">
              <h2 id="references-heading" className="font-serif text-xl font-semibold">References</h2>
              <span className="text-sm text-muted-foreground tabular-nums">
                {inBibliographyCount} of {references.length} in bibliography
              </span>
            </div>
            <div className="h-1 mb-4" aria-hidden />

            {references.length === 0 ? (
              <div className="border-y border-border py-6">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No references yet. In Write, ask the assistant to find literature, or use Find references.
                </p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setViewMode('writing')}>
                  Open Write <ArrowRight />
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border border-y border-border max-h-[min(60vh,36rem)] overflow-y-auto overscroll-contain pr-3" aria-label="References" tabIndex={0}>
                {references.map(({ ref, section }) => {
                  const inBib = bibliography.has(ref.id)
                  const firstAuthor = ref.authors[0]?.trim().split(/\s+/).at(-1)
                  const href = ref.doi ? (ref.doi.startsWith('http') ? ref.doi : `https://doi.org/${ref.doi}`) : undefined
                  return (
                    <li key={ref.id} className="py-4">
                      <div className="flex items-start gap-3">
                        <p className="flex-1 min-w-0 text-sm leading-snug text-foreground">{ref.title}</p>
                        {href && (
                          <a href={href} target="_blank" rel="noopener noreferrer" title="Open DOI"
                            className="shrink-0 mt-1 text-subtle-foreground hover:text-highlight-strong transition-colors duration-150">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {firstAuthor ? `${firstAuthor}${ref.authors.length > 1 ? ' et al.' : ''}` : 'Unknown author'} · {ref.year}
                        {ref.journal && <> · <i>{ref.journal}</i></>}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-xs text-subtle-foreground truncate">Found in {section.title}</span>
                        <button
                          onClick={() => inBib ? removeFromBibliography(ref.id) : addToBibliography(ref.id)}
                          aria-pressed={inBib}
                          className={cn(
                            'shrink-0 inline-flex items-center gap-1 text-xs transition-colors duration-150 hover:text-highlight-strong',
                            inBib ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {inBib ? <><Check className="h-3 w-3" /> In bibliography</> : <><Plus className="h-3 w-3" /> Use in paper</>}
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

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
                className="w-full px-5 py-3 rounded-full border border-input bg-card text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15 transition-colors"
                placeholder="Enter your paper title…"
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="eyebrow">Suggested titles</span>
                {loadingSuggestions && <Loader2 className="h-3 w-3 animate-spin text-subtle-foreground" />}
              </div>

              {loadingSuggestions ? (
                <div className="border-y border-border divide-y divide-border">
                  {[1, 2, 3].map(i => <div key={i} className="py-3"><div className="h-4 w-3/4 rounded-md bg-muted" /></div>)}
                </div>
              ) : suggestions.length > 0 ? (
                <ul className="border-y border-border divide-y divide-border">
                  {suggestions.map((s, i) => {
                    const on = paperName === s
                    return (
                      <li key={i}>
                        <button
                          onClick={() => setPaperName(s)}
                          aria-pressed={on}
                          className={cn(
                            'w-full text-left flex items-start gap-3 px-2 py-3 text-sm transition-colors duration-150',
                            on ? 'text-foreground' : 'text-muted-foreground hover:text-highlight-strong',
                          )}
                        >
                          <Check className={cn('h-4 w-4 mt-1 shrink-0 text-primary', !on && 'invisible')} />
                          {s}
                        </button>
                      </li>
                    )
                  })}
                </ul>
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
