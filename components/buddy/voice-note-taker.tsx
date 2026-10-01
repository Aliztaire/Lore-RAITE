'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, Square, Loader2, Save, Trash2, X, Pencil, Search, Plus, Volume2, VolumeX, WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useBuddyStore } from '@/lib/store'
import { useTextToSpeech } from '@/hooks/use-text-to-speech'
import { cn } from '@/lib/utils'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/data:(.*);base64/)?.[1] || 'audio/webm'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

const PRESET_TAGS = ['Idea', 'To-Do', 'Source']

const getTagColor = (tag?: string, active: boolean = true) => {
  if (!active) return "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
  switch (tag) {
    case 'Idea': return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'To-Do': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'Source': return 'bg-cyan-100 text-cyan-800 border-cyan-200'
    default: return 'bg-violet-100 text-violet-800 border-violet-200'
  }
}

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
    <div className="flex flex-wrap gap-2 mt-3 items-center">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1">Tag As:</span>
      {PRESET_TAGS.map(tag => (
        <button
          key={tag}
          onClick={() => handlePreset(tag)}
          className={cn(
            "text-[11px] px-3 py-1 rounded-full border transition-all font-medium cursor-pointer",
            getTagColor(tag, value === tag)
          )}
        >
          {tag}
        </button>
      ))}

      {showCustomInput ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitCustom()
              if (e.key === 'Escape') { setShowCustomInput(false); setCustomInput('') }
            }}
            onBlur={commitCustom}
            placeholder="Custom tag…"
            className="text-[11px] px-2 py-1 rounded-full border border-violet-300 bg-violet-50 text-violet-800 outline-none w-24 font-medium"
          />
        </div>
      ) : (
        <button
          onClick={isCustomActive ? () => onChange(undefined) : handleOtherClick}
          className={cn(
            "text-[11px] px-3 py-1 rounded-full border transition-all font-medium cursor-pointer flex items-center gap-1",
            isCustomActive
              ? getTagColor(value, true)
              : "bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
          )}
        >
          {isCustomActive ? (
            <>{value} <X className="h-2.5 w-2.5" /></>
          ) : (
            <><Plus className="h-2.5 w-2.5" /> Other</>
          )}
        </button>
      )}
    </div>
  )
}

