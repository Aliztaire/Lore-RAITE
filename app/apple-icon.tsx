import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'
export const runtime = 'nodejs'

export default function AppleIcon() {
  const imageData = readFileSync(join(process.cwd(), 'public/BUDDY_LOGO_CIRCLE.png'))
  const base64 = `data:image/png;base64,${imageData.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // iOS flattens transparency to black on home-screen icons, so the
          // logo (a transparent-background circle) needs an opaque backing.
          background: '#381d18',
        }}
      >
        <img src={base64} style={{ width: 130, height: 130, objectFit: 'contain' }} />
      </div>
    ),
    { width: 180, height: 180 }
  )
}
