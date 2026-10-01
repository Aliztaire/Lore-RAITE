'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import { useAuth } from '@/components/auth-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Appear } from '@/components/buddy/appear'

/** Turns Firebase error codes into plain sentences. */
function friendlyError(err: any, fallback: string): string {
  switch (err?.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don’t match an account.'
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Sign in instead.'
    case 'auth/weak-password':
      return 'Use a password with at least 6 characters.'
    case 'auth/invalid-email':
      return 'That email address doesn’t look right.'
    case 'auth/popup-closed-by-user':
      return 'The Google sign-in window was closed before finishing.'
    case 'auth/network-request-failed':
      return 'Can’t reach the sign-in service. Check your connection and try again.'
    case 'auth/unauthorized-domain':
      return `Sign-in isn’t enabled for ${typeof window !== 'undefined' ? window.location.hostname : 'this address'}. ` +
        'In the Firebase console, add it under Authentication → Settings → Authorized domains, or open the app at localhost.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method is turned off. Enable it in the Firebase console under Authentication → Sign-in method.'
    default:
      return err?.message || fallback
  }
}

export default function LoginPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user && !loading) {
      router.push('/')
    }
  }, [user, loading, router])

  const handleGoogleSignIn = async () => {
    if (!auth) return
    try {
      setError(null)
      await signInWithPopup(auth, googleProvider)
      // Redirect handled by useEffect
    } catch (err: any) {
      console.error(err)
      setError(friendlyError(err, 'Failed to sign in with Google.'))
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!auth) return
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'sign-up') {
        await createUserWithEmailAndPassword(auth, email, password)
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      // Redirect handled by useEffect
    } catch (err: any) {
      console.error(err)
      setError(friendlyError(err, 'Failed to authenticate.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  const isSignUp = mode === 'sign-up'

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-8 py-16">
      <Appear id={mode} className="w-full max-w-sm">
        <div className="text-center">
          <Image src="/BUDDY_LOGO_CIRCLE.png" alt="" width={48} height={48} className="mx-auto rounded-full" />
          <h1 className="mt-6 font-serif text-3xl font-semibold">
            {isSignUp ? 'Create your account' : 'Welcome to Buddy'}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {isSignUp ? 'Start a research paper and keep it synced across devices.' : 'Sign in to continue your research.'}
          </p>
        </div>

        <div className="mt-10 space-y-6">
          <Button variant="outline" size="lg" className="w-full" onClick={handleGoogleSignIn} disabled={!auth}>
            {/* Google's "G" mark keeps its official colours per Google's branding guidelines */}
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <div className="flex items-center gap-4" aria-hidden>
            <div className="h-px flex-1 bg-border" />
            <span className="eyebrow">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            <label htmlFor="email" className="sr-only">Email</label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 px-5"
            />
            <label htmlFor="password" className="sr-only">Password</label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 px-5"
            />
            <Button type="submit" size="lg" className="w-full mt-2" disabled={submitting || !auth}>
              {submitting ? <><Loader2 className="animate-spin" /> Please wait…</> : isSignUp ? 'Create account' : 'Sign in'}
            </Button>
          </form>

          {error && (
            <p role="alert" className="text-sm text-destructive text-center leading-relaxed">{error}</p>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {isSignUp ? 'Already have an account?' : 'New to Buddy?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(isSignUp ? 'sign-in' : 'sign-up'); setError(null) }}
              className="text-foreground underline underline-offset-4 decoration-border hover:text-highlight-strong hover:decoration-current transition-colors duration-150"
            >
              {isSignUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>

        <p className="mt-12 text-center text-xs text-subtle-foreground leading-relaxed">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </Appear>
    </main>
  )
}
