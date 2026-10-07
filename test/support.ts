import { OneMax } from '../src/index.js'
import type { FetchLike, OneMaxOptions } from '../src/index.js'

export const API_KEY = 'omx_live_test'

export interface RecordedRequest {
  url: string
  method: string
  headers: Headers
  body: string | null
}

export interface Stub {
  fetch: FetchLike
  requests: RecordedRequest[]
  last: () => RecordedRequest
}

function record(input: string, init: RequestInit): RecordedRequest {
  return {
    url: input,
    method: init.method ?? 'GET',
    headers: new Headers(init.headers),
    body: typeof init.body === 'string' ? init.body : null,
  }
}

export function stub(status: number, body: unknown): Stub {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  const requests: RecordedRequest[] = []
  const fetch: FetchLike = (input, init) => {
    requests.push(record(input, init))
    return Promise.resolve(new Response(text, { status }))
  }
  const last = (): RecordedRequest => {
    const request = requests.at(-1)
    if (request === undefined) throw new Error('No request was made')
    return request
  }
  return { fetch, requests, last }
}

export function clientFor(fetch: FetchLike, options: Partial<OneMaxOptions> = {}): OneMax {
  return new OneMax({ apiKey: API_KEY, fetch, ...options })
}

export function jsonBody(request: RecordedRequest): unknown {
  if (request.body === null) throw new Error('The request has no body')
  return JSON.parse(request.body)
}

export async function thrownBy(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action()
  } catch (error) {
    return error
  }
  throw new Error('Nothing was thrown')
}

export const usagePayload = {
  usage_id: 'usage-1',
  status: 'pending',
  reference: null,
  created_at: '2026-10-07T17:16:11.906636Z',
  confirmed_at: null,
  voided_at: null,
}

export const verificationPayload = {
  active: true,
  usable: true,
  reason: 'ok',
  usage_id: 'usage-1',
  daily_limit: 2,
}
