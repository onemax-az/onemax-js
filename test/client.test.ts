import { describe, expect, it } from 'vitest'
import { OneMax, OneMaxError, Reason, UsageStatus, VERSION } from '../src/index.js'
import packageJson from '../package.json' with { type: 'json' }
import { API_KEY, clientFor, jsonBody, stub, usagePayload, verificationPayload } from './support.js'

const BASE = 'https://api.onemax.az/v1'

describe('construction', () => {
  it('refuses an empty API key', () => {
    expect(() => new OneMax({ apiKey: '' })).toThrow(OneMaxError)
    expect(() => new OneMax({ apiKey: '   ' })).toThrow(OneMaxError)
  })

  it('reports the package version', () => {
    expect(VERSION).toBe(packageJson.version)
  })

  it('strips a trailing slash from the base URL', async () => {
    const server = stub(200, usagePayload)
    await clientFor(server.fetch, { baseUrl: 'https://example.test/v1/' }).usage('usage-1')
    expect(server.last().url).toBe('https://example.test/v1/integration/usages/usage-1')
  })

  it('uses the global fetch when none is injected', async () => {
    const server = stub(200, usagePayload)
    const original = globalThis.fetch
    const replacement: typeof globalThis.fetch = (input, init) =>
      server.fetch(input instanceof Request ? input.url : input.toString(), init ?? {})
    globalThis.fetch = replacement
    try {
      await new OneMax({ apiKey: API_KEY }).usage('usage-1')
    } finally {
      globalThis.fetch = original
    }
    expect(server.last().url).toBe(`${BASE}/integration/usages/usage-1`)
  })
})

describe('headers', () => {
  it('sends the key, the accepted type and the user agent', async () => {
    const server = stub(200, usagePayload)
    await clientFor(server.fetch).usage('usage-1')
    const { headers } = server.last()
    expect(headers.get('Authorization')).toBe(`Bearer ${API_KEY}`)
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.get('User-Agent')).toBe(`onemax-js/${VERSION}`)
    expect(headers.has('Content-Type')).toBe(false)
  })

  it('sends a JSON content type with a body', async () => {
    const server = stub(200, verificationPayload)
    await clientFor(server.fetch).verifyCode('123456')
    expect(server.last().headers.get('Content-Type')).toBe('application/json')
  })
})

describe('context', () => {
  it('reads the venue and its offers', async () => {
    const server = stub(200, {
      partner_name: 'Kafe Araz',
      venue_id: 'venue-1',
      venue_name: 'Araz Nizami',
      daily_limit: 2,
      offers: [{ id: 'offer-1', headline: '1+1', title: 'Kofe', open_now: true, extra: 1 }],
      unknown_field: 'ignored',
    })
    const context = await clientFor(server.fetch).context()
    expect(server.last().method).toBe('GET')
    expect(server.last().url).toBe(`${BASE}/integration/context`)
    expect(server.last().body).toBeNull()
    expect(context).toEqual({
      partnerName: 'Kafe Araz',
      venueId: 'venue-1',
      venueName: 'Araz Nizami',
      dailyLimit: 2,
      offers: [{ id: 'offer-1', headline: '1+1', title: 'Kofe', openNow: true }],
    })
  })
})

describe('verifyCode', () => {
  it('posts the code and the offer', async () => {
    const server = stub(200, verificationPayload)
    const verification = await clientFor(server.fetch).verifyCode('123456', { offerId: 'offer-1' })
    expect(server.last().method).toBe('POST')
    expect(server.last().url).toBe(`${BASE}/integration/members/verify`)
    expect(jsonBody(server.last())).toEqual({ code: '123456', offer_id: 'offer-1' })
    expect(verification).toEqual({
      active: true,
      usable: true,
      reason: Reason.Ok,
      usageId: 'usage-1',
      dailyLimit: 2,
    })
  })

  it('leaves the offer out when not given', async () => {
    const server = stub(200, verificationPayload)
    await clientFor(server.fetch).verifyCode('123456')
    expect(jsonBody(server.last())).toEqual({ code: '123456' })
  })

  it('reads a refusal with no usage', async () => {
    const server = stub(200, {
      active: true,
      usable: false,
      reason: 'limit_reached',
      usage_id: null,
      daily_limit: 1,
    })
    const verification = await clientFor(server.fetch).verifyCode('123456')
    expect(verification.usable).toBe(false)
    expect(verification.reason).toBe(Reason.LimitReached)
    expect(verification.usageId).toBeNull()
  })

  it('keeps an unknown reason', async () => {
    const server = stub(200, { ...verificationPayload, usable: false, reason: 'paused' })
    const verification = await clientFor(server.fetch).verifyCode('123456')
    expect(verification.reason).toBe('paused')
  })
})

describe('usage', () => {
  it('reads a pending usage with empty dates', async () => {
    const server = stub(200, usagePayload)
    const usage = await clientFor(server.fetch).usage('usage-1')
    expect(server.last().method).toBe('GET')
    expect(server.last().url).toBe(`${BASE}/integration/usages/usage-1`)
    expect(server.last().body).toBeNull()
    expect(usage.usageId).toBe('usage-1')
    expect(usage.status).toBe(UsageStatus.Pending)
    expect(usage.reference).toBeNull()
    expect(usage.createdAt).toBeInstanceOf(Date)
    expect(usage.createdAt.toISOString()).toBe('2026-10-07T17:16:11.906Z')
    expect(usage.confirmedAt).toBeNull()
    expect(usage.voidedAt).toBeNull()
  })

  it('reads a datetime with an offset', async () => {
    const server = stub(200, { ...usagePayload, created_at: '2026-10-07T21:16:11+04:00' })
    const usage = await clientFor(server.fetch).usage('usage-1')
    expect(usage.createdAt.toISOString()).toBe('2026-10-07T17:16:11.000Z')
  })

  it('encodes the usage id in the path', async () => {
    const server = stub(200, usagePayload)
    await clientFor(server.fetch).usage('a/b c?d')
    expect(server.last().url).toBe(`${BASE}/integration/usages/a%2Fb%20c%3Fd`)
  })

  it('keeps an unknown status', async () => {
    const server = stub(200, { ...usagePayload, status: 'expired' })
    const usage = await clientFor(server.fetch).usage('usage-1')
    expect(usage.status).toBe('expired')
  })
})

