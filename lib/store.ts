'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, ViewMode, ChatMessage, CanvasNode, CanvasEdge, OutlineSection, ChatSession } from './types'
import { UIMessage } from 'ai'
import { firestoreService } from './firestore-service'

interface BuddyStore {
  // User
  userId: string | null
  setUserId: (id: string | null) => void

  // Projects
  projects: Project[]
  currentProjectId: string | null
  setProjects: (projects: Project[]) => void
  
  // UI State
  viewMode: ViewMode
  selectedSectionId: string | null
  showOnboarding: boolean
  chatSidebarPinned: boolean
  chatSidebarOpen: boolean
  chatSidebarWidth: number
  
  // Chat Sessions
  chatSessions: ChatSession[]
  activeChatId: string | null
  sectionChats: Record<string, ChatMessage[]>
  
  // Actions
  createProject: (title: string, topic: string) => Project
  selectProject: (id: string) => void
  deleteProject: (id: string) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  
  setViewMode: (mode: ViewMode) => void
  selectSection: (id: string | null) => void
  setShowOnboarding: (show: boolean) => void
  setChatSidebarPinned: (pinned: boolean) => void
  setChatSidebarOpen: (open: boolean) => void
  setChatSidebarWidth: (width: number) => void
  
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
  addSectionMessage: (sectionId: string, message: ChatMessage) => void
  createChatSession: (id: string, title?: string, messages?: UIMessage[]) => void
  setActiveChat: (id: string | null) => void
  deleteChatSession: (id: string) => void
  updateChatMessages: (id: string, messages: UIMessage[]) => void
  
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
      userId: null,
      setUserId: (id) => set({ userId: id }),

      projects: [],
      currentProjectId: null,
      setProjects: (projects) => set({ projects, currentProjectId: projects.length > 0 ? projects[0].id : null }),

      viewMode: 'dashboard',
      selectedSectionId: null,
      showOnboarding: true,
      chatSidebarPinned: false,
      chatSidebarOpen: false,
      chatSidebarWidth: 380,
      chatSessions: [],
      activeChatId: null,
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
        
        // Sync to firestore if user is logged in
        const { userId } = get()
        if (userId) {
          firestoreService.saveProject(userId, project)
        }
        
