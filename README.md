# onemax

OneMax is a 1+1 membership club for venues in Baku. Members pay for a plan and show a code at the
counter to get the offer. This library lets a partner's own system, such as a till, an ordering
site or a booking app, check a member and record a usage through the OneMax partner API.

## Install

```bash
npm install onemax
```

The package is ESM only and has no runtime dependencies. It needs Node.js 18 or newer, and also
runs in Deno, Bun and edge runtimes, because it uses only `fetch` and Web Crypto.

## Getting a key

1. OneMax switches API access on for the partner.
2. The owner creates a key in the partner panel under API. Keys start with `omx_live_`.
3. A key belongs to one venue. Every call made with it acts for that venue.
4. Keep the key on the server. Never ship it in a browser bundle or a mobile app.

```ts
import { OneMax } from 'onemax'

const onemax = new OneMax({ apiKey: process.env.ONEMAX_API_KEY ?? '' })
```

| Option      | Default                    | Meaning                                       |
| ----------- | -------------------------- | --------------------------------------------- |
| `apiKey`    | required                   | The partner API key. An empty key throws.     |
| `baseUrl`   | `https://api.onemax.az/v1` | The API address.                              |
| `siteUrl`   | `https://onemax.az`        | The member site, used only by `authorizeUrl`. |
| `timeoutMs` | `10000`                    | How long one request may take.                |
| `fetch`     | the global `fetch`         | A replacement `fetch`, for tests or a proxy.  |

`context()` returns the venue the key belongs to, the member's daily limit there and the offers:

```ts
const context = await onemax.context()

console.log(context.partnerName, context.venueName, context.dailyLimit)
for (const offer of context.offers) {
  console.log(offer.id, offer.headline, offer.title, offer.openNow)
}
```

## Quick start: a code

The member reads the six digit code from their OneMax card, or the partner scans the QR text.
`verifyCode` answers yes or no. On yes it also opens a pending usage. The usage counts only once
it is confirmed.

```ts
const verification = await onemax.verifyCode('482913', { offerId: 'offer-id' })

if (verification.usable && verification.usageId) {
  const order = await createOrder()
  const usage = await onemax.confirmUsage(verification.usageId, { reference: order.id })
  console.log(usage.status, usage.confirmedAt)
} else {
  console.log('Not usable:', verification.reason)
}
```

`offerId` is optional when the venue has a single offer. Pass your own order id as `reference`.
Confirming again with the same reference is safe and returns the same usage, so a confirm that
failed on the network can be sent again.

If the order falls through, void the usage so it does not count against the member:

```ts
await onemax.voidUsage(verification.usageId)
```

`usage(usageId)` reads a usage back at any time.

## Account linking

A member can link their OneMax account to the partner's app once. After that the partner checks
the member with a stored token and nobody has to type a code.

Step 1. Create a PKCE pair, keep the verifier and the state in the member's session, and send the
member to the permission page.

```ts
import { OneMax, generatePkce } from 'onemax'

const { verifier, challenge } = await generatePkce()
const state = crypto.randomUUID()
session.onemax = { verifier, state }

const address = onemax.authorizeUrl({
  clientId: 'omx_client_your_id',
  redirectUri: 'https://partner.example/onemax/callback',
  codeChallenge: challenge,
  state,
  locale: 'en',
})
response.redirect(address)
```

`locale` is `az`, `ru` or `en` and picks the language of the permission page. Any other value
throws. `challengeFor(verifier)` derives the challenge from a verifier you already hold.

Step 2. The member allows and comes back to the `redirectUri` with `code` and `state`, or with
`error=access_denied` if they refused. Compare the state, then exchange the code on the server
with the same redirect address.

```ts
const query = new URL(request.url).searchParams

if (query.get('error') === 'access_denied') {
  return showLinkingRefused()
}
if (query.get('state') === session.onemax.state) {
  const link = await onemax.exchangeCode({
    code: query.get('code') ?? '',
    codeVerifier: session.onemax.verifier,
    redirectUri: 'https://partner.example/onemax/callback',
  })
  await saveLinkToken(user.id, link.linkToken)
}
```

Link tokens start with `omx_link_`. Store the token with the user's record, on the server.

Step 3. Later, check the member with the token.

```ts
const status = await onemax.linkStatus(linkToken)
console.log(status.linked, status.active)

const verification = await onemax.verifyLink(linkToken, { offerId: 'offer-id' })
if (verification.usable && verification.usageId) {
  await onemax.confirmUsage(verification.usageId, { reference: order.id })
}
```

