import { ImageResponse } from 'next/og'
import { readFileSync } from 'fs'
import { join } from 'path'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'
export const runtime = 'nodejs'

export default function Icon() {
  const imageData = readFileSync(join(process.cwd(), 'public/BUDDY_LOGO.png'))
  const base64 = `data:image/png;base64,${imageData.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'white',
        }}
      >
        <img src={base64} style={{ width: 32, height: 32, objectFit: 'contain' }} />
      </div>
    ),
    { width: 32, height: 32 }
  )
}
