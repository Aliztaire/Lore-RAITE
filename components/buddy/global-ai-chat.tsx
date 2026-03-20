'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, UIMessage } from 'ai'
import ReactMarkdown from 'react-markdown'
import { Send, Sparkles, X, RotateCcw, PanelRight, MessageSquare, Plus, Trash2, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBuddyStore } from '@/lib/store'
import { cn } from '@/lib/utils'

export function GlobalAIChat() {
  const {
    getCurrentProject,
    chatSidebarPinned,
    setChatSidebarPinned,
    chatSidebarOpen,
    setChatSidebarOpen,
    chatSidebarWidth,
    setChatSidebarWidth,
    chatSessions,
    activeChatId,
    createChatSession,
    setActiveChat,
    deleteChatSession,
    updateChatMessages
  } = useBuddyStore()

  const project = getCurrentProject()

  const [input, setInput] = useState('')
  const [isResizing, setIsResizing] = useState(false)
  const [isHistoryView, setIsHistoryView] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Keep a ref to the latest project so the transport closure always reads the freshest data
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
    // Only fetch once when the ID changes to prevent infinite loops
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
      // Small optimization: Don't compare, just blindly update store. It's fast enough.
      updateChatMessages(activeChatId, messages)
    }
  }, [messages, activeChatId, updateChatMessages])

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    if (!isHistoryView) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isHistoryView])

  // Disable text selection while dragging
  useEffect(() => {
    document.body.style.userSelect = isResizing ? 'none' : ''
    return () => { document.body.style.userSelect = '' }
  }, [isResizing])

  // --- Resize logic ---
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const onMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX
      setChatSidebarWidth(Math.min(720, Math.max(280, newWidth)))
    }
    const onUp = () => {
      setIsResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [setChatSidebarWidth])

  const handleSubmit = (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault()

    const textToSend = overrideText || input
    if (!textToSend.trim() || isLoading) return

    // Auto-create session if none active
    if (!activeChatId) {
      const newId = Math.random().toString(36).substring(2, 15)
      // Use first bit of text as title
      const title = textToSend.length > 30 ? textToSend.substring(0, 30) + '...' : textToSend
      createChatSession(newId, title)
      // The setActiveChat happens inside createChatSession automatically
    }

    sendMessage({ text: textToSend })
    if (!overrideText) setInput('')
  }

  const quickActions = [
    { label: '🔍 Check coherence', prompt: 'Analyze the coherence and flow between all sections of my paper. Identify any logical gaps or inconsistencies.' },
    { label: '✍️ Suggest improvements', prompt: 'Review my paper structure and suggest specific improvements for each section.' },
    { label: '🔎 Find missing elements', prompt: 'What key elements or arguments might be missing from my research paper?' },
    { label: '💡 Strengthen thesis', prompt: 'Help me strengthen my thesis statement and ensure it is well-supported throughout the paper.' },
  ]

  const handleClose = () => setChatSidebarOpen(false)

  const handleTogglePin = () => {
    const next = !chatSidebarPinned
    setChatSidebarPinned(next)
    if (next) setChatSidebarOpen(true)
  }

  const handleNewChat = () => {
    setActiveChat(null)
    setIsHistoryView(false)
  }

  const suggestionPool = [
    'Can you elaborate on that?',
    'What evidence supports this point?',
    'How does this connect to my thesis?',
    'What are the counterarguments to consider?',
    'What sources would you recommend?',
    'How can I improve the flow here?',
    'What academic terminology fits best?',
    'What are the gaps in this argument?',
    'Can you suggest a stronger opening sentence?',
    'How does this fit the broader research context?',
  ]

  const hasAiReply = messages.some(m => m.role === 'assistant')
  const offset = (messages.length * 3) % suggestionPool.length
  const suggestions = hasAiReply && !isLoading
    ? [...suggestionPool.slice(offset), ...suggestionPool].slice(0, 3)
    : []

  const formatDate = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  return (
    <>
      <button
        style={{ right: chatSidebarOpen ? chatSidebarWidth : 0 }}
        onClick={() => setChatSidebarOpen(!chatSidebarOpen)}
        className={cn(
          'fixed top-1/2 -translate-y-1/2 z-50 flex flex-col items-center justify-center gap-1',
          'bg-primary text-primary-foreground shadow-lg transition-[right] duration-300 ease-in-out',
          'w-8 rounded-l-xl py-5 hover:w-10',
        )}
        title={chatSidebarOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
      >
        <Sparkles className="h-4 w-4 flex-shrink-0" />
        <span
          className="text-[10px] font-semibold tracking-wide leading-tight"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
        >
          AI
        </span>
      </button>

      {chatSidebarOpen && !chatSidebarPinned && (
        <div
          className="fixed inset-0 z-30 bg-black/10"
          onClick={() => setChatSidebarOpen(false)}
        />
      )}

      <aside
        style={{ width: chatSidebarWidth }}
        className={cn(
          'fixed top-0 right-0 h-full z-40 flex flex-col',
          'bg-card border-l border-border shadow-2xl',
          'transition-transform duration-300 ease-in-out',
          chatSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            'absolute left-0 top-0 h-full w-1.5 cursor-col-resize z-10 group',
            'hover:bg-primary/30 transition-colors',
            isResizing && 'bg-primary/40'
          )}
        >
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="w-0.5 h-4 rounded-full bg-primary/60" />
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {isHistoryView ? (
              <Button variant="ghost" size="icon" className="h-7 w-7 -ml-1 border-0" onClick={() => setIsHistoryView(false)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            ) : (
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
            )}
            <div>
              <p className="font-semibold text-sm">{isHistoryView ? 'Chat History' : 'Research Assistant'}</p>
              {project && !isHistoryView && (
                <p className="text-xs text-muted-foreground truncate max-w-[220px]">{project.title}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isHistoryView && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setIsHistoryView(true)}
                  title="Chat history"
                >
                  <MessageSquare className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={handleNewChat}
                  title="New chat"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 transition-colors',
                chatSidebarPinned
                  ? 'text-primary bg-primary/10 hover:bg-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              onClick={handleTogglePin}
              title={chatSidebarPinned ? 'Unpin sidebar' : 'Pin to side (split screen)'}
            >
              <PanelRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        {isHistoryView ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-secondary/80">
            <Button
              className="w-full mb-4 justify-start bg-card border border-border/50 text-foreground hover:bg-secondary transition-colors"
              onClick={handleNewChat}
            >
              <Plus className="mr-2 h-4 w-4" /> New Chat
            </Button>

            {chatSessions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground mt-8">No past conversations.</p>
            ) : (
              <div className="space-y-2">
                {chatSessions.map(session => (
                  <div
                    key={session.id}
                    className={cn(
                      "flex items-start justify-between p-3 rounded-xl border transition-colors cursor-pointer group",
                      activeChatId === session.id
                        ? "bg-primary/10 border-primary/20"
                        : "bg-card border-border/50 hover:bg-secondary/50"
                    )}
                    onClick={() => {
                      setActiveChat(session.id)
                      setIsHistoryView(false)
                    }}
                  >
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium truncate">{session.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDate(session.updatedAt)} • {session.messages.length} msgs
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10 -mt-0.5 -mr-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteChatSession(session.id)
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Messages Pane */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white/85">
              {messages.length === 0 ? (
                <div className="space-y-4 pt-2">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="w-12 h-12 rounded-full bg-primary/30 flex items-center justify-center">
                        <Sparkles className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <p className="font-medium text-sm">How can I help?</p>
                    <p className="text-xs text-muted-foreground">
                      {project
                        ? `I have full context of your paper. Ask me anything.`
                        : 'Select a project to get started.'}
                    </p>
                  </div>

                  {project && (
                    <div className="grid gap-2">
                      {quickActions.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => handleSubmit(undefined, action.prompt)}
                          className="text-left text-sm px-3 py-2.5 rounded-xl bg-secondary hover:bg-secondary/70 transition-colors border border-border/50"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'max-w-[88%] px-7 py-3.5 rounded-2xl text-sm leading-relaxed',
                        message.role === 'user'
                          ? 'ml-auto bg-primary text-primary-foreground rounded-br-sm'
                          : 'bg-secondary rounded-bl-sm'
                      )}
                    >
                      {message.parts.map((part, index) => {
                        if (part.type === 'text') {
                          return (
                            <div key={index}>
                              {message.role === 'assistant' ? (
                                <div className="space-y-2 leading-relaxed [&>p]:mb-2 last:[&>p]:mb-0 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4 [&>li]:mb-1">
                                  <ReactMarkdown>{part.text}</ReactMarkdown>
                                </div>
                              ) : (
                                <div className="whitespace-pre-wrap">{part.text}</div>
                              )}
                            </div>
                          )
                        }
                        return null
                      })}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-2xl rounded-bl-sm max-w-[60px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  )}

                  {suggestions.length > 0 && (
                    <div className="flex flex-col gap-1.5 pt-1">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleSubmit(undefined, s)}
                          className="text-left text-xs px-3 py-2 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/20 text-primary transition-colors leading-snug"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input Pane */}
            <div className="p-3 border-t border-border bg-card/80 backdrop-blur-sm">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your research..."
                  disabled={isLoading || !project}
                  className="flex-1 rounded-xl bg-secondary border-0 focus-visible:ring-1"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!input.trim() || isLoading || !project}
                  className="rounded-xl flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </aside>
    </>
  )
}
