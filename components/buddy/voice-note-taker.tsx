'use client'

import { useState, useRef } from 'react'
import { Mic, Square, Loader2, Trash2, X, Pencil, Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useBuddyStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const PRESET_TAGS = ['Idea', 'To-Do', 'Source']

const tagClass = (active: boolean) =>
  active
    ? 'bg-primary-soft text-primary border-primary/40'
    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-input'

function TagSelector({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (tag: string | undefined) => void
}) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInput, setCustomInput] = useState('')

  const handlePreset = (tag: string) => {
    onChange(value === tag ? undefined : tag)
    setShowCustomInput(false)
    setCustomInput('')
  }

  const handleOtherClick = () => {
    if (PRESET_TAGS.includes(value ?? '')) {
      onChange(undefined)
    }
    setShowCustomInput(true)
  }

  const commitCustom = () => {
    const trimmed = customInput.trim()
    if (trimmed) onChange(trimmed)
    setShowCustomInput(false)
    setCustomInput('')
  }

  const isCustomActive = value !== undefined && !PRESET_TAGS.includes(value)

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="eyebrow mr-1">Tag</span>
      {PRESET_TAGS.map(tag => (
        <button
          key={tag}
          onClick={() => handlePreset(tag)}
          aria-pressed={value === tag}
          className={cn('text-xs px-2.5 py-0.5 rounded-sm border transition-colors duration-150', tagClass(value === tag))}
        >
          {tag}
        </button>
      ))}

      {showCustomInput ? (
        <input
          autoFocus
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitCustom()
            if (e.key === 'Escape') { setShowCustomInput(false); setCustomInput('') }
          }}
          onBlur={commitCustom}
          placeholder="Custom tag"
          className="text-xs px-2 py-0.5 rounded-sm border border-ring bg-card outline-none w-24"
        />
      ) : (
        <button
          onClick={isCustomActive ? () => onChange(undefined) : handleOtherClick}
          className={cn('text-xs px-2.5 py-0.5 rounded-sm border transition-colors duration-150 flex items-center gap-1', tagClass(isCustomActive))}
        >
          {isCustomActive ? <>{value} <X className="h-2.5 w-2.5" /></> : <><Plus className="h-2.5 w-2.5" /> Other</>}
        </button>
      )}
    </div>
  )
}

