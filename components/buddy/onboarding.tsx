'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, ArrowLeft, FolderOpen, Pencil, Trash2, Check, X, Search,
         BookOpen, Loader2, ChevronDown, ChevronUp, CheckCircle2, ExternalLink } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useBuddyStore } from '@/lib/store'
import type { Reference } from '@/lib/types'
import { cn } from '@/lib/utils'

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

const DRAFT_KEY = 'buddy-onboarding-draft'

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

  useEffect(() => {
    const t = setInterval(() => setPlaceholderIndex(i => (i + 1) % PLACEHOLDER_EXAMPLES.length), 3000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  // Restore an in-progress wizard (topic/answers/recommendations) after a refresh.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft.topic) setTopic(draft.topic)
      if (draft.step) setStep(draft.step)
      if (draft.questions) setQuestions(draft.questions)
      if (draft.answers) setAnswers(draft.answers)
      if (draft.openQuestion !== undefined) setOpenQuestion(draft.openQuestion)
      if (draft.rrlPapers) setRrlPapers(draft.rrlPapers)
      if (draft.rrwPapers) setRrwPapers(draft.rrwPapers)
      if (draft.selectedRrl) setSelectedRrl(new Set(draft.selectedRrl))
      if (draft.selectedRrw) setSelectedRrw(new Set(draft.selectedRrw))
    } catch {}
  }, [])

  // Keep the draft in sync as the wizard progresses.
  useEffect(() => {
    if (step === 'input' && !topic.trim()) {
      sessionStorage.removeItem(DRAFT_KEY)
      return
    }
    const draft = {
      topic, step, questions, answers, openQuestion, rrlPapers, rrwPapers,
      selectedRrl: Array.from(selectedRrl), selectedRrw: Array.from(selectedRrw),
    }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [topic, step, questions, answers, openQuestion, rrlPapers, rrwPapers, selectedRrl, selectedRrw])

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
      sessionStorage.removeItem(DRAFT_KEY)
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
    sessionStorage.removeItem(DRAFT_KEY)
    selectProject(id)
    setShowOnboarding(false)
  }
  const handleDeleteSelected = () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} project${selected.size > 1 ? 's' : ''}?`)) return
    selected.forEach(id => deleteProject(id))
    setSelected(new Set()); setSelectMode(false)
  }
  const commitEdit = () => {
    if (editingId && editingTitle.trim()) updateProject(editingId, { title: editingTitle.trim() })
    setEditingId(null); setEditingTitle('')
  }
  const cancelEdit = (e?: React.MouseEvent) => { e?.stopPropagation(); setEditingId(null); setEditingTitle('') }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden">

      {/* Left sidebar — existing projects */}
      {projects.length > 0 && (
        <aside className="w-80 shrink-0 flex flex-col p-4 gap-2 h-full overflow-hidden" style={{ backgroundColor: '#fef5dd', borderRight: '1px solid #e8ddd5' }}>
          <div className="flex items-center justify-between px-2 py-3 mb-1 shrink-0">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" style={{ color: '#fb804a' }} />
              <span className="text-sm font-bold" style={{ color: '#fb804a' }}>Your Projects</span>
            </div>
            {!selectMode
              ? <button onClick={() => setSelectMode(true)} className="text-xs font-medium px-2.5 py-1 rounded-md border transition-colors" style={{ borderColor: '#a0ad6d', backgroundColor: '#a0ad6d', color: '#ffffff' }}>Select</button>
              : <button onClick={() => { setSelectMode(false); setSelected(new Set()) }} className="text-xs font-medium px-2.5 py-1 rounded-md border transition-colors" style={{ borderColor: '#e8ddd5', backgroundColor: '#ffffff', color: '#8a6a5e' }}>Cancel</button>
            }
          </div>

          {selectMode && (
            <div className="flex items-center justify-between px-2 pb-1 gap-2 shrink-0">
              <button onClick={() => setSelected(selected.size === filteredProjects.length ? new Set() : new Set(filteredProjects.map(p => p.id)))}
                className="text-xs font-medium px-2.5 py-1 rounded-md border transition-colors" style={{ borderColor: '#e8ddd5', backgroundColor: '#ffffff', color: '#8a6a5e' }}>
                {selected.size === filteredProjects.length ? 'Deselect all' : 'Select all'}
              </button>
              <button onClick={handleDeleteSelected} disabled={selected.size === 0}
                className={cn('flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors',
                  selected.size > 0 ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100' : 'cursor-not-allowed opacity-40')}
                style={selected.size === 0 ? { borderColor: '#e8ddd5', backgroundColor: '#ffffff', color: '#8a6a5e' } : {}}>
                <Trash2 className="h-3 w-3" /> Delete{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            </div>
          )}

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: '#8a6a5e' }} />
            <input type="text" placeholder="Search your projects..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg outline-none transition-colors"
              style={{ border: '1px solid #e8ddd5', backgroundColor: '#ffffff', color: '#381d18' }} />
          </div>

          <div className="overflow-y-auto flex-1 min-h-0 flex flex-col gap-2 pr-0.5">
            {filteredProjects.map(project => (
              <div key={project.id} className={cn('w-full text-left px-3 py-3 rounded-xl transition-all group flex items-start gap-2')}
                style={{ border: selectMode && selected.has(project.id) ? '1px solid #a0ad6d' : '1px solid transparent', backgroundColor: selectMode && selected.has(project.id) ? '#f0f3e0' : 'transparent' }}>
                {selectMode && (
                  <button onClick={() => handleSelectExisting(project.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded flex items-center justify-center transition-colors"
                    style={{ border: selected.has(project.id) ? '1px solid #381d18' : '1px solid #d1c4be', backgroundColor: selected.has(project.id) ? '#381d18' : '#ffffff' }}>
                    {selected.has(project.id) && <Check className="h-2.5 w-2.5 text-white" />}
                  </button>
                )}
                {editingId === project.id ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                    <input ref={editInputRef} value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                      onBlur={commitEdit}
                      className="flex-1 min-w-0 text-sm font-medium rounded px-2 py-0.5 outline-none"
                      style={{ backgroundColor: '#fef5dd', border: '1px solid #a0ad6d', color: '#381d18' }} />
                    <button onMouseDown={e => { e.preventDefault(); commitEdit() }} className="h-5 w-5 flex items-center justify-center rounded shrink-0" style={{ color: '#381d18' }}><Check className="h-3 w-3" /></button>
                    <button onMouseDown={e => { e.preventDefault(); cancelEdit(e) }} className="h-5 w-5 flex items-center justify-center rounded shrink-0" style={{ color: '#8a6a5e' }}><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <>
                    <button className="flex-1 min-w-0 text-left" onClick={() => handleSelectExisting(project.id)}>
                      <div className="font-bold text-sm line-clamp-2 transition-colors" style={{ color: '#fb804a' }}>{project.title}</div>
                    </button>
                    {!selectMode && (
                      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                        <button onClick={e => { e.stopPropagation(); setEditingId(project.id); setEditingTitle(project.title) }}
                          className="h-6 w-6 flex items-center justify-center rounded" style={{ color: '#8a6a5e' }} title="Rename">
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button onClick={e => { e.stopPropagation(); if (confirm('Delete this project?')) deleteProject(project.id) }}
                          className="h-6 w-6 flex items-center justify-center rounded" style={{ color: '#8a6a5e' }} title="Delete">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
        <div className={step === 'recommend' ? 'w-full max-w-5xl' : 'w-full max-w-xl'}>

          {/* ── STEP 1: topic input ── */}
          {step === 'input' && (
            <>
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <Image src="/BUDDY_LOGO_CIRCLE.png" alt="Buddy" width={96} height={96} className="object-contain" />
                </div>
                <h1 className="font-serif text-3xl font-bold mb-1" style={{ color: '#381d18' }}>Hey, Buddy!</h1>
                <p className="text-sm" style={{ color: '#8a6a5e' }}>Tell me what you'd like to research and I'll guide you through it.</p>
              </div>

              {error && <div className="mb-4 p-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}

              <div className="space-y-4">
                <div className="border rounded-2xl px-5 py-4 transition-all shadow-sm" style={{ backgroundColor: '#fef5dd', borderColor: '#fb804a' }}>
                  <Textarea
                    placeholder={PLACEHOLDER_EXAMPLES[placeholderIndex]}
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    rows={5}
                    disabled={loadingQuestions}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGetQuestions() }}
                    className="bg-transparent border-0 focus-visible:ring-0 px-1 py-0 text-lg placeholder:text-muted-foreground/50 resize-none font-medium leading-relaxed disabled:opacity-60"
                    style={{ color: '#381d18' }}
                  />
                </div>
                <Button onClick={handleGetQuestions} disabled={!topic.trim() || loadingQuestions} className="w-full gap-2 text-white font-semibold py-6 rounded-xl" style={{ backgroundColor: '#381d18' }}>
                  {loadingQuestions ? <><Loader2 className="h-4 w-4 animate-spin" /> Thinking about your research…</> : <>Let's get started <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </div>
            </>
          )}

          {/* ── STEP 2: clarifying questions ── */}
          {step === 'questions' && (
            <>
              <button onClick={() => setStep('input')} className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity" style={{ color: '#8a6a5e' }}>
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <div className="mb-6">
                <h2 className="font-serif text-2xl font-bold mb-1" style={{ color: '#381d18' }}>Let's refine your study</h2>
                <p className="text-sm" style={{ color: '#8a6a5e' }}>Answer as many as you can — Buddy will use these to find the best literature for you.</p>
              </div>

              {error && <div className="mb-4 p-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}

              <div className="space-y-3 mb-6">
                {questions.map((q, i) => {
                  const isOpen = openQuestion === q.id
                  const answered = !!answers[q.id]?.trim()
                  return (
                    <div key={q.id} className="rounded-2xl border overflow-hidden transition-all" style={{ borderColor: isOpen ? '#a0ad6d' : '#e8ddd5', backgroundColor: '#ffffff' }}>
                      <button
                        className="w-full flex items-center justify-between px-5 py-4 text-left"
                        onClick={() => setOpenQuestion(isOpen ? null : q.id)}
                      >
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white" style={{ backgroundColor: answered ? '#a0ad6d' : '#381d18' }}>
                            {answered ? <Check className="h-3.5 w-3.5" /> : i + 1}
                          </span>
                          <span className="text-sm font-medium leading-snug" style={{ color: '#381d18' }}>{q.question}</span>
                        </div>
                        {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" style={{ color: '#a0ad6d' }} /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4">
                          <textarea
                            rows={3}
                            placeholder={q.placeholder}
                            value={answers[q.id] ?? ''}
                            onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                            className="w-full text-sm px-4 py-3 rounded-xl border outline-none resize-none transition-colors"
                            style={{ backgroundColor: '#fef5dd', borderColor: '#e8ddd5', color: '#381d18' }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <Button onClick={handleGetRecommendations} disabled={loadingRecommend} className="w-full gap-2 text-white font-semibold py-6 rounded-xl" style={{ backgroundColor: '#381d18' }}>
                {loadingRecommend
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Finding your starting literature…</>
                  : <><BookOpen className="h-4 w-4" /> Show me recommended readings <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </>
          )}

          {/* ── STEP 3: recommendations ── */}
          {step === 'recommend' && (
            <>
              <button onClick={() => setStep('questions')} className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70 transition-opacity" style={{ color: '#8a6a5e' }}>
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <div className="mb-6">
                <h2 className="font-serif text-2xl font-bold mb-1" style={{ color: '#381d18' }}>Your starting readings</h2>
                <p className="text-sm" style={{ color: '#8a6a5e' }}>Select the papers you want pre-loaded in your project. You can always add more later.</p>
              </div>

              {error && <div className="mb-4 p-3 rounded-xl text-sm text-red-700 bg-red-50 border border-red-200">{error}</div>}

              {/* 2-column grid */}
              <div className="grid grid-cols-2 gap-5 mb-6">

                {/* RRL column */}
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#a0ad6d' }}>RRL</h3>
                    <button className="text-xs underline" style={{ color: '#8a6a5e' }}
                      onClick={() => setSelectedRrl(selectedRrl.size === rrlPapers.length ? new Set() : new Set(rrlPapers.map(p => p.id)))}>
                      {selectedRrl.size === rrlPapers.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {rrlPapers.map(paper => {
                      const on = selectedRrl.has(paper.id)
                      return (
                        <div key={paper.id}
                          className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all"
                          style={{ borderColor: on ? '#a0ad6d' : '#e8ddd5', backgroundColor: on ? '#f0f3e0' : '#ffffff' }}
                          onClick={() => setSelectedRrl(prev => { const n = new Set(prev); on ? n.delete(paper.id) : n.add(paper.id); return n })}>
                          <div className="mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
                            style={{ borderColor: on ? '#a0ad6d' : '#d1d5db', backgroundColor: on ? '#a0ad6d' : 'transparent' }}>
                            {on && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-snug mb-0.5" style={{ color: '#381d18' }}>{paper.title}</p>
                            <p className="text-xs" style={{ color: '#8a6a5e' }}>{paper.authors.slice(0, 2).join(', ')}{paper.authors.length > 2 ? ' et al.' : ''} · {paper.year}{paper.journal ? ` · ${paper.journal}` : ''}</p>
                            {paper.abstract && <p className="text-xs mt-1.5 line-clamp-2" style={{ color: '#6b5a52' }}>{paper.abstract}</p>}
                          </div>
                          {paper.doi && (
                            <a href={paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer"
                              onClick={e => e.stopPropagation()} className="shrink-0 mt-0.5 hover:opacity-70 transition-opacity">
                              <ExternalLink className="h-3.5 w-3.5" style={{ color: '#a0ad6d' }} />
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* RRW column */}
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#fb804a' }}>RRW</h3>
                    <button className="text-xs underline" style={{ color: '#8a6a5e' }}
                      onClick={() => setSelectedRrw(selectedRrw.size === rrwPapers.length ? new Set() : new Set(rrwPapers.map(p => p.id)))}>
                      {selectedRrw.size === rrwPapers.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {rrwPapers.map(paper => {
                      const on = selectedRrw.has(paper.id)
                      return (
                        <div key={paper.id}
                          className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all"
                          style={{ borderColor: on ? '#fb804a' : '#e8ddd5', backgroundColor: on ? '#fef5dd' : '#ffffff' }}
                          onClick={() => setSelectedRrw(prev => { const n = new Set(prev); on ? n.delete(paper.id) : n.add(paper.id); return n })}>
                          <div className="mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors"
                            style={{ borderColor: on ? '#fb804a' : '#d1d5db', backgroundColor: on ? '#fb804a' : 'transparent' }}>
                            {on && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-snug mb-0.5" style={{ color: '#381d18' }}>{paper.title}</p>
                            <p className="text-xs mb-1.5" style={{ color: '#8a6a5e' }}>{paper.authors.join(', ')} · {paper.year}</p>
                            <p className="text-xs italic" style={{ color: '#6b5a52' }}>Why read this: {paper.why}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>

              <Button onClick={handleCreateProject} disabled={isCreating} className="w-full gap-2 text-white font-semibold py-6 rounded-xl" style={{ backgroundColor: '#a0ad6d' }}>
                {isCreating
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Setting up your project…</>
                  : <><CheckCircle2 className="h-4 w-4" /> Start Research ({selectedRrl.size + selectedRrw.size} papers selected) <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
