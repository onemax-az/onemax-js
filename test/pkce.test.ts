import { afterEach, describe, expect, it, vi } from 'vitest'
import { challengeFor, generatePkce } from '../src/index.js'

const URL_SAFE = /^[A-Za-z0-9_-]{43}$/
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('challengeFor', () => {
  it('matches the RFC 7636 vector', async () => {
    expect(await challengeFor(RFC_VERIFIER)).toBe(RFC_CHALLENGE)
  })

  it('works on a runtime without a global crypto', async () => {
    vi.stubGlobal('crypto', undefined)
    expect(globalThis.crypto).toBeUndefined()
    expect(await challengeFor(RFC_VERIFIER)).toBe(RFC_CHALLENGE)
    const pair = await generatePkce()
    expect(pair.verifier).toMatch(URL_SAFE)
    expect(pair.challenge).toBe(await challengeFor(pair.verifier))
  })
})

describe('generatePkce', () => {
  it('returns a 43 character verifier and its challenge', async () => {
    const pair = await generatePkce()
    expect(pair.verifier).toMatch(URL_SAFE)
    expect(pair.challenge).toMatch(URL_SAFE)
    expect(pair.challenge).toBe(await challengeFor(pair.verifier))
  })

  it('returns a new pair on every call', async () => {
    const first = await generatePkce()
    const second = await generatePkce()
    expect(first.verifier).not.toBe(second.verifier)
    expect(first.challenge).not.toBe(second.challenge)
  })
})
