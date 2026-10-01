'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, ArrowLeft, Pencil, Trash2, Check, X, Search,
         Loader2, ChevronDown, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useBuddyStore } from '@/lib/store'
import type { Reference } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useConfirm } from './confirm-dialog'

// ── helpers ────────────────────────────────────────────────────────────────────

function toAPA7Author(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  const last = parts[parts.length - 1]
  const inits = parts.slice(0, -1).map(p => p[0]?.toUpperCase() + '.').join(' ')
  return `${last}, ${inits}`
}

function buildCitation(r: { title: string; authors: string[]; year: string; journal?: string | null; doi?: string | null }) {
  const auths = r.authors.map(toAPA7Author)
  const authStr = auths.length === 0 ? 'Unknown' : auths.length === 1 ? auths[0] : auths.length === 2 ? `${auths[0]}, & ${auths[1]}` : auths.slice(0, -1).join(', ') + ', & ' + auths[auths.length - 1]
  let c = `${authStr} (${r.year}). ${r.title}.`
  if (r.journal) c += ` ${r.journal}.`
  if (r.doi) c += ` ${r.doi.startsWith('http') ? r.doi : `https://doi.org/${r.doi}`}`
  return c
}

function openAlexResultToReference(r: any): Reference {
  return {
    id: r.id || Math.random().toString(36).slice(2),
    title: r.title,
    authors: r.authors,
    year: r.year,
    type: 'article',
    citation: buildCitation(r),
    doi: r.doi ?? undefined,
    journal: r.journal ?? undefined,
    notes: r.abstract ?? '',
  }
}

const PLACEHOLDER_EXAMPLES = [
  'e.g., "Communicating with patients with schizophrenia"',
  'e.g., "The effect of childhood trauma on adult attachment styles"',
  'e.g., "Cognitive behavioral therapy for generalized anxiety disorder"',
  'e.g., "The psychology of social conformity in adolescent peer groups"',
  'e.g., "Mindfulness-based stress reduction in college students"',
  'e.g., "The relationship between sleep deprivation and emotional regulation"',
]

type Step = 'input' | 'questions' | 'recommend'

interface AIQuestion { id: string; question: string; placeholder: string }
interface RRLPaper { id: string; title: string; authors: string[]; year: string; doi: string | null; journal: string | null; abstract: string; type: 'rrl' }
interface RRWPaper  { id: string; title: string; authors: string[]; year: string; why: string; searchQuery: string }

