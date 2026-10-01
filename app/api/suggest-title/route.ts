import { createGroq } from '@ai-sdk/groq'
import { generateText } from 'ai'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: Request) {
  const { topic, sectionTitles, currentTitle } = await req.json()

  if (!process.env.GROQ_API_KEY) {
    const base = (currentTitle || topic || 'Untitled Study').trim()
    return Response.json({
      titles: [
        `A Study on ${base}`,
        `${base}: An Exploratory Analysis`,
        `Rethinking ${base}: Insights and Implications`,
      ],
    })
  }

  const { text } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    prompt: `You are helping a student finalize their research paper title.

Current working title: "${currentTitle}"
Research topic: "${topic}"
Paper sections: ${sectionTitles.join(', ')}

Generate exactly 3 alternative academic paper titles. They should be:
- Specific and descriptive of the actual research
- Formatted properly for academic use
- Varied in style (one straightforward, one with a colon/subtitle, one more compelling)

Reply with ONLY a JSON array of 3 strings, no other text. Example: ["Title One", "Title Two: A Subtitle", "Title Three"]`,
    maxTokens: 200,
  })

  try {
    const titles = JSON.parse(text.trim())
    return Response.json({ titles })
  } catch {
    // fallback: extract anything in quotes
    const matches = text.match(/"([^"]+)"/g)?.map((s: string) => s.replace(/"/g, '')) || []
    return Response.json({ titles: matches.slice(0, 3) })
  }
}
