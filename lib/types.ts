// Buddy - AI Research Assistant Types

export interface Project {
  id: string
  title: string
  topic: string
  createdAt: string
  updatedAt: string
  outline: PaperOutline
  nodes: CanvasNode[]
  edges: CanvasEdge[]
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
  citation: string
  notes: string
}

export interface CanvasNode {
  id: string
  type: 'section' | 'concept' | 'evidence'
  label: string
  x: number
  y: number
  sectionId?: string
  data?: {
    content?: string
    source?: string
    importance?: 'high' | 'medium' | 'low'
  }
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  label: 'supports' | 'contradicts' | 'references' | 'elaborates'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  sectionId?: string
}

export interface OnboardingData {
  title: string
  topic: string
  clarifyingAnswers: Record<string, string>
}

export type ViewMode = 'dashboard' | 'canvas' | 'writing'
