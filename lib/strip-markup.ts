// Rough Markdown/HTML -> plain text for text-to-speech. Doesn't need to be
// perfect, just needs to not read literal asterisks and tag names aloud.
export function stripMarkup(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ') // fenced code blocks
    .replace(/<[^>]+>/g, ' ') // HTML tags
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/^#{1,6}\s+/gm, '') // headings
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2') // italics
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/^>\s?/gm, '') // blockquotes
    .replace(/^[-*+]\s+/gm, '') // bullet list markers
    .replace(/^\d+\.\s+/gm, '') // numbered list markers
    .replace(/\n{2,}/g, '. ') // paragraph breaks -> pause
    .replace(/\s+/g, ' ')
    .trim()
}
