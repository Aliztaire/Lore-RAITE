'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  Send, Mic, MicOff, AlertTriangle, BookMarked, 
  Plus, ChevronLeft, Sparkles, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    setViewMode 
  } = useBuddyStore()
  
  const project = getCurrentProject()
  const [chatInput, setChatInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [showReferenceForm, setShowReferenceForm] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Find current section
  const getCurrentSection = () => {
    if (!project || !selectedSectionId) return null
    
    if (project.outline.introduction.id === selectedSectionId) {
      return project.outline.introduction
    }
    if (project.outline.conclusion.id === selectedSectionId) {
      return project.outline.conclusion
    }
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

    // Simulate AI response (will be replaced with actual API call)
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
    // Speech-to-text would be implemented here
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
    <div className="flex-1 flex overflow-hidden">
      {/* References Sidebar */}
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
                className="p-2 rounded-lg bg-secondary/50 border border-border text-xs"
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
              <p className="text-xs text-muted-foreground">{currentSection.description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {currentSection.content?.split(/\s+/).filter(Boolean).length || 0} words
            </span>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <Textarea
            ref={editorRef}
            value={currentSection.content || ''}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder={`Start writing your ${currentSection.title.toLowerCase()} here...\n\nTip: Use the AI chat below to get suggestions and feedback on your writing.`}
            className="w-full h-full min-h-[400px] resize-none bg-transparent border-0 focus-visible:ring-0 text-base leading-relaxed font-serif"
          />
        </div>

        {/* AI Chat Panel */}
        <div className="h-72 border-t border-border bg-card/30 flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI Assistant</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAudit}
              disabled={isAiThinking}
              className="gap-2 text-xs"
            >
              <AlertTriangle className="h-3 w-3" />
              {"What's Missing?"}
            </Button>
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
  )
}
