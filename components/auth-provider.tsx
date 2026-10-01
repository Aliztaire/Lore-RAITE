'use client'

import { createContext, useContext, useEffect } from 'react'
import { useBuddyStore } from '@/lib/store'

type MockUser = {
  uid: string
  email: string
  displayName: string
  photoURL: string | null
}

interface AuthContextType {
  user: MockUser | null
  loading: boolean
}

const mockUser: MockUser = {
  uid: 'local-dev-user',
  email: 'dev@local',
  displayName: 'Local Dev',
  photoURL: null,
}

const AuthContext = createContext<AuthContextType>({ user: mockUser, loading: false })

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { setUserId } = useBuddyStore()

  useEffect(() => {
    setUserId(mockUser.uid)
  }, [setUserId])

  return (
    <AuthContext.Provider value={{ user: mockUser, loading: false }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
