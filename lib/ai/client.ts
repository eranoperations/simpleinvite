import { getAiConfig, type AiConfig } from './config'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CompleteOptions {
  system?: string
  maxTokens?: number
  temperature?: number
  signal?: AbortSignal
}

export class AiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message)
  }
}

/** Transport failures, rate limits and 5xx are worth another attempt; 4xx is not. */
function isRetryable(err: unknown): boolean {
  if (err instanceof AiRequestError) {
    if (err.status === undefined) return true
    return err.status === 408 || err.status === 429 || err.status >= 500
  }
  return err instanceof TypeError
}

function endpoint(cfg: AiConfig): string {
  if (cfg.provider === 'anthropic') return `${cfg.baseUrl}/v1/messages`
  // OpenAI-compatible base URLs conventionally already carry the /v1 segment.
  return /\/v\d+$/.test(cfg.baseUrl)
    ? `${cfg.baseUrl}/chat/completions`
    : `${cfg.baseUrl}/v1/chat/completions`
}

function headers(cfg: AiConfig): Record<string, string> {
  if (cfg.provider === 'anthropic') {
    return {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01',
    }
  }
  return { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` }
}

function requestBody(cfg: AiConfig, messages: ChatMessage[], opts: CompleteOptions): unknown {
  const maxTokens = opts.maxTokens ?? cfg.maxTokens

  if (cfg.provider === 'anthropic') {
    return {
      model: cfg.model,
      max_tokens: maxTokens,
      ...(opts.system ? { system: opts.system } : {}),
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      messages,
    }
  }

  return {
    model: cfg.model,
    max_completion_tokens: maxTokens,
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    messages: [
      ...(opts.system ? [{ role: 'system' as const, content: opts.system }] : []),
      ...messages,
    ],
  }
}

function extractText(cfg: AiConfig, payload: unknown): string {
  const data = payload as Record<string, unknown>
  if (cfg.provider === 'anthropic') {
    const blocks = data?.content
    if (!Array.isArray(blocks)) return ''
    return blocks
      .filter((b) => b?.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('')
  }
  const choices = data?.choices as { message?: { content?: string } }[] | undefined
  return choices?.[0]?.message?.content ?? ''
}

export async function complete(
  messages: ChatMessage[],
  opts: CompleteOptions = {},
): Promise<string> {
  const cfg = getAiConfig()
  const url = endpoint(cfg)
  const maxAttempts = 3
  let lastErr: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const timeout = new AbortController()
    const timer = setTimeout(() => timeout.abort(), cfg.timeoutMs)
    // Caller cancellation and our own timeout both need to abort the fetch.
    const onAbort = () => timeout.abort()
    opts.signal?.addEventListener('abort', onAbort)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: headers(cfg),
        body: JSON.stringify(requestBody(cfg, messages, opts)),
        signal: timeout.signal,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new AiRequestError(
          `${cfg.provider} request failed (${res.status})`,
          res.status,
          text.slice(0, 400),
        )
      }

      const text = extractText(cfg, await res.json())
      if (!text.trim()) throw new AiRequestError('Model returned an empty response')
      return text
    } catch (err) {
      lastErr = err
      if (opts.signal?.aborted) throw new AiRequestError('Cancelled')
      if (attempt === maxAttempts || !isRetryable(err)) throw err
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)))
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onAbort)
    }
  }

  throw lastErr instanceof Error ? lastErr : new AiRequestError('AI call failed')
}

/**
 * Models wrap JSON in prose or fences more often than not, so pull the first
 * balanced JSON value out of the response rather than trusting the whole body.
 */
export function parseJsonResponse<T>(raw: string): T {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = [fenced?.[1], raw].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const trimmed = candidate.trim()
    try {
      return JSON.parse(trimmed) as T
    } catch {
      // fall through to balance-scanning
    }

    for (const open of ['{', '[']) {
      const start = trimmed.indexOf(open)
      if (start === -1) continue
      const close = open === '{' ? '}' : ']'
      let depth = 0
      let inString = false
      let escaped = false

      for (let i = start; i < trimmed.length; i++) {
        const ch = trimmed[i]
        if (escaped) {
          escaped = false
          continue
        }
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === '"') inString = !inString
        if (inString) continue
        if (ch === open) depth++
        else if (ch === close) {
          depth--
          if (depth === 0) {
            try {
              return JSON.parse(trimmed.slice(start, i + 1)) as T
            } catch {
              break
            }
          }
        }
      }
    }
  }

  throw new AiRequestError(`Could not parse JSON from model response: ${raw.slice(0, 300)}`)
}
