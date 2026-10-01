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
import { Project } from './types'

const PROJECTS_COLLECTION = 'projects'

export const firestoreService = {
  async saveProject(userId: string, project: Project) {
    const projectRef = doc(db, PROJECTS_COLLECTION, project.id)
    await setDoc(projectRef, {
      ...project,
      userId,
      updatedAt: new Date().toISOString()
    })
  },

  async updateProject(projectId: string, updates: Partial<Project>) {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId)
    await updateDoc(projectRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    })
  },

  async getProjects(userId: string): Promise<Project[]> {
    const q = query(
      collection(db, PROJECTS_COLLECTION),
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
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId)
    await deleteDoc(projectRef)
  }
}