        return project
      },
      
      selectProject: (id) => set({ currentProjectId: id }),
      
      deleteProject: (id) => {
        set(state => ({
          projects: state.projects.filter(p => p.id !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId
        }))

        // Sync to firestore if user is logged in
        const { userId } = get()
        if (userId) {
          firestoreService.deleteProject(id)
        }
      },
      
      updateProject: (id, updates) => {
        set(state => ({
          projects: state.projects.map(p => 
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          )
        }))

        // Sync to firestore if user is logged in
        const { userId } = get()
        if (userId) {
          firestoreService.updateProject(id, updates)
        }
      },
      
      setViewMode: (mode) => set({ viewMode: mode }),
      
      selectSection: (id) => set({ selectedSectionId: id }),
      
      setShowOnboarding: (show) => set({ showOnboarding: show }),
      setChatSidebarPinned: (pinned) => set({ chatSidebarPinned: pinned }),
      setChatSidebarOpen: (open) => set({ chatSidebarOpen: open }),
      setChatSidebarWidth: (width) => set({ chatSidebarWidth: width }),
      
      addNode: (node) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        const updatedAt = new Date().toISOString()
        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? { ...p, nodes: [...p.nodes, node], updatedAt }
              : p
          )
        }))

        const { userId } = get()
        if (userId) {
          firestoreService.updateProject(project.id, { 
            nodes: [...project.nodes, node], 
            updatedAt 
          })
        }
      },
      
      updateNode: (id, updates) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        const updatedAt = new Date().toISOString()
        const newNodes = project.nodes.map(n => n.id === id ? { ...n, ...updates } : n)
        
        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? {
                  ...p,
                  nodes: newNodes,
                  updatedAt
                }
              : p
          )
        }))

        const { userId } = get()
        if (userId) {
          firestoreService.updateProject(project.id, { 
            nodes: newNodes, 
            updatedAt 
          })
        }
      },
      
      removeNode: (id) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        const updatedAt = new Date().toISOString()
        const newNodes = project.nodes.filter(n => n.id !== id)
        const newEdges = project.edges.filter(e => e.source !== id && e.target !== id)

        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? {
                  ...p,
                  nodes: newNodes,
                  edges: newEdges,
                  updatedAt
                }
              : p
          )
        }))

        const { userId } = get()
        if (userId) {
          firestoreService.updateProject(project.id, { 
            nodes: newNodes, 
            edges: newEdges, 
            updatedAt 
          })
        }
      },
      
      addEdge: (edge) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        const updatedAt = new Date().toISOString()
        const newEdges = [...project.edges, edge]

        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? { ...p, edges: newEdges, updatedAt }
              : p
          )
        }))

        const { userId } = get()
        if (userId) {
          firestoreService.updateProject(project.id, { 
            edges: newEdges, 
            updatedAt 
          })
        }
      },
      
      removeEdge: (id) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        const updatedAt = new Date().toISOString()
        const newEdges = project.edges.filter(e => e.id !== id)

        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? { ...p, edges: newEdges, updatedAt }
              : p
          )
        }))

        const { userId } = get()
        if (userId) {
          firestoreService.updateProject(project.id, { 
            edges: newEdges, 
            updatedAt 
          })
        }
      },
      
      updateSection: (sectionId, updates) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        const updateSectionInOutline = (section: OutlineSection) =>
          section.id === sectionId ? { ...section, ...updates } : section
        
        const updatedAt = new Date().toISOString()
        const newOutline = {
          introduction: updateSectionInOutline(project.outline.introduction),
          body: project.outline.body.map(updateSectionInOutline),
          conclusion: updateSectionInOutline(project.outline.conclusion)
        }

        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? {
                  ...p,
                  outline: newOutline,
                  updatedAt
                }
              : p
          )
        }))

        const { userId } = get()
        if (userId) {
          firestoreService.updateProject(project.id, { 
            outline: newOutline, 
            updatedAt 
          })
        }
      },
      
      toggleSectionComplete: (sectionId) => {
        const project = get().getCurrentProject()
        if (!project) return
        
        const toggleSection = (section: OutlineSection) =>
          section.id === sectionId ? { ...section, completed: !section.completed } : section
        
        const updatedAt = new Date().toISOString()
        const newOutline = {
          introduction: toggleSection(project.outline.introduction),
          body: project.outline.body.map(toggleSection),
          conclusion: toggleSection(project.outline.conclusion)
        }

        set(state => ({
          projects: state.projects.map(p =>
            p.id === project.id
              ? {
                  ...p,
                  outline: newOutline,
                  updatedAt
                }
              : p
          )
        }))

        const { userId } = get()
        if (userId) {
          firestoreService.updateProject(project.id, { 
            outline: newOutline, 
            updatedAt 
          })
        }
      },
      
      addSectionMessage: (sectionId, message) => set(state => ({
        sectionChats: {
          ...state.sectionChats,
          [sectionId]: [...(state.sectionChats[sectionId] || []), message]
        }
      })),
      
      createChatSession: (id, title = 'New Chat', messages = []) => {
        const newSession: ChatSession = {
          id,
          title,
          messages,
          updatedAt: new Date().toISOString()
        }
        set(state => ({
          chatSessions: [newSession, ...state.chatSessions],
          activeChatId: id
        }))
      },

      setActiveChat: (id) => set({ activeChatId: id }),

      deleteChatSession: (id) => set(state => ({
        chatSessions: state.chatSessions.filter(s => s.id !== id),
        activeChatId: state.activeChatId === id ? null : state.activeChatId
      })),

      updateChatMessages: (id, messages) => set(state => ({
        chatSessions: state.chatSessions.map(s => 
          s.id === id ? { ...s, messages, updatedAt: new Date().toISOString() } : s
        )
      })),
      
      getCurrentProject: () => {
        const state = get()
        return state.projects.find(p => p.id === state.currentProjectId) || null
      }
    }),
    {
      name: 'buddy-storage',
      // Only persist non-user data or handle user-specific persistence
      partialize: (state) => {
        const { projects, currentProjectId, userId, sectionChats, ...rest } = state
        return rest
      }
    }
  )
)
