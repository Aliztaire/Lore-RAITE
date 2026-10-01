'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

// Fires only on browsers that support installable PWAs (Chromium-based).
// Absent on others (e.g. iOS Safari) — no dead button there.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
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
      toast('Buddy is installed!', {
        description: 'Tip: long-press the Buddy icon on your home screen and drag out "New Voice Note" to pin a dedicated quick-record icon.',
        duration: 10000,
      })
    }
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (!deferredPrompt) return null

  const handleInstall = async () => {
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 text-white/70 hover:text-white hover:bg-white/10"
      onClick={handleInstall}
      title="Install Buddy as an app"
    >
      <Download className="h-4 w-4" />
      <span className="hidden sm:inline">Install App</span>
    </Button>
  )
}