describe('confirmUsage', () => {
  it('posts the reference and reads the confirmed usage', async () => {
    const server = stub(200, {
      ...usagePayload,
      status: 'confirmed',
      reference: 'order-42',
      confirmed_at: '2026-10-07T17:20:00Z',
    })
    const usage = await clientFor(server.fetch).confirmUsage('usage-1', { reference: 'order-42' })
    expect(server.last().method).toBe('POST')
    expect(server.last().url).toBe(`${BASE}/integration/usages/usage-1/confirm`)
    expect(jsonBody(server.last())).toEqual({ reference: 'order-42' })
    expect(usage.status).toBe(UsageStatus.Confirmed)
    expect(usage.reference).toBe('order-42')
    expect(usage.confirmedAt?.toISOString()).toBe('2026-10-07T17:20:00.000Z')
    expect(usage.voidedAt).toBeNull()
  })

  it('sends an empty object without a reference', async () => {
    const server = stub(200, usagePayload)
    await clientFor(server.fetch).confirmUsage('usage-1')
    expect(server.last().body).toBe('{}')
    expect(server.last().headers.get('Content-Type')).toBe('application/json')
  })

  it('encodes the usage id in the path', async () => {
    const server = stub(200, usagePayload)
    await clientFor(server.fetch).confirmUsage('a/b')
    expect(server.last().url).toBe(`${BASE}/integration/usages/a%2Fb/confirm`)
  })
})

describe('voidUsage', () => {
  it('posts without a body and reads the voided usage', async () => {
    const server = stub(200, {
      ...usagePayload,
      status: 'voided',
      voided_at: '2026-10-07T17:25:00Z',
    })
    const usage = await clientFor(server.fetch).voidUsage('a/b')
    expect(server.last().method).toBe('POST')
    expect(server.last().url).toBe(`${BASE}/integration/usages/a%2Fb/void`)
    expect(server.last().body).toBeNull()
    expect(server.last().headers.has('Content-Type')).toBe(false)
    expect(usage.status).toBe(UsageStatus.Voided)
    expect(usage.voidedAt?.toISOString()).toBe('2026-10-07T17:25:00.000Z')
  })
})

describe('exchangeCode', () => {
  it('posts the code, the verifier and the redirect address', async () => {
    const server = stub(200, { link_token: 'omx_link_abc', active: true })
    const token = await clientFor(server.fetch).exchangeCode({
      code: 'code-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'https://partner.example/callback',
    })
    expect(server.last().method).toBe('POST')
    expect(server.last().url).toBe(`${BASE}/integration/links/token`)
    expect(jsonBody(server.last())).toEqual({
      code: 'code-1',
      code_verifier: 'verifier-1',
      redirect_uri: 'https://partner.example/callback',
    })
    expect(token).toEqual({ linkToken: 'omx_link_abc', active: true })
  })
})

describe('linkStatus', () => {
  it('posts the token and reads the answer', async () => {
    const server = stub(200, { linked: false, active: false })
    const status = await clientFor(server.fetch).linkStatus('omx_link_abc')
    expect(server.last().method).toBe('POST')
    expect(server.last().url).toBe(`${BASE}/integration/links/status`)
    expect(jsonBody(server.last())).toEqual({ link_token: 'omx_link_abc' })
    expect(status).toEqual({ linked: false, active: false })
  })
})

describe('verifyLink', () => {
  it('posts the token and the offer', async () => {
    const server = stub(200, verificationPayload)
    const verification = await clientFor(server.fetch).verifyLink('omx_link_abc', {
      offerId: 'offer-1',
    })
    expect(server.last().method).toBe('POST')
    expect(server.last().url).toBe(`${BASE}/integration/links/verify`)
    expect(jsonBody(server.last())).toEqual({ link_token: 'omx_link_abc', offer_id: 'offer-1' })
    expect(verification.usageId).toBe('usage-1')
  })

  it('leaves the offer out and reads a removed link', async () => {
    const server = stub(200, {
      active: false,
      usable: false,
      reason: 'not_linked',
      usage_id: null,
      daily_limit: 0,
    })
    const verification = await clientFor(server.fetch).verifyLink('omx_link_abc')
    expect(jsonBody(server.last())).toEqual({ link_token: 'omx_link_abc' })
    expect(verification.reason).toBe(Reason.NotLinked)
    expect(verification.usageId).toBeNull()
  })
})

describe('revokeLink', () => {
  it('posts the token and returns nothing', async () => {
    const server = stub(200, { ok: true })
    await expect(clientFor(server.fetch).revokeLink('omx_link_abc')).resolves.toBeUndefined()
    expect(server.last().method).toBe('POST')
    expect(server.last().url).toBe(`${BASE}/integration/links/revoke`)
    expect(jsonBody(server.last())).toEqual({ link_token: 'omx_link_abc' })
  })
})
