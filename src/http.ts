import { apiErrorFor, TransportError } from './errors.js'
import type { ApiErrorFields } from './errors.js'
import { VERSION } from './version.js'

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>

export type HttpMethod = 'GET' | 'POST'

export type JsonBody = Record<string, string>

export interface TransportOptions {
  apiKey: string
  baseUrl: string
  timeoutMs: number
  fetch: FetchLike
}

const MESSAGE_LIMIT = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

function errorFields(status: number, text: string): ApiErrorFields {
  const fallback: ApiErrorFields = {
    status,
    code: 'unknown_error',
    message: text.slice(0, MESSAGE_LIMIT),
    details: {},
    requestId: null,
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return fallback
  }
  if (!isRecord(parsed) || !isRecord(parsed.error)) return fallback
  const { code, message, details, request_id: requestId } = parsed.error
  if (typeof code !== 'string') return fallback
  return {
    status,
    code,
    message: typeof message === 'string' ? message : '',
    details: isRecord(details) ? details : {},
    requestId: typeof requestId === 'string' ? requestId : null,
  }
}

export class Transport {
  readonly #apiKey: string
  readonly #baseUrl: string
  readonly #timeoutMs: number
  readonly #fetch: FetchLike

  constructor(options: TransportOptions) {
    this.#apiKey = options.apiKey
    this.#baseUrl = options.baseUrl
    this.#timeoutMs = options.timeoutMs
    this.#fetch = options.fetch
  }

  async request(method: HttpMethod, path: string, body?: JsonBody): Promise<unknown> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#apiKey}`,
      Accept: 'application/json',
      'User-Agent': `onemax-js/${VERSION}`,
    }
    const controller = new AbortController()
    const init: RequestInit = { method, headers, signal: controller.signal }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }
    const timer = setTimeout(() => {
      controller.abort()
    }, this.#timeoutMs)
    let status: number
    let text: string
    try {
      const response = await this.#fetch(`${this.#baseUrl}${path}`, init)
      status = response.status
      text = await response.text()
    } catch (cause) {
      if (controller.signal.aborted) {
        throw new TransportError(`Request timed out after ${this.#timeoutMs} ms`, { cause })
      }
      throw new TransportError(`Request failed: ${describe(cause)}`, { cause })
    } finally {
      clearTimeout(timer)
    }
    if (status < 200 || status >= 300) throw apiErrorFor(errorFields(status, text))
    try {
      return JSON.parse(text) as unknown
    } catch (cause) {
      throw new TransportError('Response body is not JSON', { cause })
    }
  }
}
