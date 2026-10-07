import { describe, expect, it } from 'vitest'
import { Locale, OneMax, OneMaxError } from '../src/index.js'
import { API_KEY } from './support.js'

const params = {
  clientId: 'omx_client_abc',
  redirectUri: 'https://partner.example/callback?shop=1&lang=az',
  codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
}

function client(siteUrl?: string): OneMax {
  return new OneMax(siteUrl === undefined ? { apiKey: API_KEY } : { apiKey: API_KEY, siteUrl })
}

describe('authorizeUrl', () => {
  it('builds the Azerbaijani address without a prefix', () => {
    const url = new URL(client().authorizeUrl({ ...params, state: 'xyz' }))
    expect(url.origin).toBe('https://onemax.az')
    expect(url.pathname).toBe('/baglanti')
    expect([...url.searchParams.entries()]).toEqual([
      ['response_type', 'code'],
      ['client_id', params.clientId],
      ['redirect_uri', params.redirectUri],
      ['code_challenge', params.codeChallenge],
      ['code_challenge_method', 'S256'],
      ['state', 'xyz'],
    ])
  })

  it('treats the az locale like no locale', () => {
    expect(client().authorizeUrl({ ...params, locale: Locale.Az })).toBe(
      client().authorizeUrl(params),
    )
  })

  it('prefixes the path for ru and en', () => {
    expect(new URL(client().authorizeUrl({ ...params, locale: 'ru' })).pathname).toBe(
      '/ru/baglanti',
    )
    expect(new URL(client().authorizeUrl({ ...params, locale: 'en' })).pathname).toBe(
      '/en/baglanti',
    )
  })

  it('encodes the redirect address', () => {
    const address = client().authorizeUrl(params)
    expect(address).toContain(
      'redirect_uri=https%3A%2F%2Fpartner.example%2Fcallback%3Fshop%3D1%26lang%3Daz',
    )
    expect(new URL(address).searchParams.get('redirect_uri')).toBe(params.redirectUri)
  })

  it('encodes a state with spaces and symbols', () => {
    const url = new URL(client().authorizeUrl({ ...params, state: 'a b&c=d' }))
    expect(url.searchParams.get('state')).toBe('a b&c=d')
  })

  it('leaves the state out when not given', () => {
    const url = new URL(client().authorizeUrl(params))
    expect(url.searchParams.has('state')).toBe(false)
    expect([...url.searchParams.keys()].at(-1)).toBe('code_challenge_method')
  })

  it('refuses an unknown locale', () => {
    expect(() => client().authorizeUrl({ ...params, locale: 'de' as Locale })).toThrow(OneMaxError)
    expect(() => client().authorizeUrl({ ...params, locale: 'toString' as Locale })).toThrow(
      OneMaxError,
    )
  })

  it('uses a custom site address without doubling the slash', () => {
    const address = client('https://staging.onemax.az/').authorizeUrl({ ...params, locale: 'en' })
    expect(address.startsWith('https://staging.onemax.az/en/baglanti?')).toBe(true)
  })
})
