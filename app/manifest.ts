import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Buddy - AI Research Assistant',
    short_name: 'Buddy',
    description: 'Your AI-powered research companion for academic writing',
    start_url: '/',
    display: 'standalone',
    background_color: '#fdfbfd',
    theme_color: '#fdfbfd',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'New Voice Note',
        short_name: 'Voice Note',
        description: 'Jump straight into recording a voice note',
        url: '/?quickCapture=voice',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  }
}
