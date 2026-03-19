'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, ViewMode, ChatMessage, CanvasNode, CanvasEdge, OutlineSection } from './types'

interface BuddyStore {
  // Projects
  projects: Project[]
  currentProjectId: string | null
  
  // UI State
  viewMode: ViewMode
  selectedSectionId: string | null
  showOnboarding: boolean
  
  // Chat
  globalChat: ChatMessage[]
  sectionChats: Record<string, ChatMessage[]>
  
  // Actions
  createProject: (title: string, topic: string) => Project
  selectProject: (id: string) => void
  deleteProject: (id: string) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  
  setViewMode: (mode: ViewMode) => void
  selectSection: (id: string | null) => void
  setShowOnboarding: (show: boolean) => void
  
  // Canvas actions
  addNode: (node: CanvasNode) => void
  updateNode: (id: string, updates: Partial<CanvasNode>) => void
  removeNode: (id: string) => void
  addEdge: (edge: CanvasEdge) => void
  removeEdge: (id: string) => void
  
  // Section actions
  updateSection: (sectionId: string, updates: Partial<OutlineSection>) => void
  toggleSectionComplete: (sectionId: string) => void
  
  // Chat actions
  addGlobalMessage: (message: ChatMessage) => void
  addSectionMessage: (sectionId: string, message: ChatMessage) => void
  
  // Utility
  getCurrentProject: () => Project | null
}

const generateId = () => Math.random().toString(36).substring(2, 15)

const createDefaultOutline = (): Project['outline'] => ({
  introduction: {
    id: generateId(),
    title: 'Introduction',
    description: 'Background, context, and thesis statement',
    content: '',
    completed: false,
    references: [],
    aiNotes: []
  },
  body: [
    {
      id: generateId(),
      title: 'Literature Review',
      description: 'Analysis of existing research and frameworks',
      content: '',
      completed: false,
      references: [],
      aiNotes: []
    },
    {
      id: generateId(),
      title: 'Methodology',
      description: 'Research approach and methods',
      content: '',
      completed: false,
      references: [],
      aiNotes: []
    },
    {
      id: generateId(),
      title: 'Results',
      description: 'Findings and data analysis',
      content: '',
      completed: false,
      references: [],
      aiNotes: []
    },
    {
      id: generateId(),
      title: 'Discussion',
      description: 'Interpretation and implications',
      content: '',
      completed: false,
      references: [],
      aiNotes: []
    }
  ],
  conclusion: {
    id: generateId(),
    title: 'Conclusion',
    description: 'Summary and future directions',
    content: '',
    completed: false,
    references: [],
    aiNotes: []
  }
})

const createInitialNodes = (outline: Project['outline']): CanvasNode[] => {
  const nodes: CanvasNode[] = []
  
  // Introduction node
  nodes.push({
    id: outline.introduction.id,
    type: 'section',
    label: outline.introduction.title,
    x: 400,
    y: 100,
    sectionId: outline.introduction.id
  })
  
  // Body nodes in a vertical layout
  outline.body.forEach((section, index) => {
    nodes.push({
      id: section.id,
      type: 'section',
      label: section.title,
      x: 400,
      y: 200 + (index * 100),
      sectionId: section.id
    })
  })
  
  // Conclusion node
  nodes.push({
    id: outline.conclusion.id,
    type: 'section',
    label: outline.conclusion.title,
    x: 400,
    y: 200 + (outline.body.length * 100),
    sectionId: outline.conclusion.id
  })
  
  return nodes
}

const createInitialEdges = (outline: Project['outline']): CanvasEdge[] => {
  const edges: CanvasEdge[] = []
  const sections = [outline.introduction, ...outline.body, outline.conclusion]
  
  for (let i = 0; i < sections.length - 1; i++) {
    edges.push({
      id: generateId(),
      source: sections[i].id,
      target: sections[i + 1].id,
      label: 'elaborates'
    })
  }
  
  return edges
}

export const useBuddyStore = create<BuddyStore>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,
      viewMode: 'dashboard',
      selectedSectionId: null,
      showOnboarding: true,
      globalChat: [],
      sectionChats: {},
      
      createProject: (title, topic) => {
        const outline = createDefaultOutline()
        const project: Project = {
          id: generateId(),
          title,
          topic,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          outline,
          nodes: createInitialNodes(outline),
          edges: createInitialEdges(outline)
        }
        
        set(state => ({
          projects: [...state.projects, project],
          currentProjectId: project.id,
          showOnboarding: false,
          viewMode: 'dashboard'
        }))
        
        return project
      },
      
      selectProject: (id) => set({ currentProjectId: id }),
      
      deleteProject: (id) => set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        currentProjectId: state.currentProjectId === id ? null : state.currentProjectId
      })),
      
      updateProject: (id, updates) => set(state => ({
        projects: state.projects.map(p => 
          p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
        )
      })),
      
      setViewMode: (mode) => set({ viewMode: mode }),
      
      selectSection: (id) => set({ selectedSectionId: id }),
      
      setShowOnboarding: (show) => set({ showOnboarding: show }),
      
      addNode: (node) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? { ...p, nodes: [...p.nodes, node], updatedAt: new Date().toISOString() }
              : p
          )
        }))
      },
      
      updateNode: (id, updates) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? {
                  ...p,
                  nodes: p.nodes.map(n => n.id === id ? { ...n, ...updates } : n),
                  updatedAt: new Date().toISOString()
                }
              : p
          )
        }))
      },
      
      removeNode: (id) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? {
                  ...p,
                  nodes: p.nodes.filter(n => n.id !== id),
                  edges: p.edges.filter(e => e.source !== id && e.target !== id),
                  updatedAt: new Date().toISOString()
                }
              : p
          )
        }))
      },
      
      addEdge: (edge) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? { ...p, edges: [...p.edges, edge], updatedAt: new Date().toISOString() }
              : p
          )
        }))
      },
      
      removeEdge: (id) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? { ...p, edges: p.edges.filter(e => e.id !== id), updatedAt: new Date().toISOString() }
              : p
          )
        }))
      },
      
      updateSection: (sectionId, updates) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        const updateSectionInOutline = (section: OutlineSection) =>
          section.id === sectionId ? { ...section, ...updates } : section
        
        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? {
                  ...p,
                  outline: {
                    introduction: updateSectionInOutline(p.outline.introduction),
                    body: p.outline.body.map(updateSectionInOutline),
                    conclusion: updateSectionInOutline(p.outline.conclusion)
                  },
                  updatedAt: new Date().toISOString()
                }
              : p
          )
        }))
      },
      
      toggleSectionComplete: (sectionId) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        const toggleSection = (section: OutlineSection) =>
          section.id === sectionId ? { ...section, completed: !section.completed } : section
        
        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? {
                  ...p,
                  outline: {
                    introduction: toggleSection(p.outline.introduction),
                    body: p.outline.body.map(toggleSection),
                    conclusion: toggleSection(p.outline.conclusion)
                  },
                  updatedAt: new Date().toISOString()
                }
              : p
          )
        }))
      },
      
      addGlobalMessage: (message) => set(state => ({
        globalChat: [...state.globalChat, message]
      })),
      
      addSectionMessage: (sectionId, message) => set(state => ({
        sectionChats: {
          ...state.sectionChats,
          [sectionId]: [...(state.sectionChats[sectionId] || []), message]
        }
      })),
      
      getCurrentProject: () => {
        const state = get()
        return state.projects.find(p => p.id === state.currentProjectId) || null
      }
    }),
    {
      name: 'buddy-storage'
    }
  )
)
