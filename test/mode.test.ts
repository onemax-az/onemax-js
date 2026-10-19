import { describe, expect, it } from 'vitest'

import { Mode, OneMax } from '../src/index.js'
import type { Context, LinkStatus, LinkToken, Usage } from '../src/index.js'
import { API_KEY, stub } from './support.js'

const BASE = 'https://api.test/v1'
const TEST_KEY = 'omx_test_abc'

function clientFor(apiKey: string, server = stub(200, {})): OneMax {
  return new OneMax({ apiKey, baseUrl: BASE, fetch: server.fetch })
}

describe('mode', () => {
  it('knows the mode of its key', () => {
    expect(clientFor(TEST_KEY).mode).toBe(Mode.Test)
    expect(clientFor(`  ${TEST_KEY}  `).mode).toBe(Mode.Test)
    expect(clientFor(API_KEY).mode).toBe(Mode.Live)
    expect(clientFor('omx_other_abc').mode).toBe(Mode.Live)
  })

  it('sends a test key as it is and reads the mode of the answer', async () => {
    const server = stub(200, {
      mode: 'test',
      active: true,
      usable: true,
      reason: 'ok',
      usage_id: 'usage-1',
      daily_limit: 1,
    })
    const verification = await clientFor(TEST_KEY, server).verifyCode('000001')
    expect(server.last().headers.get('authorization')).toBe(`Bearer ${TEST_KEY}`)
    expect(verification.mode).toBe(Mode.Test)
  })

  it('reads the mode on every result and keeps an unknown one', async () => {
    const answers: [(client: OneMax) => Promise<{ mode: string | null }>, object][] = [
      [
        (client): Promise<Context> => client.context(),
        { partner_name: 'Taksi', venue_id: 'v', venue_name: 'V', daily_limit: 1, offers: [] },
      ],
      [
        (client): Promise<Usage> => client.usage('usage-1'),
        { usage_id: 'usage-1', status: 'pending', created_at: '2026-10-19T10:00:00Z' },
      ],
      [
        (client): Promise<LinkToken> =>
          client.exchangeCode({ code: 'c', codeVerifier: 'v', redirectUri: 'https://a.example' }),
        { link_token: 'omx_link_test_x', active: true },
      ],
      [
        (client): Promise<LinkStatus> => client.linkStatus('omx_link_test_x'),
        { linked: true, active: false },
      ],
    ]
    for (const [call, body] of answers) {
      expect((await call(clientFor(API_KEY, stub(200, { ...body, mode: 'live' })))).mode).toBe(
        Mode.Live,
      )
      expect((await call(clientFor(API_KEY, stub(200, body)))).mode).toBeNull()
      expect((await call(clientFor(API_KEY, stub(200, { ...body, mode: 'staging' })))).mode).toBe(
        'staging',
      )
    }
  })
})
