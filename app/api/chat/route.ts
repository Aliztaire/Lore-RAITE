import {
  consumeStream,
  convertToModelMessages,
  streamText,
  UIMessage,
} from 'ai'
import { groq } from '@ai-sdk/groq'

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
Format responses with clear headings and bullet points when listing suggestions.

COGNITIVE LOAD REDUCTION (FORMATTING RULES):
1. Extreme Brevity: Remove all fluff and robotic pleasantries (e.g., "Certainly!", "Here is what I found").
2. Bottom Line Up Front (BLUF): State the most critical action item or finding in the very first sentence.
3. Aggressive Chunking: Break complex concepts into maximum 3-5 bullet points. Limit paragraphs to 2 sentences.
4. Maximum White Space: Always leave a blank empty line between paragraphs, headings, and lists.
5. Emphasis: Use **bold** text strategically to draw the eye to the most important keywords or phrases. Do not over-bold.
6. Plain Headings: Write headings in ALL CAPS followed by a colon (e.g. "**POTENTIAL GAPS:**") and a blank line.
7. Plain Lists: Use simple dashes (-) or numbers (1., 2.) for lists.

RESPONSE LENGTH:
- Keep replies highly scannable and direct. Provide exactly what is needed—no more, no less.
- If a concept is deep, give the short version and explicitly offer to elaborate.`

export async function POST(req: Request) {
  const { messages, context }: { 
    messages: UIMessage[]
    context?: {
      projectTitle?: string
      projectTopic?: string
      currentSection?: string
      sectionContent?: string
      fullPaper?: { title: string; content: string }[]
    }
  } = await req.json()

  // Build context-aware system prompt
  let systemPrompt = SYSTEM_PROMPT

  if (context?.projectTitle) {
    systemPrompt += `\n\n--- PAPER UNDER REVIEW ---\nTitle: ${context.projectTitle}`
  }
  if (context?.projectTopic) {
    systemPrompt += `\nTopic/Abstract: ${context.projectTopic}`
  }
  if (context?.currentSection) {
    systemPrompt += `\nSection Currently Being Edited: ${context.currentSection}`
  }

  if (context?.fullPaper && context.fullPaper.length > 0) {
    const sectionLines: string[] = []

    for (const section of context.fullPaper) {
      const hasContent = section.content && section.content.trim().length > 0
      sectionLines.push(
        `### ${section.title.toUpperCase()}\n${hasContent ? section.content : '(empty — not yet written)'}`
      )
    }

    const fullText = sectionLines.join('\n\n')
    systemPrompt += `\n\nHere is the full content of every section in the paper. You MUST read and reference each section below when answering questions:\n\n${fullText.substring(0, 8000)}${fullText.length > 8000 ? '\n\n[...remaining content truncated due to length]' : ''}`
  } else if (context?.sectionContent) {
    // Fallback: single section content (writing-view)
    systemPrompt += `\n\nSection Content:\n${context.sectionContent.substring(0, 3000)}${context.sectionContent.length > 3000 ? '...' : ''}`
  }

  const result = streamText({
    model: groq('llama-3.3-70b-versatile'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
