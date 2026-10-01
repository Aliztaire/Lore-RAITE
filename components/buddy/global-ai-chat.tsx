'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import { Send, X, Maximize2, Minimize2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBuddyStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

export function GlobalAIChat({ embedded = false }: { embedded?: boolean }) {
  const { getCurrentProject, chatSessions, activeChatId, createChatSession, setActiveChat, updateChatMessages, chatSidebarOpen: isOpen, setChatSidebarOpen: setIsOpen } = useBuddyStore()
  const project = getCurrentProject()

  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const projectRef = useRef(project)
  useEffect(() => {
    projectRef.current = project
  }, [project])

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({ 
      api: '/api/chat',
      prepareSendMessagesRequest: ({ messages }: { messages: UIMessage[] }) => {
        const outline = projectRef.current?.outline
        const fullPaper = outline ? [
          { title: outline.introduction.title, content: outline.introduction.content },
          ...outline.body.map(s => ({ title: s.title, content: s.content })),
          { title: outline.conclusion.title, content: outline.conclusion.content },
        ] : []

        return {
          body: {
            messages,
            context: {
              projectTitle: projectRef.current?.title,
              projectTopic: projectRef.current?.topic,
              fullPaper,
            }
          }
        }
      }
    }),
  })

  // Sync state: When activeChatId changes, load its messages
  useEffect(() => {
    const sessions = useBuddyStore.getState().chatSessions
    const activeSession = sessions.find(s => s.id === activeChatId)
    if (activeSession) {
      setMessages(activeSession.messages)
    } else {
      setMessages([])
    }
  }, [activeChatId, setMessages])

  // Sync state: Save changing messages back into the store
  useEffect(() => {
    if (activeChatId && messages.length > 0) {
      updateChatMessages(activeChatId, messages)
    }
  }, [messages, activeChatId, updateChatMessages])

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault()
    const textToSend = overrideText || input
    if (!textToSend.trim() || isLoading) return

    if (!activeChatId) {
      const newId = Math.random().toString(36).substring(2, 15)
      const title = textToSend.length > 30 ? textToSend.substring(0, 30) + '...' : textToSend
      createChatSession(newId, title)
    }

    sendMessage({ text: textToSend })
    if (!overrideText) setInput('')
  }

  const quickActions = [
    { label: 'Check coherence', prompt: 'Analyze the coherence and flow between all sections of my paper. Identify any logical gaps or inconsistencies.' },
    { label: 'Suggest improvements', prompt: 'Review my paper structure and suggest specific improvements for each section.' },
    { label: 'Find missing arguments', prompt: "What key elements or arguments might be missing from my research paper?" },
    { label: 'Strengthen thesis', prompt: 'Help me strengthen my thesis statement and ensure it is well-supported throughout the paper.' },
  ]

  // Floating panel mode (not embedded) — opened from the header's Assistant button
  if (!embedded) {
    if (!isOpen) return null

    return (
      <div
        role="dialog"
        aria-label="Research assistant"
        className={cn(
          'fixed top-[4.25rem] right-4 bg-card border border-border rounded-md shadow-popover flex flex-col z-50 animate-in fade-in-0 duration-150',
          isExpanded ? 'w-[560px] h-[calc(100vh-5.5rem)]' : 'w-96 h-[520px] max-h-[calc(100vh-5.5rem)]'
        )}
      >
        <div className="flex items-center justify-between pl-4 pr-2 h-12 border-b border-border shrink-0">
          <div>
            <p className="font-serif text-sm font-semibold leading-tight">Research assistant</p>
            <p className="text-[11px] text-subtle-foreground leading-tight">Reads your whole paper</p>
          </div>
          <div className="flex items-center">
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setIsExpanded(!isExpanded)} aria-label={isExpanded ? 'Shrink' : 'Expand'}>
              {isExpanded ? <Minimize2 /> : <Maximize2 />}
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setIsOpen(false)} aria-label="Close">
              <X />
            </Button>
          </div>
        </div>
        <ChatBody messages={messages} isLoading={isLoading} quickActions={quickActions} handleSubmit={handleSubmit} chatEndRef={chatEndRef} />
        <ChatInput input={input} setInput={setInput} isLoading={isLoading} handleSubmit={handleSubmit} />
      </div>
    )
  }

  // Embedded inline mode (inside sidebar)
  return (
    <div className="flex flex-col flex-1 min-h-0 p-4">
      <div className="flex flex-col flex-1 min-h-0 rounded-md border border-border overflow-hidden bg-card">
        <div className="flex items-center px-4 h-11 border-b border-border shrink-0">
          <span className="font-serif text-sm font-semibold">Research assistant</span>
        </div>
        <ChatBody messages={messages} isLoading={isLoading} quickActions={quickActions} handleSubmit={handleSubmit} chatEndRef={chatEndRef} />
        <ChatInput input={input} setInput={setInput} isLoading={isLoading} handleSubmit={handleSubmit} />
      </div>
    </div>
  )
}

function ChatBody({ messages, isLoading, quickActions, handleSubmit, chatEndRef }: {
  messages: UIMessage[]
  isLoading: boolean
  quickActions: { label: string; prompt: string }[]
  handleSubmit: (e?: React.FormEvent, override?: string) => void
  chatEndRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
      {messages.length === 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ask about structure, argument, or evidence across your whole paper. Or start with one of these:
          </p>
          <ul className="border-y border-border divide-y divide-border">
            {quickActions.map((action) => (
              <li key={action.label}>
                <button
                  onClick={() => handleSubmit(undefined, action.prompt)}
                  className="w-full text-left text-sm px-1 py-2.5 text-foreground hover:text-primary transition-colors duration-150"
                >
                  {action.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'text-sm text-foreground',
              message.role === 'user'
                ? 'max-w-[85%] ml-auto px-3 py-2 rounded-md bg-accent'
                : ''
            )}
          >
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return message.role === 'assistant'
                  ? <div key={index} className="prose-chat"><ReactMarkdown>{part.text}</ReactMarkdown></div>
                  : <div key={index} className="whitespace-pre-wrap">{part.text}</div>
              }
              return null
            })}
          </div>
        ))
      )}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Thinking…
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  )
}

function ChatInput({ input, setInput, isLoading, handleSubmit }: {
  input: string
  setInput: (v: string) => void
  isLoading: boolean
  handleSubmit: (e?: React.FormEvent) => void
}) {
  return (
    <form onSubmit={(e) => handleSubmit(e)} className="p-3 border-t border-border shrink-0">
      <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your research…"
          disabled={isLoading}
          aria-label="Message"
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!input.trim() || isLoading} aria-label="Send">
          <Send />
        </Button>
      </div>
    </form>
  )
}
