import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { sections } = await req.json()

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 400 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        system: `You are an AI that analyzes a research paper sequence.\nYou are given a list of sections with their ID, title, and current content.\nEvaluate the sections to find semantic links between them.\nReturn ONLY a valid JSON object matching the following structure exactly (do not wrap in markdown tags):\n{"edges":[{"source":"id","target":"id","label":"elaborates" | "references" | "supports" | "contradicts"}]}\n\nOnly create an edge if there is a strong semantic connection based on the content or title. Do NOT link sections just because they are adjacent in sequence. Keep the number of edges reasonable to avoid clutter.`,
        messages: [
          { 
            role: 'user', 
            content: `Analyze these sections and generate semantic edges:\n${JSON.stringify(sections, null, 2)}`
          }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API Error:', errorText)
      return NextResponse.json({ error: 'Failed to analyze connections' }, { status: 500 })
    }

    const data = await response.json()
    let textOutput = data.content?.[0]?.text || ''
    
    // Clean up potential markdown formatting that Claude sometimes adds despite instructions
    textOutput = textOutput.replace(/```json/g, '').replace(/```/g, '').trim()

    const parsed = JSON.parse(textOutput)
    return NextResponse.json(parsed.edges || [])
  } catch (error) {
    console.error('Error analyzing connections:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
