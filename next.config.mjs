/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // In production, api/analyze.py and api/analyze-literature.py are deployed
    // as their own Vercel Python Functions at these same paths — no rewrite
    // needed there. In dev, proxy to the local uvicorn server (api/main.py)
    // so the frontend can always call relative /api/analyze* paths.
    if (process.env.NODE_ENV === 'production') return []
    return [
      { source: '/api/analyze', destination: 'http://localhost:8000/analyze' },
      { source: '/api/analyze-literature', destination: 'http://localhost:8000/analyze-literature' },
    ]
  },
}

export default nextConfig
