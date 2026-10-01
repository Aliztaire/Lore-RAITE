'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'
  const Icon = isDark ? Sun : Moon

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="w-full flex items-center gap-3 rounded-full px-4 py-2 text-sm text-muted-foreground hover:text-highlight-strong transition-colors duration-150"
    >
      <Icon className="h-4 w-4" />
      {isDark ? 'Light theme' : 'Dark theme'}
    </button>
  )
}
