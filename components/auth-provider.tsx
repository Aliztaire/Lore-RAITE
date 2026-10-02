'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { auth, firebaseEnabled } from '@/lib/firebase'
import { onAuthStateChanged, User } from 'firebase/auth'

// Used only when Firebase isn't configured (no NEXT_PUBLIC_FIREBASE_* vars): the app runs
// locally with this placeholder user and nothing is written to Firestore.
const LOCAL_USER = {
  uid: 'local-dev-user',
  displayName: 'Local Dev',
  email: 'dev@local',
  photoURL: null,
} as unknown as User
import { useBuddyStore } from '@/lib/store'
import { firestoreService } from '@/lib/firestore-service'

interface AuthContextType {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true })

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { setUserId, setProjects, setShowOnboarding } = useBuddyStore()

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      console.warn('[Buddy] Firebase is not configured; running locally without sign-in or cloud sync.')
      setUser(LOCAL_USER)
      setUserId(null) // keeps the store from calling Firestore
      setLoading(false)
      return
    }

    // Safety timeout — if Firebase never responds, unblock the UI after 5s
    const timeout = setTimeout(() => setLoading(false), 5000)

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timeout)
      setUser(user)
      setUserId(user?.uid || null)

      if (user) {
        try {
          const projects = await firestoreService.getProjects(user.uid)
          setProjects(projects)
          // showOnboarding is a per-device UI flag (persisted to this
          // browser's localStorage, not synced via Firestore) — on a device
          // that's never created a project locally it defaults to true, which
          // would otherwise show the onboarding wizard even though this user
          // already has projects in the cloud.
          if (projects.length > 0) setShowOnboarding(false)
        } catch (error) {
          console.error("Error fetching projects:", error)
          setProjects([])
        }
      } else {
        setProjects([])
      }

      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      unsubscribe()
    }
  }, [setUserId, setProjects, setShowOnboarding])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