`linkStatus` only answers yes or no. `verifyLink` answers yes or no and opens a pending usage,
exactly like `verifyCode`. A token whose link the member removed is not an error: `linkStatus`
answers `linked: false` and `verifyLink` answers `reason: 'not_linked'`.

`revokeLink(linkToken)` removes the link from the partner's side.

The partner never learns the member's name, email, phone or photo.

## Results

`verifyCode` and `verifyLink` return a `Verification`:

| Field        | Type             | Meaning                                                          |
| ------------ | ---------------- | ---------------------------------------------------------------- |
| `active`     | `boolean`        | The member has a subscription that works today.                  |
| `usable`     | `boolean`        | The member may use the offer right now.                          |
| `reason`     | `Reason`         | Why the answer is yes or no. See the table below.                |
| `usageId`    | `string \| null` | The pending usage to confirm or void. Set when `usable` is true. |
| `dailyLimit` | `number`         | How many usages a day the member has at this venue.              |

| Reason              | Constant                  | Meaning                                          |
| ------------------- | ------------------------- | ------------------------------------------------ |
| `ok`                | `Reason.Ok`               | The member may use the offer.                    |
| `not_subscribed`    | `Reason.NotSubscribed`    | The member has no working subscription.          |
| `limit_reached`     | `Reason.LimitReached`     | The member has used today's limit at this venue. |
| `offer_unavailable` | `Reason.OfferUnavailable` | The offer is not open right now.                 |
| `invalid_code`      | `Reason.InvalidCode`      | The code is wrong or has expired.                |
| `not_linked`        | `Reason.NotLinked`        | The link behind the token was removed.           |

A reason this version does not know is kept as the raw string, so compare against the constants
and treat anything else as not usable.

A `Usage` has `usageId`, `status` (`pending`, `confirmed` or `voided`, also available as
`UsageStatus.Pending` and so on), `reference`, `createdAt`, `confirmedAt` and `voidedAt`. The
dates are `Date` objects, or `null` when the step has not happened.

## Errors

Everything the library throws extends `OneMaxError`.

| Class                 | When                                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `TransportError`      | Connection failure, timeout, or an answer that is not the expected JSON                                                   |
| `ApiError`            | The API answered with an error. Base of the classes below                                                                 |
| `AuthenticationError` | 401, code `invalid_api_key`                                                                                               |
| `AccessDisabledError` | 403, code `api_access_disabled`                                                                                           |
| `NotFoundError`       | 404, code `usage_not_found`                                                                                               |
| `ConflictError`       | 409, codes `usage_limit_reached`, `too_late`, `not_applicable`, `already_applied`, `reference_used`, `reference_mismatch` |
| `InvalidRequestError` | 400 and 422, codes `offer_required`, `unknown_offer`, `link_code_invalid`, `validation_error`                             |
| `RateLimitError`      | 429, code `rate_limited`. Has `retryAfter` in seconds, or `null`                                                          |
| `ServerError`         | 500 and above                                                                                                             |

An `ApiError` carries `status`, `code`, `message`, `details` and `requestId`. The class is chosen
by the HTTP status, so a new code on a known status still throws the right class. `message` is
Azerbaijani and meant for logs. Decide behaviour from the class and the `code`. A
`TransportError` keeps the underlying failure in `cause`.

```ts
import { ConflictError, OneMaxError, RateLimitError, TransportError } from 'onemax'

try {
  await onemax.confirmUsage(usageId, { reference: order.id })
} catch (error) {
  if (error instanceof ConflictError && error.code === 'too_late') {
    await cancelDiscount(order)
  } else if (error instanceof RateLimitError) {
    await retryLater(order, error.retryAfter ?? 60)
  } else if (error instanceof TransportError) {
    await retryLater(order, 5)
  } else if (error instanceof OneMaxError) {
    log.error(error.name, error.message)
    throw error
  } else {
    throw error
  }
}
```

## Limits

- The member's daily limit applies exactly as it does at a counter. A usage confirmed through the
  API counts the same as one applied by a cashier.
- Each key may make 120 requests a minute. Past that the API answers 429 and the library throws
  `RateLimitError`.
- The library never retries on its own. `confirmUsage` with a `reference` is safe to send again,
  because the same reference always returns the same usage.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run build
npm test
```

The tests use a fake `fetch` and never touch the network. `npm run format` rewrites files with
Prettier.

## Releasing

Set the version in `package.json` and `src/version.ts`, add a `## x.y.z` section to `CHANGELOG.md`, commit, then push a tag
`vx.y.z`. The `Publish` workflow checks that the tag equals the package version, runs the checks,
publishes to npm and creates the GitHub release from the changelog section. A tag that does not match the
version publishes nothing.

## License

MIT. See [LICENSE](LICENSE).
