import { describe, expect, it } from 'vitest'
import {
  AccessDisabledError,
  ApiError,
  AuthenticationError,
  ConflictError,
  InvalidRequestError,
  NotFoundError,
  OneMaxError,
  RateLimitError,
  ServerError,
  TransportError,
} from '../src/index.js'
import type { FetchLike } from '../src/index.js'
import { clientFor, stub, thrownBy, usagePayload } from './support.js'

type ApiErrorClass = new (...args: never[]) => ApiError

function envelope(code: string, details: Record<string, unknown> = {}): unknown {
  return { error: { code, message: 'Xəta baş verdi', details, request_id: 'req-1' } }
}

const cases: [number, string, ApiErrorClass, string][] = [
  [400, 'offer_required', InvalidRequestError, 'InvalidRequestError'],
  [401, 'invalid_api_key', AuthenticationError, 'AuthenticationError'],
  [403, 'api_access_disabled', AccessDisabledError, 'AccessDisabledError'],
  [404, 'usage_not_found', NotFoundError, 'NotFoundError'],
  [409, 'reference_used', ConflictError, 'ConflictError'],
  [422, 'validation_error', InvalidRequestError, 'InvalidRequestError'],
  [429, 'rate_limited', RateLimitError, 'RateLimitError'],
  [500, 'internal_error', ServerError, 'ServerError'],
  [503, 'unavailable', ServerError, 'ServerError'],
  [418, 'teapot', ApiError, 'ApiError'],
]

describe('API errors', () => {
  it.each(cases)('raises the class for status %i', async (status, code, expected, name) => {
    const server = stub(status, envelope(code, { field: 'code' }))
    const error = await thrownBy(() => clientFor(server.fetch).usage('usage-1'))
    expect(error).toBeInstanceOf(expected)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toBeInstanceOf(OneMaxError)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(TransportError)
    const apiError = error as ApiError
    expect(apiError.constructor).toBe(expected)
    expect(apiError.name).toBe(name)
    expect(apiError.status).toBe(status)
    expect(apiError.code).toBe(code)
    expect(apiError.message).toBe('Xəta baş verdi')
    expect(apiError.details).toEqual({ field: 'code' })
    expect(apiError.requestId).toBe('req-1')
  })

  it('maps by status, not by code', async () => {
    const server = stub(409, envelope('a_new_code'))
    const error = await thrownBy(() => clientFor(server.fetch).confirmUsage('usage-1'))
    expect(error).toBeInstanceOf(ConflictError)
    expect((error as ConflictError).code).toBe('a_new_code')
  })

  it('exposes the retry delay on a rate limit', async () => {
    const server = stub(429, envelope('rate_limited', { retry_after: 17 }))
    const error = await thrownBy(() => clientFor(server.fetch).context())
    expect(error).toBeInstanceOf(RateLimitError)
    expect((error as RateLimitError).retryAfter).toBe(17)
    expect((error as RateLimitError).details).toEqual({ retry_after: 17 })
  })

  it('leaves the retry delay empty when the API gives none', async () => {
    const server = stub(429, envelope('rate_limited'))
    const error = await thrownBy(() => clientFor(server.fetch).context())
    expect((error as RateLimitError).retryAfter).toBeNull()
  })

  it('fills missing details and request id with defaults', async () => {
    const server = stub(404, { error: { code: 'usage_not_found', message: 'Tapılmadı' } })
    const error = await thrownBy(() => clientFor(server.fetch).usage('usage-1'))
    expect(error).toBeInstanceOf(NotFoundError)
    expect((error as NotFoundError).details).toEqual({})
    expect((error as NotFoundError).requestId).toBeNull()
  })

  it('raises by status when the error body is not JSON', async () => {
    const server = stub(502, '<html>Bad Gateway</html>')
    const error = await thrownBy(() => clientFor(server.fetch).context())
    expect(error).toBeInstanceOf(ServerError)
    const apiError = error as ServerError
    expect(apiError.status).toBe(502)
    expect(apiError.code).toBe('unknown_error')
    expect(apiError.message).toBe('<html>Bad Gateway</html>')
    expect(apiError.details).toEqual({})
    expect(apiError.requestId).toBeNull()
  })

  it('raises by status when the JSON is not the envelope', async () => {
    const server = stub(404, { detail: 'Not Found' })
    const error = await thrownBy(() => clientFor(server.fetch).context())
    expect(error).toBeInstanceOf(NotFoundError)
    expect((error as NotFoundError).code).toBe('unknown_error')
    expect((error as NotFoundError).message).toBe('{"detail":"Not Found"}')
  })

  it('cuts a long raw body to 200 characters', async () => {
    const server = stub(500, 'x'.repeat(500))
    const error = await thrownBy(() => clientFor(server.fetch).context())
    expect((error as ServerError).message).toBe('x'.repeat(200))
  })
})

describe('transport errors', () => {
  it('wraps a connection failure', async () => {
    const failure = new TypeError('fetch failed')
    const fetch: FetchLike = () => Promise.reject(failure)
    const error = await thrownBy(() => clientFor(fetch).context())
    expect(error).toBeInstanceOf(TransportError)
    expect(error).toBeInstanceOf(OneMaxError)
    expect(error).not.toBeInstanceOf(ApiError)
    expect((error as TransportError).name).toBe('TransportError')
    expect((error as TransportError).cause).toBe(failure)
    expect((error as TransportError).message).toContain('fetch failed')
  })

  it('wraps a timeout', async () => {
    const fetch: FetchLike = (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('This operation was aborted', 'AbortError'))
        })
      })
    const error = await thrownBy(() => clientFor(fetch, { timeoutMs: 20 }).context())
    expect(error).toBeInstanceOf(TransportError)
    expect((error as TransportError).message).toBe('Request timed out after 20 ms')
    expect((error as TransportError).cause).toBeInstanceOf(DOMException)
  })

  it('refuses a successful body that is not JSON', async () => {
    const server = stub(200, '<html>ok</html>')
    const error = await thrownBy(() => clientFor(server.fetch).context())
    expect(error).toBeInstanceOf(TransportError)
    expect((error as TransportError).cause).toBeInstanceOf(SyntaxError)
  })

  it('refuses a successful body with the wrong shape', async () => {
    const missing = stub(200, { usage_id: 'usage-1' })
    expect(await thrownBy(() => clientFor(missing.fetch).usage('usage-1'))).toBeInstanceOf(
      TransportError,
    )
    const badDate = stub(200, { ...usagePayload, created_at: 'yesterday' })
    expect(await thrownBy(() => clientFor(badDate.fetch).usage('usage-1'))).toBeInstanceOf(
      TransportError,
    )
    const list = stub(200, [])
    expect(await thrownBy(() => clientFor(list.fetch).context())).toBeInstanceOf(TransportError)
  })
})

describe('error names', () => {
  it('names the base class', () => {
    const error = new OneMaxError('x')
    expect(error.name).toBe('OneMaxError')
    expect(error.message).toBe('x')
    expect(error).toBeInstanceOf(Error)
  })
})