export function VoiceNoteTaker() {
  const {
    isVoiceNotePanelOpen, setVoiceNotePanelOpen, voiceNotes, addVoiceNote, removeVoiceNote, updateVoiceNote,
    addPendingVoiceNote, markVoiceNoteTranscribed, autoStartRecording, setAutoStartRecording,
  } = useBuddyStore()
  const { speak, stop: stopSpeaking, isSpeaking, isSupported: ttsSupported } = useTextToSpeech()
  const [speakingNoteId, setSpeakingNoteId] = useState<string | null>(null)
  const [retryingNoteId, setRetryingNoteId] = useState<string | null>(null)

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

  // Deep-link quick-capture (?quickCapture=voice) auto-starts recording once
  // the panel is open.
  useEffect(() => {
    if (autoStartRecording && isVoiceNotePanelOpen) {
      setAutoStartRecording(false)
      startRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartRecording, isVoiceNotePanelOpen])

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
      if (!navigator.onLine) {
        // Offline — queue the raw audio instead of losing the thought. A
        // background sync hook (and the manual retry button) transcribe it
        // once the connection is back.
        try {
          const base64 = await blobToBase64(audioBlob)
          addPendingVoiceNote(base64, selectedTag)
          setCurrentText('')
          setSelectedTag(undefined)
          if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null) }
        } catch {
          setError('Could not save the recording for later. Please try again.')
        }
      } else {
        setError('Transcription failed. Please try again.')
      }
    } finally {
      setIsTranscribing(false)
    }
  }

  const retryTranscription = async (noteId: string, audioBase64: string) => {
    setRetryingNoteId(noteId)
    try {
      const blob = base64ToBlob(audioBase64)
      const formData = new FormData()
      formData.append('file', blob, 'voice-note.webm')
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Transcription failed')
      const data = await res.json()
      if (data.text) markVoiceNoteTranscribed(noteId, data.text)
    } catch {
      setError('Still offline — will auto-retry once connected.')
    } finally {
      setRetryingNoteId(null)
    }
  }

  const toggleReadAloud = (note: { id: string; content: string }) => {
    if (speakingNoteId === note.id && isSpeaking) {
      stopSpeaking()
      setSpeakingNoteId(null)
      return
    }
    setSpeakingNoteId(note.id)
    speak(note.content)
  }

  // Keep the per-note "speaking" indicator in sync when speech finishes on its own.
  useEffect(() => {
    if (!isSpeaking) setSpeakingNoteId(null)
  }, [isSpeaking])

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
        "flex flex-col h-full border-r border-border transition-all duration-300 ease-in-out shrink-0 bg-[#fef5dd]",
        isVoiceNotePanelOpen ? "w-[340px] opacity-100" : "w-0 opacity-0 overflow-hidden"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <h2 className="font-bold flex items-center gap-2 text-lg text-slate-800">
          <Mic className="h-5 w-5 text-primary" />
          Capture Thoughts
        </h2>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-full" onClick={() => setVoiceNotePanelOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-4 border-b shrink-0 shadow-sm z-20">
        <div className="p-5 flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3">
            {!isRecording ? (
              <Button
                size="lg"
                className="rounded-full w-16 h-16 bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:scale-105 transition-all"
                onClick={startRecording}
                disabled={isTranscribing}
              >
                <Mic className="h-7 w-7" />
              </Button>
            ) : (
              <div className="relative">
                <div className="absolute inset-0 bg-red-400/30 rounded-full animate-ping" />
                <Button
                  size="lg"
                  variant="destructive"
                  className="rounded-full w-16 h-16 shadow-lg relative z-10 hover:scale-105 transition-all bg-red-500 hover:bg-red-600"
                  onClick={stopRecording}
                >
                  <Square className="h-6 w-6" />
                </Button>
              </div>
            )}
            <span className="text-sm font-medium text-slate-500">
              {isRecording ? 'Listening...' : isTranscribing ? 'Transcribing...' : 'Tap to Record'}
            </span>
          </div>

          {error && <p className="text-xs text-red-600 text-center bg-red-50 border border-red-100 p-2 rounded-lg">{error}</p>}

          {audioUrl && (
            <div className="flex flex-col items-center mt-1">
              <audio src={audioUrl} controls className="h-8 w-full max-w-[260px] opacity-80 hover:opacity-100 transition-opacity" />
            </div>
          )}

          {isTranscribing && (
            <div className="flex justify-center items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs font-medium text-slate-500">Groq Whisper AI is typing...</span>
            </div>
          )}

          <div className="relative">
            <textarea
              className="w-full text-sm p-4 bg-slate-50 border border-slate-200 rounded-xl min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-colors"
              placeholder="Your transcript will appear here..."
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
            />

            <TagSelector value={selectedTag} onChange={setSelectedTag} />

            <div className="flex gap-2 mt-4">
              <Button
                className="flex-1 gap-2 rounded-xl font-semibold shadow-sm"
                onClick={handleSave}
                disabled={!currentText.trim() || isTranscribing}
              >
                <Save className="h-4 w-4" /> Save Note
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-slate-200 text-slate-500 hover:text-slate-700"
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
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col bg-slate-100/50">
        <div className="flex flex-col gap-3 px-5 py-4 border-b bg-slate-50/80 backdrop-blur-sm z-10 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your Notes</span>
            <span className="text-xs bg-white border border-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-bold shadow-sm">
              {filteredNotes.length}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="h-8 pl-8 text-xs bg-white border-slate-200 rounded-lg shadow-sm focus-visible:ring-primary/30"
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
                    className={cn(
                      "text-[10px] px-2.5 py-0.5 rounded-full border transition-all font-medium cursor-pointer shadow-sm",
                      getTagColor(tag, isSelected)
                    )}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {filteredNotes.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl m-2 bg-slate-50/50">
                <Mic className="h-8 w-8 mb-3 opacity-40" />
                <p className="text-sm font-medium text-slate-500">No notes found</p>
                <p className="text-xs opacity-80 mt-1">Record a thought to get started!</p>
              </div>
            ) : (
              filteredNotes.map(note => (
                <div key={note.id} className="bg-white border border-slate-200 rounded-xl p-4 relative group shadow-sm hover:shadow-md transition-all text-sm flex flex-col gap-3">
                  {editingNoteId === note.id ? (
                    <div className="flex flex-col gap-3">
                      <textarea
                        className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-lg min-h-[90px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        autoFocus
                      />
                      <TagSelector value={editTag} onChange={setEditTag} />
                      <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-3 rounded-lg text-slate-500" onClick={() => setEditingNoteId(null)}>
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs px-4 rounded-lg font-semibold shadow-sm"
                          onClick={() => {
                            if (editContent.trim()) updateVoiceNote(note.id, editContent.trim(), editTag)
                            setEditingNoteId(null)
                          }}
                        >
                          Save Changes
                        </Button>
                      </div>
                    </div>
                  ) : note.transcriptionStatus === 'pending' ? (
                    <>
                      <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs font-medium">
                        <WifiOff className="h-3.5 w-3.5 shrink-0" />
                        Recorded offline — will transcribe automatically once you're back online.
                      </div>
                      <div className="flex justify-between items-end mt-1">
                        <span className="text-[10px] font-medium text-slate-400">
                          {new Date(note.createdAt).toLocaleDateString()} • {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => note.pendingAudioBase64 && retryTranscription(note.id, note.pendingAudioBase64)}
                            disabled={retryingNoteId === note.id}
                            className="text-slate-400 hover:text-primary p-2 hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Retry transcription now"
                          >
                            {retryingNoteId === note.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => removeVoiceNote(note.id)}
                            className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{note.content}</p>
                      <div className="flex justify-between items-end mt-1">
                        <div className="flex flex-col gap-2">
                          {note.tag && (
                            <span className={cn("px-2 py-0.5 rounded border text-[10px] font-bold w-fit", getTagColor(note.tag, true))}>
                              {note.tag}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-slate-400">
                            {new Date(note.createdAt).toLocaleDateString()} • {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {ttsSupported && (
                            <button
                              onClick={() => toggleReadAloud(note)}
                              className="text-slate-400 hover:text-primary p-2 hover:bg-primary/10 rounded-lg transition-colors"
                              title={speakingNoteId === note.id && isSpeaking ? 'Stop reading' : 'Read aloud'}
                            >
                              {speakingNoteId === note.id && isSpeaking ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          <button
                            onClick={() => { setEditingNoteId(note.id); setEditContent(note.content); setEditTag(note.tag) }}
                            className="text-slate-400 hover:text-primary p-2 hover:bg-primary/10 rounded-lg transition-colors"
                            title="Edit note"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => removeVoiceNote(note.id)}
                            className="text-slate-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
