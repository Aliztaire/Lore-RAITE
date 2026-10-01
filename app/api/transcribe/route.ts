import { NextResponse } from 'next/server';

// HF's Inference Providers router doesn't expose an OpenAI-compatible
// /v1/audio/transcriptions path — ASR goes through the provider-specific
// task route instead, as a raw binary body (not multipart form data).
const WHISPER_MODEL = 'openai/whisper-large-v3';
const HF_TRANSCRIBE_URL = `https://router.huggingface.co/hf-inference/models/${WHISPER_MODEL}`;

export async function POST(req: Request) {
  try {
    const incoming = await req.formData();
    const file = incoming.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!process.env.HF_API_TOKEN) {
      return NextResponse.json({ text: '[transcription bypassed — HF_API_TOKEN not set]' });
    }

    const audioBytes = await file.arrayBuffer();

    const res = await fetch(HF_TRANSCRIBE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
        'Content-Type': file.type || 'audio/webm',
      },
      body: audioBytes,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Transcribe] HF error', res.status, errText);
      return NextResponse.json(
        { error: `Transcription failed (${res.status}): ${errText.slice(0, 300)}` },
        { status: 500 }
      );
    }

    const data = await res.json();
    const text: string = data?.text ?? '';
    return NextResponse.json({ text });
  } catch (error) {
    console.error('Transcription error:', error);
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
  }
}
