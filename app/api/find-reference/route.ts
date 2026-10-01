import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const { selectedText, references } = await req.json()

  if (!references || references.length === 0) {
    return Response.json({ referenceId: null })
  }

  if (!process.env.GROQ_API_KEY) {
    return Response.json({ referenceId: references[0]?.id ?? null })
  }

  // Use numbered list — LLMs are much more reliable with index numbers than opaque IDs
  const refList = references
    .map((r: { title: string; authors: string[]; year: string }, i: number) =>
      `${i}. ${r.authors?.[0] ?? 'Unknown'} (${r.year ?? 'n.d.'}) — ${r.title}`
    )
    .join('\n')

  const { text } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    prompt: `A student highlighted this sentence in their research paper:
"${selectedText}"

Available references (numbered 0 to ${references.length - 1}):
${refList}

Which reference number best supports or relates to the highlighted sentence?
Reply with ONLY the number (e.g. 0, 1, 2...). If none are relevant, reply with -1.`,
    maxTokens: 10,
  })

  // Extract first integer from the response
  const match = text.trim().match(/-?\d+/)
  const index = match ? parseInt(match[0], 10) : -1

  if (index >= 0 && index < references.length) {
    return Response.json({ referenceId: references[index].id })
  }
  return Response.json({ referenceId: null })
}
