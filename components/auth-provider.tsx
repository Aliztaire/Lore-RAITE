'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '@/lib/firebase'
import { onAuthStateChanged, User } from 'firebase/auth'
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
  const { setUserId, setProjects } = useBuddyStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)
      setUserId(user?.uid || null)
      
      if (user) {
        try {
          const projects = await firestoreService.getProjects(user.uid)
          setProjects(projects)
        } catch (error) {
          console.error("Error fetching projects:", error)
          setProjects([])
        }
      } else {
        setProjects([])
      }
      
      setLoading(false)
    })

    return () => unsubscribe()
  }, [setUserId, setProjects])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
