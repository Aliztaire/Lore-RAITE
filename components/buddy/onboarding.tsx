'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowRight, ArrowLeft, Pencil, Trash2, Check, X, Search,
         Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useBuddyStore } from '@/lib/store'
import type { Reference } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useConfirm } from './confirm-dialog'
import { Appear } from './appear'
import { AnimatePresence, motion } from 'motion/react'

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

// ── presentational pieces (module level so they keep focus across renders) ──

function StepDots({ steps, current, label }: { steps: readonly string[]; current: number; label: string }) {
  return (
    <div className="flex items-center justify-center gap-2" role="img" aria-label={`Step ${current + 1} of ${steps.length}: ${label}`}>
      {steps.map((s, i) => (
        <span
          key={s}
          className={cn('h-1.5 rounded-full transition-all duration-200', i === current ? 'w-8 bg-foreground' : 'w-1.5 bg-input')}
        />
      ))}
    </div>
  )
}

export interface Relation { text: string; source: 'ai' | 'keywords'; terms: string[] }
type RelationState = { status: 'loading' } | { status: 'error' } | ({ status: 'ready' } & Relation)

/** Hover / focus card explaining how a paper relates to the student's study. */
function RelationCard({ id, relation, above }: { id: string; relation: RelationState; above: boolean }) {
  return (
    <motion.div
      id={id}
      role="tooltip"
      initial={{ opacity: 0, y: above ? -4 : 4, filter: 'blur(2px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className={cn(
        'absolute left-8 right-0 z-20 max-w-md rounded-2xl border border-border bg-popover p-4 shadow-popover cursor-default',
        above ? 'bottom-full -mb-2' : 'top-full -mt-2',
      )}
      onClick={e => e.stopPropagation()}
    >
      <p className="eyebrow">How this relates to your study</p>
      {relation.status === 'loading' && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Working out the connection…
        </p>
      )}
      {relation.status === 'error' && (
        <p className="mt-2 text-sm text-muted-foreground">Couldn&rsquo;t explain this one right now.</p>
      )}
      {relation.status === 'ready' && (
        <>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{relation.text}</p>
          {relation.terms.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1" aria-label="Shared terms">
              {relation.terms.map(t => (
                <li key={t} className="rounded-full border border-border px-2 py-px text-xs text-muted-foreground">{t}</li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-subtle-foreground">
            {relation.source === 'ai' ? 'AI summary from the title and abstract' : 'Based on shared keywords'}
          </p>
        </>
      )}
    </motion.div>
  )
}

function ReadingRow({ on, onToggle, title, meta, detail, href, relation, rowId }: {
  on: boolean; onToggle: () => void; title: string; meta: React.ReactNode; detail?: React.ReactNode; href?: string
  relation?: RelationState; rowId?: string
}) {
  // Short delay so sweeping the pointer down the list doesn't flash every card
  const [showRelation, setShowRelation] = useState(false)
  const [above, setAbove] = useState(false)
  const rowRef = useRef<HTMLLIElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const open = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      // Open upward when there isn't room for the card below this row
      const r = rowRef.current?.getBoundingClientRect()
      setAbove(!!r && window.innerHeight - r.bottom < 240)
      setShowRelation(true)
    }, 150)
  }
  const close = () => { if (timer.current) clearTimeout(timer.current); setShowRelation(false) }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const cardId = rowId ? `relation-${rowId}` : undefined

  return (
    <li
      ref={rowRef}
      role="checkbox" aria-checked={on} tabIndex={0}
      aria-describedby={relation && showRelation ? cardId : undefined}
      className="relative flex items-start gap-4 py-4 cursor-pointer group"
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onToggle() } if (e.key === 'Escape') close() }}
      onClick={onToggle}
      onMouseEnter={relation ? open : undefined}
      onMouseLeave={relation ? close : undefined}
      onFocus={relation ? open : undefined}
      onBlur={relation ? close : undefined}
    >
      <AnimatePresence>
        {relation && showRelation && cardId && <RelationCard key="relation" id={cardId} relation={relation} above={above} />}
      </AnimatePresence>
      <span className={cn('mt-1 w-4 h-4 rounded-sm border flex items-center justify-center shrink-0 transition-colors duration-150',
        on ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-card')}>
        {on && <Check className="h-3 w-3" />}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug text-foreground group-hover:text-highlight-strong transition-colors duration-150">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{meta}</p>
        {detail && <p className="text-xs text-subtle-foreground mt-2 line-clamp-2 leading-relaxed">{detail}</p>}
      </div>
      {href && (
        <a href={href} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
          className="shrink-0 mt-1 text-subtle-foreground hover:text-highlight-strong transition-colors" title="Open DOI">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </li>
  )
}

/** True for the "independent and dependent variables" question, however the AI words it. */
function isVariablesQuestion(question: string) {
  return /\bindependent\b/i.test(question) && /\bdependent\b/i.test(question.replace(/\bindependent\b/gi, ''))
}

/** Split an example like "e.g. screen time → sleep quality" into one example per box. */
function variableHints(placeholder?: string) {
  const body = (placeholder ?? '').replace(/^e\.g\.?,?\s*/i, '')
  const [iv, dv] = body.split(/\s*(?:→|->|=>|\bon\b|\bvs\.?)\s*/i)
  return iv && dv
    ? { iv: `e.g. ${iv.trim()}`, dv: `e.g. ${dv.trim()}` }
    : { iv: 'e.g. hours of daily screen time', dv: 'e.g. sleep quality score' }
}

// ── component ──────────────────────────────────────────────────────────────────
export function Onboarding() {
  const [topic, setTopic] = useState('')
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [step, setStep] = useState<Step>('input')
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [loadingRecommend, setLoadingRecommend] = useState(false)
  const [questions, setQuestions] = useState<AIQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [questionIndex, setQuestionIndex] = useState(0)
  const [papersOpen, setPapersOpen] = useState(false)
  // Separate boxes for the variables question; combined into answers[q.id] for the API
  const [variableParts, setVariableParts] = useState<Record<string, { iv: string; dv: string }>>({})
  // How each related-literature paper connects to the study, fetched once the readings arrive
  const [relations, setRelations] = useState<Record<string, Relation>>({})
  const [relationsStatus, setRelationsStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
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
      if (typeof draft.questionIndex === 'number') setQuestionIndex(draft.questionIndex)
      if (draft.variableParts) setVariableParts(draft.variableParts)
      if (draft.rrlPapers) setRrlPapers(draft.rrlPapers)
      if (draft.rrwPapers) setRrwPapers(draft.rrwPapers)
      if (draft.selectedRrl) setSelectedRrl(new Set(draft.selectedRrl))
      if (draft.selectedRrw) setSelectedRrw(new Set(draft.selectedRrw))
    } catch {}
  }, [])

  // Keep the draft in sync as the wizard progresses.
  useEffect(() => {
    try {
      if (step === 'input' && !topic.trim()) {
        sessionStorage.removeItem(DRAFT_KEY)
        return
      }
      const draft = {
        topic, step, questions, answers, questionIndex, variableParts, rrlPapers, rrwPapers,
        selectedRrl: Array.from(selectedRrl), selectedRrw: Array.from(selectedRrw),
      }
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {}
  }, [topic, step, questions, answers, questionIndex, variableParts, rrlPapers, rrwPapers, selectedRrl, selectedRrw])

  // When new related literature arrives, explain each paper's link to the study (in the background)
  useEffect(() => {
    if (rrlPapers.length === 0) return
    let cancelled = false
    setRelations({})
    setRelationsStatus('loading')
    fetch('/api/relevance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: topic.trim(),
        answers,
        papers: rrlPapers.map(p => ({ id: p.id, title: p.title, abstract: p.abstract })),
      }),
    })
      .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then(data => { if (!cancelled) { setRelations(data.relevance ?? {}); setRelationsStatus('done') } })
      .catch(() => { if (!cancelled) setRelationsStatus('error') })
    return () => { cancelled = true }
    // Only re-run for a new set of papers; topic/answers are read at that moment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rrlPapers])

  const relationFor = (id: string): RelationState => {
    const r = relations[id]
    if (r) return { status: 'ready', ...r }
    return relationsStatus === 'error' || relationsStatus === 'done' ? { status: 'error' } : { status: 'loading' }
  }

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
      setQuestionIndex(0)
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
      try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
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
    try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
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

  // ── scope: one question at a time ───────────────────────────────────────────
  const setVariablePart = (qid: string, key: 'iv' | 'dv', value: string) => {
    const parts = { ...(variableParts[qid] ?? { iv: '', dv: '' }), [key]: value }
    setVariableParts(prev => ({ ...prev, [qid]: parts }))
    const combined = [
      parts.iv.trim() && `Independent variable: ${parts.iv.trim()}`,
      parts.dv.trim() && `Dependent variable: ${parts.dv.trim()}`,
    ].filter(Boolean).join('; ')
    setAnswers(prev => ({ ...prev, [qid]: combined }))
  }
  const currentQuestion = questions[questionIndex]
  const isLastQuestion = questionIndex >= questions.length - 1
  const nextQuestion = () => {
    if (isLastQuestion) handleGetRecommendations()
    else setQuestionIndex(i => i + 1)
  }
  const previousQuestion = () => {
    if (questionIndex === 0) setStep('input')
    else setQuestionIndex(i => i - 1)
  }

  const STEPS: Step[] = ['input', 'questions', 'recommend']
  const stepIndex = STEPS.indexOf(step)
  const STEP_LABELS: Record<Step, string> = { input: 'Topic', questions: 'Scope', recommend: 'Readings' }

  // Which centred screen is showing. Each one fades in on its own, in place.
  const busy = loadingQuestions ? 'questions' : loadingRecommend ? 'recommend' : isCreating ? 'create' : null
  const screenKey = busy ? `busy-${busy}` : step === 'questions' ? `q-${questionIndex}` : step
  const totalSelected = selectedRrl.size + selectedRrw.size

  const busyCopy = {
    questions: { title: 'Reading your topic', body: 'Preparing a few questions to narrow the scope.' },
    recommend: { title: 'Searching the literature', body: 'Finding peer-reviewed studies that match your scope.' },
    create: { title: 'Setting up your paper', body: 'Creating the outline and adding your readings.' },
  } as const

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 relative overflow-y-auto bg-background">

      {/* Quiet back link for the readings screen (the scope screens carry their own) */}
      {step === 'recommend' && !busy && (
        <button
          onClick={() => setStep('questions')}
          className="absolute top-6 left-8 z-10 flex items-center gap-2 text-sm text-muted-foreground hover:text-highlight-strong transition-colors duration-150"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}

      <div className="min-h-full flex flex-col items-center justify-center px-8 py-20">
        <Appear
          id={screenKey}
          className={cn('w-full', busy ? 'max-w-xl' : step === 'recommend' ? 'max-w-2xl' : step === 'input' ? 'max-w-4xl' : 'max-w-xl')}
        >
          {error && (
            <div role="alert" className="mb-8 px-4 py-3 rounded-md text-sm text-center border border-destructive/30 bg-destructive/5 text-destructive">{error}</div>
          )}

          {/* ── Working… (centred status) ── */}
          {busy && (
            <div className="text-center" role="status" aria-live="polite">
              <Loader2 className="h-6 w-6 mx-auto mb-6 animate-spin text-subtle-foreground" />
              <h1 className="font-serif text-3xl font-semibold">{busyCopy[busy].title}</h1>
              <p className="mt-3 text-muted-foreground">{busyCopy[busy].body}</p>
            </div>
          )}

          {/* ── Topic ── */}
          {!busy && step === 'input' && (
            <div className="text-center">
              <h1 className="font-serif text-4xl font-semibold">What are you researching?</h1>
              <p className="mt-4 text-muted-foreground leading-relaxed max-w-md mx-auto">
                Describe your topic in a sentence or two. Buddy will ask a few questions, then suggest starting literature.
              </p>

              <label htmlFor="topic" className="sr-only">Research topic</label>
              <Textarea
                id="topic"
                autoFocus
                placeholder={PLACEHOLDER_EXAMPLES[placeholderIndex]}
                value={topic}
                onChange={e => setTopic(e.target.value)}
                rows={1}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGetQuestions() }}
                className="mt-10 min-h-16 font-serif text-lg md:text-lg leading-relaxed px-7 py-4 resize-none text-left placeholder:text-subtle-foreground"
              />
              <div className="mt-6 flex flex-col items-center gap-3">
                <Button onClick={handleGetQuestions} disabled={!topic.trim()} size="lg">
                  Continue <ArrowRight />
                </Button>
              </div>

              {projects.length > 0 && (
                <button
                  onClick={() => setPapersOpen(true)}
                  className="mt-12 text-sm text-muted-foreground underline underline-offset-4 decoration-border hover:text-highlight-strong hover:decoration-current transition-colors duration-150"
                >
                  Open an existing paper ({projects.length})
                </button>
              )}
            </div>
          )}

          {/* ── Scope: one question per screen ── */}
          {!busy && step === 'questions' && currentQuestion && (
            <div className="text-center">
              <p className="eyebrow">Question {questionIndex + 1} of {questions.length}</p>
              <h1 className="mt-4 font-serif text-3xl font-semibold leading-snug">{currentQuestion.question}</h1>

              {isVariablesQuestion(currentQuestion.question) ? (() => {
                const hints = variableHints(currentQuestion.placeholder)
                const parts = variableParts[currentQuestion.id] ?? { iv: '', dv: '' }
                return (
                  <div className="mt-10 grid gap-4 sm:grid-cols-2 text-left">
                    {([
                      { key: 'iv', label: 'Independent variable', hint: 'What you change or compare', placeholder: hints.iv },
                      { key: 'dv', label: 'Dependent variable', hint: 'What you measure', placeholder: hints.dv },
                    ] as const).map((f, i) => (
                      <div key={f.key}>
                        <label htmlFor={`answer-${currentQuestion.id}-${f.key}`} className="eyebrow block px-2">{f.label}</label>
                        <p className="text-xs text-subtle-foreground px-2 mt-1">{f.hint}</p>
                        <Textarea
                          id={`answer-${currentQuestion.id}-${f.key}`}
                          autoFocus={i === 0}
                          rows={2}
                          placeholder={f.placeholder}
                          value={parts[f.key]}
                          onChange={e => setVariablePart(currentQuestion.id, f.key, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) nextQuestion() }}
                          className="mt-3 min-h-16 text-base md:text-base leading-relaxed px-6 py-4 resize-none placeholder:text-subtle-foreground"
                        />
                      </div>
                    ))}
                  </div>
                )
              })() : (
                <>
                  <label htmlFor={`answer-${currentQuestion.id}`} className="sr-only">Your answer</label>
                  <Textarea
                    id={`answer-${currentQuestion.id}`}
                    autoFocus
                    rows={3}
                    placeholder={currentQuestion.placeholder}
                    value={answers[currentQuestion.id] ?? ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) nextQuestion() }}
                    className="mt-10 min-h-16 text-base md:text-base leading-relaxed px-7 py-4 resize-none text-left placeholder:text-subtle-foreground"
                  />
                </>
              )}

              <div className="mt-6 flex items-center justify-between">
                <Button variant="ghost" onClick={previousQuestion}><ArrowLeft /> Back</Button>
                <div className="flex items-center gap-2">
                  {!answers[currentQuestion.id]?.trim() && (
                    <Button variant="ghost" onClick={nextQuestion}>Skip</Button>
                  )}
                  <Button onClick={nextQuestion}>
                    {isLastQuestion ? 'Find readings' : 'Next'} <ArrowRight />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Readings ── */}
          {!busy && step === 'recommend' && (
            <div>
              <div className="text-center">
                <h1 className="font-serif text-3xl font-semibold">Starting readings</h1>
                <p className="mt-3 text-muted-foreground leading-relaxed max-w-lg mx-auto">
                  {rrlPapers.length + rrwPapers.length} suggestions for &ldquo;{topic.trim()}&rdquo;. Keep the ones you want in your paper; you can add more later.
                  {rrlPapers.length > 0 && <> Hover a study to see how it relates to yours.</>}
                </p>
              </div>

              {rrlPapers.length > 0 && (
                <section className="mt-12">
                  <div className="flex items-baseline justify-between pb-3 border-b border-border">
                    <h2 className="eyebrow">Related literature · OpenAlex</h2>
                    <button className="text-xs text-muted-foreground underline underline-offset-2 hover:text-highlight-strong transition-colors"
                      onClick={() => setSelectedRrl(selectedRrl.size === rrlPapers.length ? new Set() : new Set(rrlPapers.map(p => p.id)))}>
                      {selectedRrl.size === rrlPapers.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <ul className="divide-y divide-border">
                    {rrlPapers.map(paper => (
                      <ReadingRow
                        key={paper.id}
                        on={selectedRrl.has(paper.id)}
                        onToggle={() => toggleIn(setSelectedRrl, paper.id)}
                        title={paper.title}
                        meta={<>{paper.authors.slice(0, 2).join(', ')}{paper.authors.length > 2 ? ' et al.' : ''} · {paper.year}{paper.journal && <> · <i>{paper.journal}</i></>}</>}
                        detail={paper.abstract || undefined}
                        href={paper.doi ? (paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`) : undefined}
                        relation={relationFor(paper.id)}
                        rowId={paper.id.replace(/[^a-zA-Z0-9_-]/g, '')}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {rrwPapers.length > 0 && (
                <section className="mt-10">
                  <div className="flex items-baseline justify-between pb-3 border-b border-border">
                    <h2 className="eyebrow">Recommended reading</h2>
                    <button className="text-xs text-muted-foreground underline underline-offset-2 hover:text-highlight-strong transition-colors"
                      onClick={() => setSelectedRrw(selectedRrw.size === rrwPapers.length ? new Set() : new Set(rrwPapers.map(p => p.id)))}>
                      {selectedRrw.size === rrwPapers.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <ul className="divide-y divide-border">
                    {rrwPapers.map(paper => (
                      <ReadingRow
                        key={paper.id}
                        on={selectedRrw.has(paper.id)}
                        onToggle={() => toggleIn(setSelectedRrw, paper.id)}
                        title={paper.title}
                        meta={<>{paper.authors.join(', ')} · {paper.year}</>}
                        detail={<><span className="text-muted-foreground">Why read this:</span> {paper.why}</>}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {rrlPapers.length + rrwPapers.length === 0 && (
                <p className="mt-12 text-center text-sm text-muted-foreground">No readings came back for this scope. You can still create the paper and search from the writing view.</p>
              )}

              {/* Pinned, centred call to action */}
              <div className="sticky bottom-6 mt-12 flex justify-center pointer-events-none">
                <Button onClick={handleCreateProject} size="lg" className="pointer-events-auto bg-background">
                  Create paper{totalSelected > 0 ? ` with ${totalSelected} reading${totalSelected !== 1 ? 's' : ''}` : ''} <ArrowRight />
                </Button>
              </div>
            </div>
          )}

          {!busy && (
            <div className={step === 'recommend' ? 'mt-8' : 'mt-16'}>
              <StepDots steps={STEPS} current={stepIndex} label={STEP_LABELS[step]} />
            </div>
          )}
        </Appear>
      </div>

      {/* Existing papers: moved out of the flow so the prompt stays centred */}
      <Dialog open={papersOpen} onOpenChange={o => { setPapersOpen(o); if (!o) { setSelectMode(false); setSelected(new Set()); setSearch('') } }}>
        <DialogContent className="sm:max-w-md p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="font-serif text-xl">Your papers</DialogTitle>
            <DialogDescription>Open a paper to keep working, or tidy up old ones.</DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-3 flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-subtle-foreground" />
              <input type="text" placeholder="Search" value={search} onChange={e => setSearch(e.target.value)}
                aria-label="Search papers"
                className="w-full pl-10 pr-4 py-2 text-sm rounded-full outline-none border border-input bg-card focus:border-ring transition-colors" />
            </div>
            {!selectMode
              ? <button onClick={() => setSelectMode(true)} className="text-xs text-muted-foreground hover:text-highlight-strong transition-colors">Select</button>
              : <button onClick={() => { setSelectMode(false); setSelected(new Set()) }} className="text-xs text-muted-foreground hover:text-highlight-strong transition-colors">Done</button>
            }
          </div>

          {selectMode && (
            <div className="flex items-center justify-between px-6 pb-3 gap-2">
              <button onClick={() => setSelected(selected.size === filteredProjects.length ? new Set() : new Set(filteredProjects.map(p => p.id)))}
                className="text-xs text-muted-foreground hover:text-highlight-strong transition-colors">
                {selected.size === filteredProjects.length ? 'Deselect all' : 'Select all'}
              </button>
              <button onClick={handleDeleteSelected} disabled={selected.size === 0}
                className="flex items-center gap-2 text-xs text-foreground hover:text-destructive disabled:text-subtle-foreground disabled:cursor-not-allowed transition-colors">
                <Trash2 className="h-3 w-3" /> Delete{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            </div>
          )}

          <ul className="max-h-[50vh] overflow-y-auto px-3 pb-4 border-t border-border pt-2">
            {filteredProjects.length === 0 && (
              <li className="px-3 py-6 text-sm text-muted-foreground text-center">No papers match &ldquo;{search}&rdquo;.</li>
            )}
            {filteredProjects.map(project => {
              const isSel = selectMode && selected.has(project.id)
              return (
                <li key={project.id} className={cn('group flex items-start gap-2 px-4 py-3 rounded-3xl transition-colors duration-150', isSel ? 'bg-primary-soft' : ' hover:text-highlight-strong')}>
                  {selectMode && (
                    <button onClick={() => handleSelectExisting(project.id)} aria-label={isSel ? 'Deselect' : 'Select'}
                      className={cn('mt-1 h-4 w-4 shrink-0 rounded-sm border flex items-center justify-center transition-colors',
                        isSel ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-card')}>
                      {isSel && <Check className="h-3 w-3" />}
                    </button>
                  )}
                  {editingId === project.id ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                      <input ref={editInputRef} value={editingTitle} onChange={e => setEditingTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') cancelEdit() }}
                        onBlur={commitEdit}
                        className="flex-1 min-w-0 text-sm rounded-full px-3 py-1 outline-none border border-ring bg-card" />
                      <button onMouseDown={e => { e.preventDefault(); commitEdit() }} className="h-5 w-5 flex items-center justify-center text-primary shrink-0" aria-label="Save"><Check className="h-3 w-3" /></button>
                      <button onMouseDown={e => { e.preventDefault(); cancelEdit(e) }} className="h-5 w-5 flex items-center justify-center text-muted-foreground shrink-0" aria-label="Cancel"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <>
                      <button className="flex-1 min-w-0 text-left group/title" onClick={() => handleSelectExisting(project.id)}>
                        <span className="block text-sm text-foreground line-clamp-2 leading-snug group-hover/title:text-highlight-strong transition-colors duration-150">{project.title}</span>
                        <span className="block text-xs text-subtle-foreground mt-1">
                          Edited {new Date(project.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </button>
                      {!selectMode && (
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                          <button onClick={e => { e.stopPropagation(); setEditingId(project.id); setEditingTitle(project.title) }}
                            className="h-6 w-6 flex items-center justify-center rounded-full text-subtle-foreground hover:text-highlight-strong" title="Rename">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDeleteOne(project.id, project.title) }}
                            className="h-6 w-6 flex items-center justify-center rounded-full text-subtle-foreground hover:text-destructive" title="Delete">
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
        </DialogContent>
      </Dialog>
    </div>
  )
}
