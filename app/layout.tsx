import type { Metadata, Viewport } from 'next'
import { Urbanist } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
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
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#fdfbfd',
}

import { AuthProvider } from '@/components/auth-provider'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${_urbanist.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
