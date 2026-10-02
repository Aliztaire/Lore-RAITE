import { hfModel } from '@/lib/hf'
import { generateText } from 'ai'
import { keyTerms, sharedTerms } from '@/lib/keywords'

// ── Step 1: generate clarifying questions ─────────────────────────────────────
async function generateQuestions(topic: string) {
  const { text } = await generateText({
    model: hfModel(),
    prompt: `You are a research advisor helping a student define their psychology/social science research study.

The student's research topic is: "${topic}"

Generate exactly 5 clarifying questions to help them refine their study. Focus on:
1. Independent and dependent variables they may not have defined
2. Target population / sample
3. Research design (experimental, correlational, qualitative, etc.)
4. Key constructs or terms that need definition
5. What gap or problem in existing literature they aim to address

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "questions": [
    { "id": "q1", "question": "...", "placeholder": "e.g. ..." },
    { "id": "q2", "question": "...", "placeholder": "e.g. ..." },
    { "id": "q3", "question": "...", "placeholder": "e.g. ..." },
    { "id": "q4", "question": "...", "placeholder": "e.g. ..." },
    { "id": "q5", "question": "...", "placeholder": "e.g. ..." }
  ]
}`,
  })

  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '')
  return JSON.parse(cleaned)
}

// ── Step 2: recommend RRLs + RRWs ─────────────────────────────────────────────
const MAX_PAPERS = 6
const OPENALEX = 'https://api.openalex.org/works'
const OA_HEADERS = { headers: { 'User-Agent': 'Buddy-Research-App' } }

type RRL = ReturnType<typeof toRRL>

/**
 * Related literature for the student's study.
 * 1. Semantic search (matches meaning, so idioms like "broken heart" find bereavement and
 *    takotsubo research rather than literal cardiac cell death). Scope answers add context.
 * 2. If semantic search is unavailable, fall back to keyword search filtered by shared terms.
 */
async function fetchOpenAlexPapers(topic: string, answers: Record<string, string> = {}) {
  const context = Object.values(answers).map(a => a?.trim()).filter(Boolean).join('. ')
  const semanticQuery = (context ? `${topic}. ${context}` : topic).slice(0, 600)
  try {
    const semantic = await semanticSearch(semanticQuery)
    if (semantic.length >= 3) return semantic
  } catch (e) {
    console.warn('OpenAlex semantic search failed, using keyword search:', e)
  }
  return keywordSearch(topic)
}

async function semanticSearch(query: string): Promise<RRL[]> {
  const params = new URLSearchParams({ 'search.semantic': query, filter: 'type:article|review', per_page: '15' })
  const res = await fetch(`${OPENALEX}?${params}`, OA_HEADERS)
  if (!res.ok) throw new Error(`OpenAlex ${res.status}`)
  const data = await res.json()
  const papers: RRL[] = (data.results ?? []).map(toRRL)
  // Keep OpenAlex's meaning-based order, but prefer citable papers (with a DOI) over brief notes
  const citable = papers.filter(p => p.doi)
  return (citable.length >= 3 ? citable : papers).slice(0, MAX_PAPERS)
}

async function keywordSearch(query: string): Promise<RRL[]> {
  try {
    // Relevance-ranked (not citation count, which surfaced famous but off-topic papers),
    // over-fetched, then filtered to papers that actually share key terms with the topic.
    const res = await fetch(
      `${OPENALEX}?search=${encodeURIComponent(query)}&per_page=15&sort=relevance_score:desc`,
      OA_HEADERS
    )
    if (!res.ok) return []
    const data = await res.json()
    const topicTerms = keyTerms(query)
    const papers: RRL[] = (data.results ?? []).map(toRRL)
    const overlap = (p: RRL) => sharedTerms(topicTerms, `${p.title} ${p.abstract}`, 20).length
    // Prefer papers sharing 2+ key terms, then 1; keep relevance order within each tier.
    const ranked = [...papers.filter(p => overlap(p) >= 2), ...papers.filter(p => overlap(p) === 1)]
    return (ranked.length >= 3 ? ranked : papers).slice(0, MAX_PAPERS)
  } catch { return [] }
}

