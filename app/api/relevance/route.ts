import { hfModel } from '@/lib/hf'
import { generateText } from 'ai'

/**
 * POST /api/relevance
 * Explains how each suggested paper relates to the student's study.
 *
 * Body:    { topic: string, answers?: Record<string, string>, papers: { id, title, abstract? }[] }
 * Returns: { relevance: Record<id, { text: string, source: 'ai' | 'keywords', terms: string[] }> }
 *
 * With HF_API_TOKEN: one batched model call writes a sentence per paper.
 * Without it (or if the call fails): a keyword-overlap explanation, labelled as such.
 */

import { keyTerms, sharedTerms } from '@/lib/keywords'

interface PaperIn { id: string; title: string; abstract?: string }
interface Relevance { text: string; source: 'ai' | 'keywords'; terms: string[] }

function keywordExplanation(terms: string[]): string {
  if (terms.length === 0) return 'Matched on meaning rather than shared wording, so it may describe your topic in different terms. Skim the abstract to judge how closely it fits.'
  const list = terms.length === 1 ? terms[0] : `${terms.slice(0, -1).join(', ')} and ${terms[terms.length - 1]}`
  return `Shares key concepts with your study: ${list}.`
}

async function aiExplanations(topic: string, answers: Record<string, string>, papers: PaperIn[]) {
  const answerStr = Object.values(answers).filter(Boolean).join('; ')
  const list = papers.map((p, i) => `${i + 1}. [${p.id}] ${p.title}${p.abstract ? ` — ${p.abstract}` : ''}`).join('\n')
  const { text } = await generateText({
    model: hfModel(),
    prompt: `A student is researching: "${topic}"
Their study details: ${answerStr || '(none provided)'}

For each paper below, write ONE sentence (max 30 words) explaining specifically how it relates to this student's study — name the shared variable, population, method, theory, or gap. If it is only tangential, say so plainly. Do not invent findings that are not implied by the title or abstract.

Papers:
${list}

Return ONLY valid JSON (no markdown): { "relevance": [ { "id": "<id exactly as given in brackets>", "text": "..." } ] }`,
  })
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '')
  const parsed = JSON.parse(cleaned) as { relevance?: { id: string; text: string }[] }
  return new Map((parsed.relevance ?? []).filter(r => r?.id && r?.text).map(r => [r.id, r.text.trim()]))
}

export async function POST(req: Request) {
  try {
    const { topic, answers = {}, papers = [] } = await req.json() as {
      topic?: string; answers?: Record<string, string>; papers?: PaperIn[]
    }
    if (!topic || !Array.isArray(papers)) {
      return Response.json({ error: 'topic and papers are required' }, { status: 400 })
    }

    const studyTerms = keyTerms(`${topic} ${Object.values(answers).join(' ')}`)
    let ai = new Map<string, string>()
    if (process.env.HF_API_TOKEN && papers.length > 0) {
      try { ai = await aiExplanations(topic, answers, papers.slice(0, 12)) }
      catch (e) { console.warn('Relevance AI call failed, using keyword overlap:', e) }
    }

    const relevance: Record<string, Relevance> = {}
    for (const p of papers) {
      const terms = sharedTerms(studyTerms, `${p.title} ${p.abstract ?? ''}`)
      const aiText = ai.get(p.id)
      relevance[p.id] = aiText
        ? { text: aiText, source: 'ai', terms }
        : { text: keywordExplanation(terms), source: 'keywords', terms }
    }
    return Response.json({ relevance })
  } catch (err: any) {
    console.error('Relevance API error:', err)
    return Response.json({ error: err.message || 'Internal error' }, { status: 500 })
  }
}
