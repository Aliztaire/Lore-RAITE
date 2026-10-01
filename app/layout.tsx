import type { Metadata, Viewport } from 'next'
import { Urbanist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import Script from 'next/script'
import './globals.css'

const _urbanist = Urbanist({
  subsets: ["latin"],
  variable: '--font-urbanist',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Buddy - AI Research Assistant',
  description: 'Your AI-powered research companion for academic writing',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#fdfbfd',
}

import { AuthProvider } from '@/components/auth-provider'
import { PwaRegister } from '@/components/pwa-register'
import { Toaster } from '@/components/ui/sonner'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${_urbanist.variable} font-sans antialiased`}>
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
        <AuthProvider>
          {children}
        </AuthProvider>
        <PwaRegister />
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
