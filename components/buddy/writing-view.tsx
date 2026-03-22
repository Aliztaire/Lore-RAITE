'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Send, Mic, MicOff, BookMarked,
  Plus, ChevronLeft, Sparkles, X, Maximize2, Minimize2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { useBuddyStore } from '@/lib/store'
import type { ChatMessage, Reference } from '@/lib/types'
import { cn } from '@/lib/utils'

export function WritingView() {
  const {
    getCurrentProject,
    selectedSectionId,
    selectSection,
    updateSection,
    sectionChats,
    addSectionMessage,
    setViewMode,
    focusMode,
    setFocusMode,
  } = useBuddyStore()

  const project = getCurrentProject()
  const [chatInput, setChatInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showReferenceForm, setShowReferenceForm] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [citedRefId, setCitedRefId] = useState<string | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const QUICK_PROMPTS = [
    'Expand this paragraph',
    'Fix grammar',
    'Add a transition sentence',
    'Make it more formal',
    'Simplify this',
  ]

  const getCurrentSection = () => {
    if (!project || !selectedSectionId) return null
    if (project.outline.introduction.id === selectedSectionId) return project.outline.introduction
    if (project.outline.conclusion.id === selectedSectionId) return project.outline.conclusion
    return project.outline.body.find(s => s.id === selectedSectionId)
  }

  const currentSection = getCurrentSection()
  const chatMessages = selectedSectionId ? sectionChats[selectedSectionId] || [] : []

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleContentChange = (content: string) => {
    if (selectedSectionId) {
      updateSection(selectedSectionId, { content })
    }
  }

  // Auto-save indicator
  useEffect(() => {
    if (!currentSection?.content) return
    setSaveStatus('idle')
    const t1 = setTimeout(() => {
      setSaveStatus('saving')
      setTimeout(() => {
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }, 2000)
    }, 5000)
    return () => clearTimeout(t1)
  }, [currentSection?.content])

  // AI Semantic Connection Evaluation — sends sections as paragraphs to the analyze-connections API
  useEffect(() => {
    if (!currentSection?.content) return

    const timeout = setTimeout(async () => {
      const state = useBuddyStore.getState()
      const currentProject = state.projects.find(p => p.id === state.currentProjectId)
      if (!currentProject) return

      setIsAnalyzing(true)
      const paragraphs = [
        { id: currentProject.outline.introduction.id, title: currentProject.outline.introduction.title, content: currentProject.outline.introduction.content },
        ...currentProject.outline.body.map(s => ({ id: s.id, title: s.title, content: s.content })),
        { id: currentProject.outline.conclusion.id, title: currentProject.outline.conclusion.title, content: currentProject.outline.conclusion.content },
      ].filter(s => s.content && s.content.trim().length > 10)

      if (paragraphs.length < 2) {
        setIsAnalyzing(false)
        return
      }

      try {
        const res = await fetch('/api/analyze-connections', {
          method: 'POST',
          body: JSON.stringify({ paragraphs })
        })
        const newEdges = await res.json()
        if (Array.isArray(newEdges)) {
          newEdges.forEach(edge => {
            const tempProj = useBuddyStore.getState().getCurrentProject()
            const exists = tempProj?.edges.find(e =>
              (e.source === edge.source && e.target === edge.target) ||
              (e.source === edge.target && e.target === edge.source)
            )
            if (!exists) {
              useBuddyStore.getState().addEdge({
                id: Math.random().toString(36).substring(2),
                source: edge.source,
                target: edge.target,
                label: edge.label
              })
            }
          })
        }
      } catch (e) {
        console.error('Semantic edge analysis failed:', e)
      } finally {
        setIsAnalyzing(false)
      }
    }, 4000)

    return () => clearTimeout(timeout)
  }, [currentSection?.content])

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedSectionId) return

    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(2, 15),
      role: 'user',
      content: chatInput,
      timestamp: new Date().toISOString(),
      sectionId: selectedSectionId
    }

    addSectionMessage(selectedSectionId, userMessage)
    setChatInput('')
    setIsAiThinking(true)

    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: Math.random().toString(36).substring(2, 15),
        role: 'assistant',
        content: getAIResponse(chatInput, currentSection?.title || ''),
        timestamp: new Date().toISOString(),
        sectionId: selectedSectionId
      }
      addSectionMessage(selectedSectionId, aiMessage)
      setIsAiThinking(false)
    }, 1500)
  }

  const getAIResponse = (question: string, sectionTitle: string) => {
    const responses = [
      `For your ${sectionTitle} section, consider expanding on the key themes you've introduced. Strong academic writing often includes specific examples and citations to support each major point.`,
      `Great question! When working on ${sectionTitle}, I recommend structuring your argument with clear topic sentences. Each paragraph should connect logically to your thesis.`,
      `Looking at your ${sectionTitle}, you might want to address potential counterarguments. This strengthens your position and shows thorough analysis of the topic.`,
      `For this section, consider adding more transitional phrases to improve flow. Words like "furthermore," "consequently," and "in contrast" help guide readers through your argument.`
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }

  const handleAudit = () => {
    if (!selectedSectionId || !currentSection) return

    setIsAiThinking(true)

    setTimeout(() => {
      const auditMessage: ChatMessage = {
        id: Math.random().toString(36).substring(2, 15),
        role: 'assistant',
        content: `**Section Audit: ${currentSection.title}**\n\n` +
          `**Strengths:**\n- Good foundation for your argument\n- Clear connection to research topic\n\n` +
          `**Suggestions:**\n- Consider adding 2-3 more supporting citations\n- The transition to the next section could be smoother\n- You might want to address the counterargument about...\n\n` +
          `**Missing elements:**\n- Statistical evidence to support claims\n- Direct quotes from primary sources\n- Clear topic sentence for the third paragraph`,
        timestamp: new Date().toISOString(),
        sectionId: selectedSectionId
      }
      addSectionMessage(selectedSectionId, auditMessage)
      setIsAiThinking(false)
    }, 2000)
  }

  const toggleRecording = () => {
    setIsRecording(!isRecording)
  }

  const addReference = (ref: Partial<Reference>) => {
    if (!selectedSectionId || !currentSection) return

    const newRef: Reference = {
      id: Math.random().toString(36).substring(2, 15),
      title: ref.title || '',
      authors: ref.authors || [],
      year: ref.year || '',
      type: ref.type || 'article',
      citation: ref.citation || '',
      notes: ref.notes || ''
    }

    updateSection(selectedSectionId, {
      references: [...currentSection.references, newRef]
    })
    setShowReferenceForm(false)
  }

  const insertCitation = (ref: Reference) => {
    if (!editorRef.current || !selectedSectionId || !currentSection) return
    const ta = editorRef.current
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const citation = ` (${ref.authors[0]?.split(' ').pop() || ref.title}, ${ref.year})`
    const current = currentSection.content || ''
    const next = current.substring(0, start) + citation + current.substring(end)
    handleContentChange(next)
    setCitedRefId(ref.id)
    setTimeout(() => setCitedRefId(null), 1500)
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    const ta = editorRef.current
    if (!ta) return
    const sel = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim()
    if (sel.length > 0) {
      setSelectedText(sel)
      setTooltipPos({ x: e.clientX, y: e.clientY - 48 })
    } else {
      setSelectedText('')
      setTooltipPos(null)
    }
  }

  if (!project || !currentSection) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Select a section to start writing</p>
          <Button variant="outline" onClick={() => setViewMode('dashboard')}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden" onClick={() => setTooltipPos(null)}>
      {/* Text-selection floating tooltip */}
      {tooltipPos && selectedText && (
        <div
          className="fixed z-50 bg-white border border-border rounded-lg shadow-lg px-3 py-1.5 flex items-center gap-2"
          style={{ top: tooltipPos.y, left: tooltipPos.x, transform: 'translateX(-50%)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setChatInput(`Please improve this text: "${selectedText}"`)
              setTooltipPos(null)
              setSelectedText('')
            }}
            className="text-xs font-medium text-primary flex items-center gap-1.5 hover:underline"
          >
            <Sparkles className="h-3 w-3" />
            Improve?
          </button>
        </div>
      )}

      {/* References Sidebar — hidden in focus mode */}
      {!focusMode && (
        <aside className="w-64 border-r border-border bg-card/30 flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-sm flex items-center gap-2">
                <BookMarked className="h-4 w-4 text-primary" />
                References
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowReferenceForm(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {currentSection.references.length} sources
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {currentSection.references.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No references yet
              </p>
            ) : (
              currentSection.references.map((ref) => (
                <div
                  key={ref.id}
                  onClick={() => insertCitation(ref)}
                  title="Click to insert citation at cursor"
                  className={cn(
                    'p-2 rounded-lg border text-xs cursor-pointer transition-all',
                    citedRefId === ref.id
                      ? 'bg-primary/10 border-primary/40'
                      : 'bg-secondary/50 border-border hover:border-primary/30 hover:bg-primary/5'
                  )}
                >
                  <p className="font-medium truncate">{ref.title}</p>
                  <p className="text-muted-foreground truncate">
                    {ref.authors.join(', ')} ({ref.year})
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Add Reference Form */}
          {showReferenceForm && (
            <div className="p-3 border-t border-border bg-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium">Add Reference</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setShowReferenceForm(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const form = e.target as HTMLFormElement
                  const formData = new FormData(form)
                  addReference({
                    title: formData.get('title') as string,
                    authors: (formData.get('authors') as string).split(',').map(a => a.trim()),
                    year: formData.get('year') as string,
                    type: 'article'
                  })
                  form.reset()
                }}
                className="space-y-2"
              >
                <Input name="title" placeholder="Title" className="h-8 text-xs" required />
                <Input name="authors" placeholder="Authors (comma separated)" className="h-8 text-xs" required />
                <Input name="year" placeholder="Year" className="h-8 text-xs" required />
                <Button type="submit" size="sm" className="w-full h-7 text-xs">
                  Add
                </Button>
              </form>
            </div>
          )}
        </aside>
      )}

      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Section Header */}
        <div className="h-14 border-b border-border bg-card/50 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('dashboard')}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="h-4 w-px bg-border" />
            <div>
              <h2 className="font-medium">{currentSection.title}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {saveStatus === 'saving' && (
              <span className="text-[11px] text-muted-foreground animate-pulse">Saving…</span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-[11px] text-emerald-500 font-medium transition-opacity">Saved ✓</span>
            )}
            {isAnalyzing && (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs">
                <Sparkles className="h-3 w-3 animate-pulse" />
                Analyzing Connections...
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {currentSection.content?.split(/\s+/).filter(Boolean).length || 0} words
            </span>
            <button
              onClick={() => setFocusMode(!focusMode)}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
              title={focusMode ? 'Exit focus mode' : 'Focus mode'}
            >
              {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-[#faf9f8]">
          <Textarea
            ref={editorRef}
            value={currentSection.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            onMouseUp={handleMouseUp}
            placeholder={`Start writing your ${currentSection.title.toLowerCase()} here...\n\nTip: Use the AI chat below to get suggestions and feedback on your writing.`}
            className="w-full h-full min-h-[400px] resize-none bg-transparent border-0 focus-visible:ring-0 text-base leading-relaxed font-serif"
          />
        </div>

        {/* Bottom: AI Chat Panel */}
        <div className="h-80 border-t border-border bg-[#faf9f8] flex flex-row shrink-0">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">AI Assistant</span>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Ask questions about your writing or request suggestions
                </p>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      'max-w-[80%] p-3 rounded-lg text-sm',
                      msg.role === 'user'
                        ? 'ml-auto bg-primary text-primary-foreground'
                        : 'bg-secondary'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))
              )}
              {isAiThinking && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>Thinking...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick prompt chips */}
            <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 border-t border-border">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => setChatInput(prompt)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-secondary hover:bg-primary/10 hover:border-primary/30 hover:text-primary text-muted-foreground transition-colors"
                >
                  {prompt}
                </button>
              ))}
              <button
                onClick={handleAudit}
                disabled={isAiThinking}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-secondary hover:bg-primary/10 hover:border-primary/30 hover:text-primary text-muted-foreground transition-colors flex items-center gap-1 disabled:opacity-40"
              >
                What&apos;s Missing?
              </button>
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-border">
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }}
                className="flex items-center gap-2"
              >
                <Button
                  type="button"
                  variant={isRecording ? 'destructive' : 'outline'}
                  size="icon"
                  className="flex-shrink-0"
                  onClick={toggleRecording}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask a question or request suggestions..."
                  className="flex-1"
                  disabled={isAiThinking}
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!chatInput.trim() || isAiThinking}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
