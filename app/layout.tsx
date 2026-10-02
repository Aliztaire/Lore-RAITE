import type { Metadata, Viewport } from 'next'
import { Inter, Source_Serif_4, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Buddy — Research Writing Assistant',
  description: 'A research and writing companion for academic papers',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#faf8f4',
}

import { AuthProvider } from '@/components/auth-provider'
import { PwaRegister } from '@/components/pwa-register'
import { ConfirmProvider } from '@/components/buddy/confirm-dialog'
import { ThemeProvider } from '@/components/theme-provider'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceSerif.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {/* beforeinstallprompt can fire before React hydrates; capture it
            this early so install-app-button.tsx can never miss it. */}
        <Script id="capture-install-prompt" strategy="beforeInteractive">
          {`
            window.addEventListener('beforeinstallprompt', function (e) {
              e.preventDefault();
              window.__deferredInstallPrompt = e;
              window.dispatchEvent(new CustomEvent('bip-captured'));
            });
          `}
        </Script>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <AuthProvider>
            <ConfirmProvider>
              {children}
            </ConfirmProvider>
          </AuthProvider>
        </ThemeProvider>
        <PwaRegister />
        <Analytics />
      </body>
    </html>
  )
}
