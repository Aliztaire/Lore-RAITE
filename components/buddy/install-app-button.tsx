'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

// Fires only on browsers that support installable PWAs (Chromium-based).
// Absent on others (e.g. iOS Safari) — no dead button there.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __deferredInstallPrompt?: BeforeInstallPromptEvent
  }
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showTip, setShowTip] = useState(false)

  useEffect(() => {
    // The inline script in app/layout.tsx (strategy="beforeInteractive")
    // listens for beforeinstallprompt before React even mounts, in case it
    // fires during that window. Pick it up here if so.
    if (window.__deferredInstallPrompt) {
      setDeferredPrompt(window.__deferredInstallPrompt)
    }
    const onCaptured = () => {
      if (window.__deferredInstallPrompt) setDeferredPrompt(window.__deferredInstallPrompt)
    }
    window.addEventListener('bip-captured', onCaptured)

    // Fallback in case the early script's listener somehow missed it.
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Fires once per real install, regardless of whether it came from our
    // button or the browser's own install UI — the right single place to
    // surface the pin-the-shortcut tip, since there's nowhere else on
    // Android to discover that "New Voice Note" can be its own home-screen icon.
    const onInstalled = () => {
      setDeferredPrompt(null)
      window.__deferredInstallPrompt = undefined
      setShowTip(true)
      setTimeout(() => setShowTip(false), 10000)
    }
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('bip-captured', onCaptured)
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    window.__deferredInstallPrompt = undefined
  }

  return (
    <>
      {deferredPrompt && (
        <button
          onClick={handleInstall}
          title="Install Buddy as an app"
          className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground hover:text-highlight-strong transition-colors duration-150"
        >
          <Download className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Install app</span>
        </button>
      )}

      {showTip && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-sm rounded-2xl border border-border bg-card px-5 py-4 shadow-lg"
        >
          <p className="text-sm font-medium text-foreground">Buddy is installed!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tip: long-press the Buddy icon on your home screen and drag out &ldquo;New Voice Note&rdquo; to pin a dedicated quick-record icon.
          </p>
        </div>
      )}
    </>
  )
}
