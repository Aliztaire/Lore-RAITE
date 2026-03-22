import { NextResponse } from 'next/server'

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1)
}

function getLabel(score: number): 'supports' | 'elaborates' | 'references' {
  if (score >= 0.72) return 'supports'
  if (score >= 0.55) return 'elaborates'
  return 'references'
}

function sharedKeywords(a: string, b: string): string {
  const STOP = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','have','has','had','that','this','these','those','it','its','we','they','our','their','as','not','no','which','who','also','can','such','than','then','used','using'])
  const words = (t: string) => new Set(
    t.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3 && !STOP.has(w))
  )
  const wa = words(a), wb = words(b)
  const shared = [...wa].filter(w => wb.has(w)).slice(0, 4)
  return shared.length > 0 ? `Shared: ${shared.join(', ')}` : 'Related concepts'
}

export async function POST(req: Request) {
  try {
    const { paragraphs } = await req.json()

    if (!paragraphs || paragraphs.length < 2) return NextResponse.json([])

    const hfKey = process.env.HUGGINGFACE_API_KEY
    if (!hfKey) return NextResponse.json([])

    const hfRes = await fetch(
      'https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${hfKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: paragraphs.map((p: any) => p.content.slice(0, 512)) }),
      }
    )

    if (!hfRes.ok) return NextResponse.json([])

    const embeddings: number[][] = await hfRes.json()
    if (!Array.isArray(embeddings) || embeddings.length !== paragraphs.length) return NextResponse.json([])

    const THRESHOLD = 0.38
    const MAX_EDGES = 8
    const scored: { i: number; j: number; score: number }[] = []

    for (let i = 0; i < paragraphs.length; i++) {
      for (let j = i + 1; j < paragraphs.length; j++) {
        if (paragraphs[i].sectionId === paragraphs[j].sectionId) continue
        const score = cosineSimilarity(embeddings[i], embeddings[j])
        if (score >= THRESHOLD) scored.push({ i, j, score })
      }
    }

    scored.sort((a, b) => b.score - a.score)

    const edges = scored.slice(0, MAX_EDGES).map(({ i, j, score }) => ({
      source: paragraphs[i].id,
      target: paragraphs[j].id,
      label: getLabel(score),
      description: sharedKeywords(paragraphs[i].content, paragraphs[j].content),
    }))

    return NextResponse.json(edges)
  } catch (error) {
    console.error('Error analyzing connections:', error)
    return NextResponse.json([])
  }
}
