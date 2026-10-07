import { OneMaxError } from './errors.js'
import { Transport } from './http.js'
import type { FetchLike, JsonBody } from './http.js'
import { toContext, toLinkStatus, toLinkToken, toUsage, toVerification } from './mapping.js'
import type { Context, LinkStatus, LinkToken, Locale, Usage, Verification } from './models.js'

export const DEFAULT_BASE_URL = 'https://api.onemax.az/v1'
export const DEFAULT_SITE_URL = 'https://onemax.az'
export const DEFAULT_TIMEOUT_MS = 10_000

const LOCALE_PREFIXES: Record<string, string> = { az: '', ru: '/ru', en: '/en' }

export interface OneMaxOptions {
  apiKey: string
  baseUrl?: string
  siteUrl?: string
  timeoutMs?: number
  fetch?: FetchLike
}

export interface VerifyOptions {
  offerId?: string
}

export interface ConfirmOptions {
  reference?: string
}

export interface ExchangeCodeParams {
  code: string
  codeVerifier: string
  redirectUri: string
}

export interface AuthorizeUrlParams {
  clientId: string
  redirectUri: string
  codeChallenge: string
  state?: string
  locale?: Locale
}

function withoutTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '')
}

function withOptional(body: JsonBody, key: string, value: string | undefined): JsonBody {
  return value === undefined ? body : { ...body, [key]: value }
}

function globalFetch(input: string, init: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init)
}

export class OneMax {
  readonly #transport: Transport
  readonly #siteUrl: string

  constructor(options: OneMaxOptions) {
    if (typeof options.apiKey !== 'string' || options.apiKey.trim() === '') {
      throw new OneMaxError('An API key is required')
    }
    this.#siteUrl = withoutTrailingSlash(options.siteUrl ?? DEFAULT_SITE_URL)
    this.#transport = new Transport({
      apiKey: options.apiKey,
      baseUrl: withoutTrailingSlash(options.baseUrl ?? DEFAULT_BASE_URL),
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      fetch: options.fetch ?? globalFetch,
    })
  }

  async context(): Promise<Context> {
    return toContext(await this.#transport.request('GET', '/integration/context'))
  }

  async verifyCode(code: string, options: VerifyOptions = {}): Promise<Verification> {
    const body = withOptional({ code }, 'offer_id', options.offerId)
    return toVerification(
      await this.#transport.request('POST', '/integration/members/verify', body),
    )
  }

  async usage(usageId: string): Promise<Usage> {
    return toUsage(await this.#transport.request('GET', usagePath(usageId)))
  }

  async confirmUsage(usageId: string, options: ConfirmOptions = {}): Promise<Usage> {
    const body = withOptional({}, 'reference', options.reference)
    return toUsage(await this.#transport.request('POST', `${usagePath(usageId)}/confirm`, body))
  }

  async voidUsage(usageId: string): Promise<Usage> {
    return toUsage(await this.#transport.request('POST', `${usagePath(usageId)}/void`))
  }

  async exchangeCode(params: ExchangeCodeParams): Promise<LinkToken> {
    const body = {
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: params.redirectUri,
    }
    return toLinkToken(await this.#transport.request('POST', '/integration/links/token', body))
  }

  async linkStatus(linkToken: string): Promise<LinkStatus> {
    const body = { link_token: linkToken }
    return toLinkStatus(await this.#transport.request('POST', '/integration/links/status', body))
  }

  async verifyLink(linkToken: string, options: VerifyOptions = {}): Promise<Verification> {
    const body = withOptional({ link_token: linkToken }, 'offer_id', options.offerId)
    return toVerification(await this.#transport.request('POST', '/integration/links/verify', body))
  }

  async revokeLink(linkToken: string): Promise<void> {
    await this.#transport.request('POST', '/integration/links/revoke', { link_token: linkToken })
  }

  authorizeUrl(params: AuthorizeUrlParams): string {
    const locale: string = params.locale ?? 'az'
    const prefix = Object.hasOwn(LOCALE_PREFIXES, locale) ? LOCALE_PREFIXES[locale] : undefined
    if (prefix === undefined) {
      throw new OneMaxError(`Unsupported locale: ${locale}`)
    }
    const query: [string, string][] = [
      ['response_type', 'code'],
      ['client_id', params.clientId],
      ['redirect_uri', params.redirectUri],
      ['code_challenge', params.codeChallenge],
      ['code_challenge_method', 'S256'],
    ]
    if (params.state !== undefined) query.push(['state', params.state])
    const encoded = query.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')
    return `${this.#siteUrl}${prefix}/baglanti?${encoded}`
  }
}

function usagePath(usageId: string): string {
  return `/integration/usages/${encodeURIComponent(usageId)}`
}
