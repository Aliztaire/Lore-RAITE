// Firestore bypassed — all operations are no-ops. Projects persist via zustand localStorage only.
import { Project } from './types'

export const firestoreService = {
  async saveProject(_userId: string, _project: Project) {},
  async updateProject(_projectId: string, _updates: Partial<Project>) {},
  async getProjects(_userId: string): Promise<Project[]> { return [] },
  async deleteProject(_projectId: string) {},
}
