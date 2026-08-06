/**
 * Central AI configuration. Everything the app needs to talk to a model lives
 * in three environment variables, so switching between Claude, GPT, or any
 * OpenAI-compatible gateway is a config change and never a code change:
 *
 *   AI_API_BASE_URL   https://api.anthropic.com   |  https://api.openai.com/v1
 *   AI_API_KEY        sk-ant-...                  |  sk-...
 *   AI_MODEL          claude-opus-5               |  gpt-4o
 *
 * AI_PROVIDER ("anthropic" | "openai") is optional — the wire format is
 * inferred from the base URL when it is not set explicitly. Set it when you
 * point at a proxy whose hostname doesn't reveal the dialect it speaks.
 */

export type ProviderKind = 'anthropic' | 'openai'

export interface AiConfig {
  baseUrl: string
  apiKey: string
  model: string
  provider: ProviderKind
  /** Upper bound on tokens per analysis response. */
  maxTokens: number
  /** Per-request timeout in milliseconds. */
  timeoutMs: number
}

export class AiConfigError extends Error {}

function inferProvider(baseUrl: string): ProviderKind {
  const host = baseUrl.toLowerCase()
  if (host.includes('anthropic') || host.includes('claude')) return 'anthropic'
  return 'openai'
}

let warned = false

export function getAiConfig(): AiConfig {
  const baseUrl = (process.env.AI_API_BASE_URL || '').trim().replace(/\/+$/, '')
  const apiKey = (process.env.AI_API_KEY || '').trim()
  const model = (process.env.AI_MODEL || '').trim()

  const missing = [
    !baseUrl && 'AI_API_BASE_URL',
    !apiKey && 'AI_API_KEY',
    !model && 'AI_MODEL',
  ].filter(Boolean)

  if (missing.length) {
    throw new AiConfigError(
      `Missing AI configuration: ${missing.join(', ')}. ` +
        'Copy .env.example to .env.local and fill in your provider details.',
    )
  }

  const explicit = (process.env.AI_PROVIDER || '').trim().toLowerCase()
  let provider: ProviderKind
  if (explicit === 'anthropic' || explicit === 'openai') {
    provider = explicit
  } else {
    if (explicit && !warned) {
      warned = true
      console.warn(
        `[ai] Unknown AI_PROVIDER "${explicit}" — falling back to URL inference.`,
      )
    }
    provider = inferProvider(baseUrl)
  }

  return {
    baseUrl,
    apiKey,
    model,
    provider,
    maxTokens: Number(process.env.AI_MAX_TOKENS || 8000),
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 180_000),
  }
}

/** True when the server has enough config to run an analysis. */
export function isAiConfigured(): boolean {
  try {
    getAiConfig()
    return true
  } catch {
    return false
  }
}

/** Safe-to-display summary — never includes the key itself. */
export function describeAiConfig(): {
  configured: boolean
  provider?: ProviderKind
  model?: string
  baseUrl?: string
  error?: string
} {
  try {
    const c = getAiConfig()
    return {
      configured: true,
      provider: c.provider,
      model: c.model,
      baseUrl: c.baseUrl,
    }
  } catch (err) {
    return { configured: false, error: (err as Error).message }
  }
}
