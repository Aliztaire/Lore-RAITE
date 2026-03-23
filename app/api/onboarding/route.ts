import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

// ── Step 1: generate clarifying questions ─────────────────────────────────────
async function generateQuestions(topic: string) {
  const { text } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
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
async function fetchOpenAlexPapers(query: string) {
  try {
    const res = await fetch(
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=6&sort=cited_by_count:desc`,
      { headers: { 'User-Agent': 'Buddy-Research-App' } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? []).map((w: any) => ({
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
    }))
  } catch { return [] }
}

async function generateRRWs(topic: string, answers: Record<string, string>) {
  const answerStr = Object.values(answers).filter(Boolean).join('; ')
  const { text } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
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

// ── Route handlers ─────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { step, topic, answers } = body

    if (step === 'questions') {
      const result = await generateQuestions(topic)
      return Response.json(result)
    }

    if (step === 'recommend') {
      const [papers, rrwResult] = await Promise.all([
        fetchOpenAlexPapers(topic),
        generateRRWs(topic, answers ?? {}),
      ])
      return Response.json({ rrl: papers, rrw: rrwResult.rrws ?? [] })
    }

    return Response.json({ error: 'Invalid step' }, { status: 400 })
  } catch (err: any) {
    console.error('Onboarding API error:', err)
    return Response.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
