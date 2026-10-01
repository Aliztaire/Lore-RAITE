'use client'

import ReactMarkdown from 'react-markdown'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Assistant markdown with links rendered as clear, external citation links. */
export function ChatMarkdown({ text }: { text: string }) {
  return (
    <div className="prose-chat">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="citation-link">
              {children}
              <ExternalLink aria-hidden className="inline-block h-3 w-3 ml-1 align-baseline" />
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

/** A single message: small role label, then the content. No bubbles. */
export function MessageBlock({ role, children, className }: {
  role: 'user' | 'assistant' | string
  children: React.ReactNode
  className?: string
}) {
  const isUser = role === 'user'
  return (
    <article className={cn('py-4 first:pt-0', className)}>
      <p className={cn('eyebrow mb-2', isUser ? 'text-subtle-foreground' : 'text-primary')}>
        {isUser ? 'You' : 'Assistant'}
      </p>
      <div className={cn('text-sm text-foreground', isUser && 'whitespace-pre-wrap')}>{children}</div>
    </article>
  )
}