export function VoiceNoteTaker() {
  const { isVoiceNotePanelOpen, setVoiceNotePanelOpen, voiceNotes, addVoiceNote, removeVoiceNote, updateVoiceNote } = useBuddyStore()

  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [currentText, setCurrentText] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [selectedTag, setSelectedTag] = useState<string | undefined>(undefined)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTag, setFilterTag] = useState<string | undefined>(undefined)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editTag, setEditTag] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(audioBlob)
        setAudioUrl(url)
        stream.getTracks().forEach(t => t.stop())
        await transcribeAudio(audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error(err)
      setError('Could not access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'voice-note.webm')

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Transcription failed')

      const data = await res.json()
      if (data.text) {
        setCurrentText(prev => prev ? `${prev}\n\n${data.text}` : data.text)
      }
    } catch (err) {
      console.error(err)
      setError('Transcription failed. Please try again.')
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleSave = () => {
    if (currentText.trim()) {
      addVoiceNote(currentText.trim(), selectedTag)
      setCurrentText('')
      setSelectedTag(undefined)
      if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null) }
    }
  }

  // Collect all unique tags from saved notes (for filter bar)
  const allTags = Array.from(new Set(voiceNotes.map(n => n.tag).filter(Boolean))) as string[]
  const filterTags = [...PRESET_TAGS.filter(t => allTags.includes(t)), ...allTags.filter(t => !PRESET_TAGS.includes(t))]

  const filteredNotes = voiceNotes.filter(n => {
    if (filterTag && n.tag !== filterTag) return false
    const q = searchQuery.toLowerCase()
    if (!q) return true
    return n.content.toLowerCase().includes(q) || (n.tag && n.tag.toLowerCase().includes(q))
  })

  return (
    <div
      className={cn(
        "flex flex-col h-full border-r border-border shrink-0 bg-card transition-[width,opacity] duration-200",
        isVoiceNotePanelOpen ? "w-[340px] opacity-100" : "w-0 opacity-0 overflow-hidden border-r-0"
      )}
      aria-hidden={!isVoiceNotePanelOpen}
    >
      <div className="flex items-center justify-between pl-5 pr-3 h-14 border-b border-border shrink-0">
        <h2 className="font-serif text-base font-semibold">Voice notes</h2>
        <Button variant="ghost" size="icon-sm" className="text-muted-foreground" onClick={() => setVoiceNotePanelOpen(false)} aria-label="Close voice notes">
          <X />
        </Button>
      </div>

      {/* Recorder */}
      <div className="px-5 py-5 border-b border-border shrink-0 space-y-4">
        <div className="flex items-center gap-4">
          {!isRecording ? (
            <Button
              size="icon-lg"
              className="rounded-full h-12 w-12"
              onClick={startRecording}
              disabled={isTranscribing}
              aria-label="Start recording"
            >
              <Mic className="size-5" />
            </Button>
          ) : (
            <Button
              size="icon-lg"
              variant="outline"
              className="rounded-full h-12 w-12 border-destructive text-destructive hover:text-destructive"
              onClick={stopRecording}
              aria-label="Stop recording"
            >
              <Square className="size-4 fill-current" />
            </Button>
          )}
          <div className="text-sm">
            <p className="text-foreground flex items-center gap-2">
              {isRecording && <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden />}
              {isRecording ? 'Recording' : isTranscribing ? 'Transcribing…' : 'Record a note'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isRecording ? 'Select stop when you are finished.' : 'Speech is transcribed automatically.'}
            </p>
          </div>
          {isTranscribing && <Loader2 className="h-4 w-4 animate-spin text-subtle-foreground ml-auto" />}
        </div>

        {error && <p role="alert" className="text-xs text-destructive border border-destructive/30 bg-destructive/5 px-3 py-2 rounded-md">{error}</p>}

        {audioUrl && (
          <audio src={audioUrl} controls className="h-8 w-full" />
        )}

        <textarea
          className="w-full text-sm px-3 py-2.5 bg-card border border-input rounded-md min-h-[96px] resize-none outline-none focus:border-ring focus:ring-2 focus:ring-ring/15 transition-colors placeholder:text-subtle-foreground"
          placeholder="Your transcript will appear here. You can also type."
          value={currentText}
          onChange={(e) => setCurrentText(e.target.value)}
          aria-label="Note text"
        />

        <TagSelector value={selectedTag} onChange={setSelectedTag} />

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!currentText.trim() || isTranscribing}
          >
            Save note
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCurrentText('')
              setSelectedTag(undefined)
              if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null) }
            }}
            disabled={!currentText.trim() && !audioUrl}
          >
            Discard
          </Button>
        </div>
      </div>

      {/* Saved notes */}
      <div className="flex-1 overflow-hidden flex flex-col bg-background">
        <div className="flex flex-col gap-3 px-5 pt-4 pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Saved notes</span>
            <span className="text-xs text-subtle-foreground tabular-nums">{filteredNotes.length}</span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-subtle-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes"
              aria-label="Search notes"
              className="h-8 pl-8 text-xs md:text-xs"
            />
          </div>

          {filterTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {filterTags.map(tag => {
                const isSelected = filterTag === tag
                return (
                  <button
                    key={tag}
                    onClick={() => setFilterTag(isSelected ? undefined : tag)}
                    aria-pressed={isSelected}
                    className={cn('text-xs px-2 py-0.5 rounded-sm border transition-colors duration-150', tagClass(isSelected))}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 pb-5">
            {filteredNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6">
                {voiceNotes.length === 0 ? 'No notes yet. Recorded notes will appear here.' : 'No notes match your search.'}
              </p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {filteredNotes.map(note => (
                  <li key={note.id} className="py-3.5 group text-sm">
                    {editingNoteId === note.id ? (
                      <div className="flex flex-col gap-3">
                        <textarea
                          className="w-full text-sm px-3 py-2 bg-card border border-input rounded-md min-h-[90px] resize-none outline-none focus:border-ring focus:ring-2 focus:ring-ring/15"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          autoFocus
                          aria-label="Edit note"
                        />
                        <TagSelector value={editTag} onChange={setEditTag} />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (editContent.trim()) updateVoiceNote(note.id, editContent.trim(), editTag)
                              setEditingNoteId(null)
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="whitespace-pre-wrap leading-relaxed text-foreground">{note.content}</p>
                        <div className="flex justify-between items-center mt-2">
                          <div className="flex items-center gap-2 text-xs text-subtle-foreground">
                            {note.tag && (
                              <span className="px-1.5 py-px rounded-sm border border-border text-muted-foreground">{note.tag}</span>
                            )}
                            <span>
                              {new Date(note.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}, {new Date(note.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150">
                            <button
                              onClick={() => { setEditingNoteId(note.id); setEditContent(note.content); setEditTag(note.tag) }}
                              className="text-subtle-foreground hover:text-foreground p-1.5 rounded transition-colors"
                              title="Edit note"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => removeVoiceNote(note.id)}
                              className="text-subtle-foreground hover:text-destructive p-1.5 rounded transition-colors"
                              title="Delete note"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
