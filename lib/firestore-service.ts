import { db } from './firebase'
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  updateDoc
} from 'firebase/firestore'
import { Project, VoiceNote } from './types'

const PROJECTS_COLLECTION = 'projects'
const VOICE_NOTES_COLLECTION = 'voiceNotes'

// Only reachable when signed in, which requires Firebase to be configured (lib/firebase.ts)
function firestore() {
  if (!db) throw new Error('Firestore is not configured (missing NEXT_PUBLIC_FIREBASE_* env vars)')
  return db
}

export const firestoreService = {
  async saveProject(userId: string, project: Project) {
    const projectRef = doc(firestore(), PROJECTS_COLLECTION, project.id)
    await setDoc(projectRef, {
      ...project,
      userId,
      updatedAt: new Date().toISOString()
    })
  },

  async updateProject(projectId: string, updates: Partial<Project>) {
    const projectRef = doc(firestore(), PROJECTS_COLLECTION, projectId)
    await updateDoc(projectRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    })
  },

  async getProjects(userId: string): Promise<Project[]> {
    const q = query(
      collection(firestore(), PROJECTS_COLLECTION),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => {
      const data = doc.data()
      // Remove userId from the returned project object to match the Project type
      const { userId: _, ...projectData } = data
      return projectData as Project
    })
  },

  async deleteProject(projectId: string) {
    const projectRef = doc(firestore(), PROJECTS_COLLECTION, projectId)
    await deleteDoc(projectRef)
  },

  async saveVoiceNote(userId: string, note: VoiceNote) {
    const noteRef = doc(firestore(), VOICE_NOTES_COLLECTION, note.id)
    // Same undefined-value restriction as updateDoc — an untagged note has tag: undefined.
    const clean = Object.fromEntries(Object.entries({ ...note, userId }).filter(([, v]) => v !== undefined))
    await setDoc(noteRef, clean)
  },

  async updateVoiceNote(noteId: string, updates: Partial<VoiceNote>) {
    const noteRef = doc(firestore(), VOICE_NOTES_COLLECTION, noteId)
    // Firestore's updateDoc rejects literal `undefined` field values (e.g. an
    // untagged note's `tag`) — drop them rather than sending an invalid payload.
    const clean = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined))
    await updateDoc(noteRef, clean)
  },

  async getVoiceNotes(userId: string): Promise<VoiceNote[]> {
    const q = query(
      collection(firestore(), VOICE_NOTES_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map(doc => {
      const data = doc.data()
      const { userId: _, ...noteData } = data
      return noteData as VoiceNote
    })
  },

  async deleteVoiceNote(noteId: string) {
    const noteRef = doc(firestore(), VOICE_NOTES_COLLECTION, noteId)
    await deleteDoc(noteRef)
  }
}
