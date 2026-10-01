// Buddy - AI Research Assistant Types
import { UIMessage } from 'ai'

export interface Project {
  id: string
  title: string
  topic: string
  createdAt: string
  updatedAt: string
  outline: PaperOutline
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  bibliography: string[] // reference IDs marked for use
}

export interface PaperOutline {
  introduction: OutlineSection
  body: OutlineSection[]
  conclusion: OutlineSection
}

export interface OutlineSection {
  id: string
  title: string
  description: string
  content: string
  completed: boolean
  references: Reference[]
  aiNotes: string[]
}

export interface Reference {
  id: string
  title: string
  authors: string[]
  year: string
  type: 'article' | 'book' | 'website' | 'other'
  citation: string // Full APA 7 formatted citation string
  doi?: string // DOI URL for external link
  journal?: string // Journal / source name
  volume?: string
  issue?: string
  pages?: string
  notes: string // Abstract preview
}

export interface CanvasNode {
  id: string
  type: 'section' | 'concept' | 'evidence'
  label: string
  x: number
  y: number
  sectionId?: string
  location?: string
  data?: {
    content?: string
    source?: string
    importance?: 'high' | 'medium' | 'low'
    paragraphIndex?: number
    imageUrl?: string
    isCustom?: boolean
    resolved?: boolean
  }
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  label: 'supports' | 'contradicts' | 'references' | 'elaborates'
  description?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sectionId?: string
}

export interface ChatSession {
  id: string
  title: string
  messages: UIMessage[]
  updatedAt: string
}

export interface OnboardingData {
  title: string
  topic: string
  clarifyingAnswers: Record<string, string>
}

export type ViewMode = 'dashboard' | 'canvas' | 'writing' | 'literature' | 'analyzer'

export interface VoiceNote {
  id: string
  content: string
  tag?: string
  createdAt: string
  // Set when transcription couldn't run (offline) at record time. The raw
  // audio is kept as base64 so it can be retried once back online.
  transcriptionStatus?: 'pending' | 'done'
  pendingAudioBase64?: string
}
