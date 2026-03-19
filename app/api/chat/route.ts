import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'

export const maxDuration = 30

const SYSTEM_PROMPT = `You are Buddy, an AI research assistant specialized in academic writing. You help researchers:

1. Structure their papers with clear, logical outlines
2. Improve writing clarity and academic tone
3. Suggest relevant sources and citations
4. Identify gaps in arguments and methodology
5. Provide feedback on coherence and flow

When analyzing sections:
- Point out specific strengths and areas for improvement
- Suggest concrete examples or evidence that could strengthen arguments
- Recommend transitional phrases for better flow
- Identify potential counterarguments to address

Be encouraging but honest. Use academic language while remaining accessible.
Format responses with clear headings and bullet points when listing suggestions.`

export async function POST(req: Request) {
  const { messages, context }: { 
    messages: UIMessage[]
    context?: {
      projectTitle?: string
      currentSection?: string
      sectionContent?: string
    }
  } = await req.json()

  // Build context-aware system prompt
  let systemPrompt = SYSTEM_PROMPT
  if (context?.projectTitle) {
    systemPrompt += `\n\nCurrent Research Project: "${context.projectTitle}"`
  }
  if (context?.currentSection) {
    systemPrompt += `\nCurrent Section: ${context.currentSection}`
  }
  if (context?.sectionContent) {
    systemPrompt += `\n\nSection Content:\n${context.sectionContent.substring(0, 2000)}${context.sectionContent.length > 2000 ? '...' : ''}`
  }

  const result = streamText({
    model: 'anthropic/claude-sonnet-4-20250514',
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
