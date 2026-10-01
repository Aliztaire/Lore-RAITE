import { createOpenAICompatible } from '@ai-sdk/openai-compatible'

export const HF_MODEL = 'meta-llama/Llama-3.3-70B-Instruct'

export const hf = createOpenAICompatible({
  name: 'huggingface',
  baseURL: 'https://router.huggingface.co/v1',
  apiKey: process.env.HF_API_TOKEN,
})

export const hfModel = () => hf(HF_MODEL)
