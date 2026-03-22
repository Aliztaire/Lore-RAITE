'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import { Send, Sparkles, X, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBuddyStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

export function GlobalAIChat({ embedded = false }: { embedded?: boolean }) {
  const { getCurrentProject, chatSessions, activeChatId, createChatSession, setActiveChat, updateChatMessages } = useBuddyStore()
  const project = getCurrentProject()

  const [isOpen, setIsOpen] = useState(false)
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
    { label: 'Find missing elements', prompt: "What key elements or arguments might be missing from my research paper?" },
    { label: 'Strengthen thesis', prompt: 'Help me strengthen my thesis statement and ensure it is well-supported throughout the paper.' },
  ]

  // Floating FAB mode (not embedded)
  if (!embedded) {
    if (!isOpen) {
      return (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50 transition-transform hover:scale-105"
          size="icon"
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      )
    }

    return (
      <div
        className={cn(
          'fixed bottom-6 right-6 bg-card border border-border rounded-xl shadow-2xl flex flex-col transition-all duration-300 z-50 pointer-events-auto',
          isExpanded ? 'w-[500px] h-[600px]' : 'w-96 h-[480px]'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/80 backdrop-blur-sm rounded-t-xl">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Research Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ChatBody messages={messages} isLoading={isLoading} quickActions={quickActions} handleSubmit={handleSubmit} chatEndRef={chatEndRef} />
        <ChatInput input={input} setInput={setInput} isLoading={isLoading} handleSubmit={handleSubmit} rounded />
      </div>
    )
  }

  // Embedded inline mode (inside sidebar)
  return (
    <div className="flex flex-col flex-1 min-h-0 p-4">
      <div className="flex flex-col flex-1 min-h-0 rounded-2xl border border-border shadow-sm overflow-hidden bg-white">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0 bg-secondary/40">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm">Research Assistant</span>
        </div>
        <ChatBody messages={messages} isLoading={isLoading} quickActions={quickActions} handleSubmit={handleSubmit} chatEndRef={chatEndRef} />
        <ChatInput input={input} setInput={setInput} isLoading={isLoading} handleSubmit={handleSubmit} rounded={false} />
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
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white/85 min-h-0">
      {messages.length === 0 ? (
        <div className="space-y-3 pt-1">
          <div className="text-center space-y-1">
            <p className="font-medium text-sm">How can I help?</p>
            <p className="text-xs text-muted-foreground">Ask me anything about your research paper.</p>
          </div>
          <div className="grid gap-1.5">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleSubmit(undefined, action.prompt)}
                className="text-left text-xs px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors border border-border/50 text-foreground"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'max-w-[88%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed',
              message.role === 'user'
                ? 'ml-auto bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-secondary rounded-bl-sm'
            )}
          >
            {message.parts.map((part, index) => {
              if (part.type === 'text') {
                return (
                  <div key={index} className={message.role === 'assistant' ? "whitespace-pre-wrap prose prose-xs dark:prose-invert max-w-none [&>p]:mb-1.5 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:ml-3 [&>ol]:list-decimal [&>ol]:ml-3" : "whitespace-pre-wrap"}>
                    {message.role === 'assistant' ? <ReactMarkdown>{part.text}</ReactMarkdown> : part.text}
                  </div>
                )
              }
              return null
            })}
          </div>
        ))
      )}
      {isLoading && (
        <div className="flex items-center gap-1.5 px-3 py-2 bg-secondary rounded-2xl rounded-bl-sm w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      )}
      <div ref={chatEndRef} />
    </div>
  )
}

function ChatInput({ input, setInput, isLoading, handleSubmit, rounded }: {
  input: string
  setInput: (v: string) => void
  isLoading: boolean
  handleSubmit: (e?: React.FormEvent) => void
  rounded: boolean
}) {
  return (
    <form onSubmit={(e) => handleSubmit(e)} className={cn('p-4 border-t border-border bg-card/80 backdrop-blur-sm', rounded && 'rounded-b-2xl')}>
      <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your research..."
          disabled={isLoading}
          className="flex-1 rounded-xl bg-secondary border-0 focus-visible:ring-1 text-xs"
        />
        <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="rounded-xl flex-shrink-0 h-8 w-8">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </form>
  )
}