function toRRL(w: any) {
  return {
    id: w.id,
    title: w.title || 'Untitled',
    authors: (w.authorships ?? []).slice(0, 3).map((a: any) => a?.author?.display_name ?? 'Unknown'),
    year: w.publication_year?.toString() ?? 'n.d.',
    doi: w.doi ?? null,
    journal: w.primary_location?.source?.display_name ?? null,
    abstract: (() => {
      if (!w.abstract_inverted_index) return ''
      try {
        const wp: [string, number][] = []
        for (const [word, positions] of Object.entries(w.abstract_inverted_index as Record<string, number[]>)) {
          for (const pos of positions) wp.push([word, pos])
        }
        wp.sort((a, b) => a[1] - b[1])
        const txt = wp.map(x => x[0]).join(' ').substring(0, 220)
        return txt.length === 220 ? txt + '…' : txt
      } catch { return '' }
    })(),
    type: 'rrl' as const,
  }
}

async function generateRRWs(topic: string, answers: Record<string, string>) {
  const answerStr = Object.values(answers).filter(Boolean).join('; ')
  const { text } = await generateText({
    model: hfModel(),
    prompt: `A student is researching: "${topic}"
Their clarifying answers: ${answerStr || '(none provided)'}

Recommend 4 highly relevant academic works (seminal papers, frameworks, or theories) they MUST read as their Review of Related Works (RRW). These should be foundational or recent landmark studies in this exact area.

Return ONLY valid JSON (no markdown):
{
  "rrws": [
    {
      "id": "rrw1",
      "title": "...",
      "authors": ["Last, F.", "Last, F."],
      "year": "YYYY",
      "why": "One sentence explaining why this is essential reading for this specific study.",
      "searchQuery": "keywords to find this paper"
    }
  ]
}`,
  })

  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '')
  return JSON.parse(cleaned)
}

const DEFAULT_QUESTIONS = [
  { id: 'q1', question: 'What are your independent and dependent variables?', placeholder: 'e.g. screen time → sleep quality' },
  { id: 'q2', question: 'Who is your target population?', placeholder: 'e.g. undergraduate students aged 18-22' },
  { id: 'q3', question: 'What research design will you use?', placeholder: 'e.g. correlational, experimental, qualitative' },
  { id: 'q4', question: 'What key constructs need defining?', placeholder: 'e.g. "well-being", "engagement"' },
  { id: 'q5', question: 'What gap in the literature are you addressing?', placeholder: 'e.g. limited data on local Gen Z samples' },
]

// ── Route handlers ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { step, topic, answers } = body

    if (step === 'questions') {
      if (!process.env.HF_API_TOKEN) return Response.json({ questions: DEFAULT_QUESTIONS })
      try {
        return Response.json(await generateQuestions(topic))
      } catch (e) {
        // Don't block onboarding on an AI failure (bad key, rate limit, malformed JSON)
        console.warn('Question generation failed, using default questions:', e)
        return Response.json({ questions: DEFAULT_QUESTIONS, fallback: true })
      }
    }

    if (step === 'recommend') {
      if (!process.env.HF_API_TOKEN) {
        const papers = await fetchOpenAlexPapers(topic, answers ?? {})
        return Response.json({ rrl: papers, rrw: [] })
      }
      // Recommended reading is AI-generated; if it fails, still return the OpenAlex papers
      const [papers, rrwResult] = await Promise.all([
        fetchOpenAlexPapers(topic, answers ?? {}),
        generateRRWs(topic, answers ?? {}).catch(e => {
          console.warn('Recommended-reading generation failed, returning OpenAlex papers only:', e)
          return { rrws: [] }
        }),
      ])
      return Response.json({ rrl: papers, rrw: rrwResult.rrws ?? [] })
    }

    return Response.json({ error: 'Invalid step' }, { status: 400 })
  } catch (err: any) {
    console.error('Onboarding API error:', err)
    return Response.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
