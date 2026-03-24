import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const { selectedText, references } = await req.json()

  if (!references || references.length === 0) {
    return Response.json({ referenceId: null })
  }

  const refList = references
    .map((r: { id: string; title: string; authors: string[]; year: string; citation: string }, i: number) =>
      `[${i}] id="${r.id}" | ${r.authors?.[0] ?? 'Unknown'} (${r.year ?? 'n.d.'}) — ${r.title}`
    )
    .join('\n')

  const { text } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    prompt: `A student highlighted this sentence in their research paper:
"${selectedText}"

Available references:
${refList}

Which reference best supports or relates to the highlighted sentence? Reply with ONLY the id value (e.g. ref_abc123), nothing else. If none are relevant, reply with "none".`,
    maxTokens: 60,
  })

  const matched = text.trim().replace(/^"|"$/g, '')
  const found = references.find((r: { id: string }) => r.id === matched)
  return Response.json({ referenceId: found ? matched : null })
}
