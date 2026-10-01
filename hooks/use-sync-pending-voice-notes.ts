import { useEffect, useRef } from 'react'
import { useBuddyStore } from '@/lib/store'

function base64ToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/data:(.*);base64/)?.[1] || 'audio/webm'
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

// Retries transcription for any voice note that was recorded offline. Mount
// once near the app root — runs on mount (in case the app reopened already
// online with leftovers) and again whenever the browser comes back online.
export function useSyncPendingVoiceNotes() {
  const markVoiceNoteTranscribed = useBuddyStore(s => s.markVoiceNoteTranscribed)
  const syncingRef = useRef(new Set<string>())

  useEffect(() => {
    const syncPending = async () => {
      if (!navigator.onLine) return
      const pending = useBuddyStore.getState().voiceNotes.filter(
        n => n.transcriptionStatus === 'pending' && n.pendingAudioBase64 && !syncingRef.current.has(n.id)
      )
      for (const note of pending) {
        syncingRef.current.add(note.id)
        try {
          const blob = base64ToBlob(note.pendingAudioBase64!)
          const formData = new FormData()
          formData.append('file', blob, 'voice-note.webm')
          const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
          if (!res.ok) throw new Error('Transcription failed')
          const data = await res.json()
          if (data.text) markVoiceNoteTranscribed(note.id, data.text)
        } catch {
          // still offline or transcription failed — leave it pending, next trigger retries
        } finally {
          syncingRef.current.delete(note.id)
        }
      }
    }

    syncPending()
    window.addEventListener('online', syncPending)
    return () => window.removeEventListener('online', syncPending)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
