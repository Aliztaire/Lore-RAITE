'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import { Send, X, Pin, PinOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBuddyStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { ChatMarkdown, MessageBlock } from './chat-message'

const MIN_WIDTH = 320
const MAX_WIDTH = 640

/**
 * Research assistant — a right-hand margin panel. Open, pinned and width state live in the store
 * (chatSidebarOpen / chatSidebarPinned / chatSidebarWidth) so they persist between sessions.
 */
export function GlobalAIChat() {
  const {
    getCurrentProject, activeChatId, createChatSession, updateChatMessages,
    chatSidebarOpen: isOpen, setChatSidebarOpen: setIsOpen,
    chatSidebarPinned: isPinned, setChatSidebarPinned: setPinned,
    chatSidebarWidth: width, setChatSidebarWidth: setWidth,
  } = useBuddyStore()
  const project = getCurrentProject()

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

  // ── Resize (drag the panel's left edge) ─────────────────────────────────────
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      setWidth(Math.min(Math.max(window.innerWidth - ev.clientX, MIN_WIDTH), MAX_WIDTH))
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [setWidth])

  if (!isOpen) return null

  return (
    <aside
      aria-label="Research assistant"
      style={{ '--panel-w': `${width}px` } as React.CSSProperties}
      className={cn(
        'flex flex-col h-full bg-background border-l border-border animate-in fade-in-0 duration-150',
        // Narrow screens: always an overlay drawer
        'max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:w-full max-lg:max-w-md max-lg:shadow-popover',
        // Wide screens: pinned sits beside the page; unpinned floats over it
        'lg:w-[var(--panel-w)]',
        isPinned ? 'lg:relative lg:shrink-0' : 'lg:absolute lg:inset-y-0 lg:right-0 lg:z-30 lg:shadow-popover',
      )}
    >
      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className="hidden lg:block absolute left-0 inset-y-0 w-1 -ml-px cursor-col-resize hover:bg-highlight transition-colors duration-150 z-10"
        title="Drag to resize"
        aria-hidden
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2 pl-6 pr-3 h-14 border-b border-border shrink-0">
        <div className="min-w-0">
          <p className="font-serif text-base font-semibold leading-tight">Research assistant</p>
          <p className="text-xs text-subtle-foreground leading-tight">Reads your whole paper</p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="hidden lg:inline-flex text-muted-foreground"
            onClick={() => setPinned(!isPinned)}
            aria-pressed={isPinned}
            title={isPinned ? 'Unpin: float over the page' : 'Pin beside the page'}
          >
            {isPinned ? <PinOff /> : <Pin />}
            {isPinned ? 'Unpin' : 'Pin'}
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setIsOpen(false)} aria-label="Close assistant">
            <X />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ask about structure, argument, or evidence across your whole paper. Or start with one of these:
            </p>
            <ul className="border-y border-border divide-y divide-border">
              {quickActions.map((action) => (
                <li key={action.label}>
                  <button
                    onClick={() => handleSubmit(undefined, action.prompt)}
                    className="w-full text-left text-sm py-3 text-foreground hover:text-highlight-strong transition-colors duration-150"
                  >
                    {action.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {messages.map((message) => (
              <MessageBlock key={message.id} role={message.role}>
                {message.parts.map((part, index) => {
                  if (part.type !== 'text') return null
                  return message.role === 'assistant'
                    ? <ChatMarkdown key={index} text={part.text} />
                    : <span key={index}>{part.text}</span>
                })}
              </MessageBlock>
            ))}
          </div>
        )}
        {isLoading && (
          <div className="flex items-center gap-2 pt-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking…
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={(e) => handleSubmit(e)} className="px-6 py-4 border-t border-border shrink-0">
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
    </aside>
  )
}