// ── component ──────────────────────────────────────────────────────────────────
export function Onboarding() {
  const [topic, setTopic] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [step, setStep] = useState<Step>('input')
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [loadingRecommend, setLoadingRecommend] = useState(false)
  const [questions, setQuestions] = useState<AIQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [openQuestion, setOpenQuestion] = useState<string | null>(null)
  const [rrlPapers, setRrlPapers] = useState<RRLPaper[]>([])
  const [rrwPapers, setRrwPapers] = useState<RRWPaper[]>([])
  const [selectedRrl, setSelectedRrl] = useState<Set<string>>(new Set())
  const [selectedRrw, setSelectedRrw] = useState<Set<string>>(new Set())
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { createProject, updateSection, deleteProject, projects, selectProject, setShowOnboarding, updateProject } = useBuddyStore()

  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const editInputRef = useRef<HTMLInputElement>(null)
  const { confirm } = useConfirm()

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIndex(i => (i + 1) % PLACEHOLDER_EXAMPLES.length), 3000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  const filteredProjects = [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .filter(p => p.title.toLowerCase().includes(search.toLowerCase()))

  // ── Step 1 → 2: get questions ───────────────────────────────────────────────
  const handleGetQuestions = async () => {
    if (!topic.trim()) return
    setLoadingQuestions(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'questions', topic: topic.trim() }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setQuestions(data.questions)
      setOpenQuestion(data.questions[0]?.id ?? null)
      setStep('questions')
    } catch (e: any) {
      setError(e.message || 'Failed to generate questions.')
    } finally {
      setLoadingQuestions(false)
    }
  }

  // ── Step 2 → 3: get recommendations ────────────────────────────────────────
  const handleGetRecommendations = async () => {
    setLoadingRecommend(true)
    setError(null)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'recommend', topic: topic.trim(), answers }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setRrlPapers(data.rrl ?? [])
      setRrwPapers(data.rrw ?? [])
      setSelectedRrl(new Set((data.rrl ?? []).map((p: RRLPaper) => p.id)))
      setSelectedRrw(new Set((data.rrw ?? []).map((p: RRWPaper) => p.id)))
      setStep('recommend')
    } catch (e: any) {
      setError(e.message || 'Failed to fetch recommendations.')
    } finally {
      setLoadingRecommend(false)
    }
  }

  // ── Step 3 → create project ─────────────────────────────────────────────────
  const handleCreateProject = async () => {
    setIsCreating(true)
    try {
      const chosenRrl = rrlPapers.filter(p => selectedRrl.has(p.id)).map(openAlexResultToReference)
      const chosenRrw: Reference[] = rrwPapers
        .filter(p => selectedRrw.has(p.id))
        .map(p => ({
          id: p.id,
          title: p.title,
          authors: p.authors,
          year: p.year,
          type: 'article' as const,
          citation: buildCitation({ title: p.title, authors: p.authors, year: p.year, journal: null, doi: null }),
          notes: p.why,
        }))
      const allRefs = [...chosenRrl, ...chosenRrw]
      const project = createProject(topic.trim(), topic.trim())
      if (allRefs.length > 0) {
        const litSection = project.outline.body.find(s => s.title === 'Literature Review')
        if (litSection) updateSection(litSection.id, { references: allRefs })
      }
    } finally {
      setIsCreating(false)
    }
  }

  // ── existing project list helpers ───────────────────────────────────────────
  const handleSelectExisting = (id: string) => {
    if (selectMode) {
      setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
      return
    }
    selectProject(id)
    setShowOnboarding(false)
  }
  const handleDeleteSelected = async () => {
    if (selected.size === 0) return
    const ok = await confirm({
      title: `Delete ${selected.size} paper${selected.size > 1 ? 's' : ''}?`,
      description: 'The selected papers and all of their sections will be permanently removed.',
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (!ok) return
    selected.forEach(id => deleteProject(id))
    setSelected(new Set()); setSelectMode(false)
  }
  const commitEdit = () => {
    if (editingId && editingTitle.trim()) updateProject(editingId, { title: editingTitle.trim() })
    setEditingId(null); setEditingTitle('')
  }
  const cancelEdit = (e?: React.MouseEvent) => { e?.stopPropagation(); setEditingId(null); setEditingTitle('') }

  const handleDeleteOne = async (id: string, title: string) => {
    const ok = await confirm({
      title: 'Delete this paper?',
      description: <>&ldquo;{title}&rdquo; and all of its sections will be permanently removed.</>,
      confirmLabel: 'Delete',
      destructive: true,
    })
    if (ok) deleteProject(id)
  }

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const STEPS: { key: Step; label: string }[] = [
    { key: 'input', label: 'Topic' },
    { key: 'questions', label: 'Scope' },
    { key: 'recommend', label: 'Readings' },
  ]
  const stepIndex = STEPS.findIndex(s => s.key === step)

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden bg-background">

      {/* Left sidebar — existing papers */}
      {projects.length > 0 && (
        <aside className="w-72 shrink-0 flex flex-col h-full overflow-hidden bg-card border-r border-border">
          <div className="flex items-center justify-between px-5 pt-6 pb-3 shrink-0">
            <h2 className="eyebrow">Your papers</h2>
            {!selectMode
              ? <button onClick={() => setSelectMode(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Select</button>
              : <button onClick={() => { setSelectMode(false); setSelected(new Set()) }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Done</button>
            }
          </div>

          {selectMode && (
            <div className="flex items-center justify-between px-5 pb-3 gap-2 shrink-0">
              <button onClick={() => setSelected(selected.size === filteredProjects.length ? new Set() : new Set(filteredProjects.map(p => p.id)))}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {selected.size === filteredProjects.length ? 'Deselect all' : 'Select all'}
              </button>
              <button onClick={handleDeleteSelected} disabled={selected.size === 0}
                className="flex items-center gap-1.5 text-xs text-destructive disabled:text-subtle-foreground disabled:cursor-not-allowed transition-colors">
                <Trash2 className="h-3 w-3" /> Delete{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            </div>
          )}

          <div className="px-5 pb-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-subtle-foreground" />
              <input type="text" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)}
                aria-label="Search papers"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md outline-none border border-input bg-card focus:border-ring transition-colors" />
            </div>
          </div>

          <ul className="overflow-y-auto flex-1 min-h-0 px-2 pb-4">
            {filteredProjects.map(project => {
              const isSel = selectMode && selected.has(project.id)
              return (
                <li key={project.id} className={cn('group flex items-start gap-2 px-3 py-2.5 rounded-md transition-colors duration-150', isSel ? 'bg-primary-soft' : 'hover:bg-accent/60')}>
                  {selectMode && (
                    <button onClick={() => handleSelectExisting(project.id)} aria-label={isSel ? 'Deselect' : 'Select'}
                      className={cn('mt-0.5 h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center transition-colors',
                        isSel ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-card')}>
                      {isSel && <Check className="h-3 w-3" />}
                    </button>
                  )}
                  {editingId === project.id ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                      <input ref={editInputRef} value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                        onBlur={commitEdit}
                        className="flex-1 min-w-0 text-sm rounded-sm px-1.5 py-0.5 outline-none border border-ring bg-card" />
                      <button onMouseDown={e => { e.preventDefault(); commitEdit() }} className="h-5 w-5 flex items-center justify-center text-primary shrink-0" aria-label="Save"><Check className="h-3 w-3" /></button>
                      <button onMouseDown={e => { e.preventDefault(); cancelEdit(e) }} className="h-5 w-5 flex items-center justify-center text-muted-foreground shrink-0" aria-label="Cancel"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <>
                      <button className="flex-1 min-w-0 text-left" onClick={() => handleSelectExisting(project.id)}>
                        <span className="block text-sm text-foreground line-clamp-2 leading-snug">{project.title}</span>
                        <span className="block text-xs text-subtle-foreground mt-0.5">
                          Edited {new Date(project.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </button>
                      {!selectMode && (
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                          <button onClick={e => { e.stopPropagation(); setEditingId(project.id); setEditingTitle(project.title) }}
                            className="h-6 w-6 flex items-center justify-center rounded text-subtle-foreground hover:text-foreground" title="Rename">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDeleteOne(project.id, project.title) }}
                            className="h-6 w-6 flex items-center justify-center rounded text-subtle-foreground hover:text-destructive" title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </aside>
      )}

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <div className={cn('mx-auto px-10 py-16', step === 'recommend' ? 'max-w-5xl' : 'max-w-2xl')}>

          {/* Step indicator */}
          <ol className="flex items-center gap-3 mb-12 text-sm" aria-label="Progress">
            {STEPS.map((s, i) => {
              const done = i < stepIndex
              const active = i === stepIndex
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <span className={cn('flex items-center gap-2', active ? 'text-foreground' : done ? 'text-muted-foreground' : 'text-subtle-foreground')}>
                    <span className={cn('h-6 w-6 rounded-full border flex items-center justify-center text-xs tabular-nums',
                      active ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-primary text-primary' : 'border-input')}>
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className={active ? 'font-medium' : ''}>{s.label}</span>
                  </span>
                  {i < STEPS.length - 1 && <span className="w-10 h-px bg-border" />}
                </li>
              )
            })}
          </ol>

          {error && (
            <div role="alert" className="mb-6 px-4 py-3 rounded-md text-sm border border-destructive/30 bg-destructive/5 text-destructive">{error}</div>
          )}

          {/* ── STEP 1: topic input ── */}
          {step === 'input' && (
            <>
              <h1 className="font-serif text-[2rem] leading-tight font-semibold mb-3">Start a new paper</h1>
              <p className="text-muted-foreground leading-relaxed mb-8 max-w-xl">
                Describe your research topic in a sentence or two. Buddy will ask a few questions to narrow the scope, then suggest starting literature.
              </p>

              <label htmlFor="topic" className="eyebrow block mb-2">Research topic</label>
              <Textarea
                id="topic"
                placeholder={PLACEHOLDER_EXAMPLES[placeholderIndex]}
                value={topic}
                onChange={e => setTopic(e.target.value)}
                rows={4}
                disabled={loadingQuestions}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGetQuestions() }}
                className="font-serif text-lg md:text-lg leading-relaxed px-4 py-3 resize-none placeholder:text-subtle-foreground"
              />
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs text-subtle-foreground">Ctrl + Enter to continue</span>
                <Button onClick={handleGetQuestions} disabled={!topic.trim() || loadingQuestions} size="lg">
                  {loadingQuestions ? <><Loader2 className="animate-spin" /> Preparing questions…</> : <>Continue <ArrowRight /></>}
                </Button>
              </div>
            </>
          )}

          {/* ── STEP 2: clarifying questions ── */}
          {step === 'questions' && (
            <>
              <h1 className="font-serif text-[2rem] leading-tight font-semibold mb-3">Refine the scope</h1>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Answer whichever questions you can. Your answers guide the literature search.
              </p>

              <div className="border-y border-border divide-y divide-border mb-8">
                {questions.map((q, i) => {
                  const isOpen = openQuestion === q.id
                  const answered = !!answers[q.id]?.trim()
                  return (
                    <div key={q.id}>
                      <button
                        className="w-full flex items-start gap-4 py-4 text-left"
                        onClick={() => setOpenQuestion(isOpen ? null : q.id)}
                        aria-expanded={isOpen}
                      >
                        <span className={cn('w-6 text-sm tabular-nums pt-px', answered ? 'text-primary' : 'text-subtle-foreground')}>
                          {answered ? <Check className="h-4 w-4 mt-0.5" /> : String(i + 1).padStart(2, '0')}
                        </span>
                        <span className="flex-1 text-[0.95rem] leading-snug text-foreground">{q.question}</span>
                        <ChevronDown className={cn('h-4 w-4 shrink-0 mt-0.5 text-subtle-foreground transition-transform duration-150', isOpen && 'rotate-180')} />
                      </button>
                      {isOpen && (
                        <div className="pl-10 pb-5">
                          <Textarea
                            rows={3}
                            placeholder={q.placeholder}
                            value={answers[q.id] ?? ''}
                            onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            className="resize-none"
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep('input')}><ArrowLeft /> Back</Button>
                <Button onClick={handleGetRecommendations} disabled={loadingRecommend} size="lg">
                  {loadingRecommend
                    ? <><Loader2 className="animate-spin" /> Searching the literature…</>
                    : <>Find readings <ArrowRight /></>}
                </Button>
              </div>
            </>
          )}

          {/* ── STEP 3: recommendations ── */}
          {step === 'recommend' && (
            <>
              <h1 className="font-serif text-[2rem] leading-tight font-semibold mb-3">Starting readings</h1>
              <p className="text-muted-foreground leading-relaxed mb-10">
                Select the papers to add to your project. You can add more at any time from the writing view.
              </p>

              <div className="grid md:grid-cols-2 gap-10 mb-10">
                {/* RRL column */}
                <section>
                  <div className="flex items-end justify-between gap-4 pb-3 border-b border-border">
                    <div>
                      <h2 className="font-serif text-lg font-semibold">Related literature</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Published studies from OpenAlex</p>
                    </div>
                    {rrlPapers.length > 0 && (
                      <button className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0"
                        onClick={() => setSelectedRrl(selectedRrl.size === rrlPapers.length ? new Set() : new Set(rrlPapers.map(p => p.id)))}>
                        {selectedRrl.size === rrlPapers.length ? 'Deselect all' : 'Select all'}
                      </button>
                    )}
                  </div>
                  <ul className="divide-y divide-border">
                    {rrlPapers.map(paper => {
                      const on = selectedRrl.has(paper.id)
                      return (
                        <li key={paper.id}
                          role="checkbox" aria-checked={on} tabIndex={0}
                          className="flex items-start gap-3 py-4 cursor-pointer group"
                          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleIn(setSelectedRrl, paper.id) } }}
                          onClick={() => toggleIn(setSelectedRrl, paper.id)}>
                          <span className={cn('mt-0.5 w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors duration-150',
                            on ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-card group-hover:border-subtle-foreground')}>
                            {on && <Check className="h-3 w-3" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug text-foreground">{paper.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {paper.authors.slice(0, 2).join(', ')}{paper.authors.length > 2 ? ' et al.' : ''} · {paper.year}
                              {paper.journal && <> · <i>{paper.journal}</i></>}
                            </p>
                            {paper.abstract && <p className="text-xs text-subtle-foreground mt-1.5 line-clamp-2 leading-relaxed">{paper.abstract}</p>}
                          </div>
                          {paper.doi && (
                            <a href={paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()} className="shrink-0 mt-0.5 text-subtle-foreground hover:text-primary transition-colors" title="Open DOI">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </section>

                {/* RRW column */}
                <section>
                  <div className="flex items-end justify-between gap-4 pb-3 border-b border-border">
                    <div>
                      <h2 className="font-serif text-lg font-semibold">Recommended reading</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">Foundational works suggested for your scope</p>
                    </div>
                    {rrwPapers.length > 0 && (
                      <button className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0"
                        onClick={() => setSelectedRrw(selectedRrw.size === rrwPapers.length ? new Set() : new Set(rrwPapers.map(p => p.id)))}>
                        {selectedRrw.size === rrwPapers.length ? 'Deselect all' : 'Select all'}
                      </button>
                    )}
                  </div>
                  {rrwPapers.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4">No additional recommendations for this scope.</p>
                  )}
                  <ul className="divide-y divide-border">
                    {rrwPapers.map(paper => {
                      const on = selectedRrw.has(paper.id)
                      return (
                        <li key={paper.id}
                          role="checkbox" aria-checked={on} tabIndex={0}
                          className="flex items-start gap-3 py-4 cursor-pointer group"
                          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleIn(setSelectedRrw, paper.id) } }}
                          onClick={() => toggleIn(setSelectedRrw, paper.id)}>
                          <span className={cn('mt-0.5 w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors duration-150',
                            on ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-card group-hover:border-subtle-foreground')}>
                            {on && <Check className="h-3 w-3" />}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug text-foreground">{paper.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{paper.authors.join(', ')} · {paper.year}</p>
                            <p className="text-xs text-subtle-foreground mt-1.5 leading-relaxed"><span className="text-muted-foreground">Why read this:</span> {paper.why}</p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-6">
                <Button variant="ghost" onClick={() => setStep('questions')}><ArrowLeft /> Back</Button>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground tabular-nums">{selectedRrl.size + selectedRrw.size} selected</span>
                  <Button onClick={handleCreateProject} disabled={isCreating} size="lg">
                    {isCreating
                      ? <><Loader2 className="animate-spin" /> Creating project…</>
                      : <>Create project <ArrowRight /></>}
                  </Button>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
