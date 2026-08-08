export type AiProvider = 'anthropic' | 'openai'

export interface AiConfig {
  provider: AiProvider
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
  timeoutMs: number
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      'No AI provider configured. Set AI_API_KEY (and optionally AI_API_BASE_URL / AI_MODEL) ' +
        'to compile scenarios from plain English. Already-compiled scenarios run without it.',
    )
  }
}

function inferProvider(baseUrl: string): AiProvider {
  const explicit = process.env.AI_PROVIDER?.toLowerCase()
  if (explicit === 'anthropic' || explicit === 'openai') return explicit
  // Anthropic is the only major host speaking /v1/messages; everything else in
  // practice is OpenAI-compatible.
  return /anthropic\.com/i.test(baseUrl) ? 'anthropic' : 'openai'
}

/** True when compilation and repair are available at all. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY?.trim())
}

export function getAiConfig(): AiConfig {
  const apiKey = process.env.AI_API_KEY?.trim()
  if (!apiKey) throw new AiNotConfiguredError()

  const baseUrl = (process.env.AI_API_BASE_URL?.trim() || 'https://api.anthropic.com').replace(
    /\/+$/,
    '',
  )

  return {
    provider: inferProvider(baseUrl),
    baseUrl,
    apiKey,
    model: process.env.AI_MODEL?.trim() || 'claude-opus-5',
    maxTokens: Number(process.env.AI_MAX_TOKENS) || 4000,
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 120_000,
  }
}
