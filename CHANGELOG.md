# Changelog

## 0.2.0

- Test mode. A key that starts with `omx_test_` works against OneMax test members on the same
  address, so an integration can be built and tried before a real member is involved.
- `client.mode` says whether the client holds a live or a test key, as `'live'` or `'test'`.
- `Context`, `Verification`, `Usage`, `LinkToken` and `LinkStatus` carry `mode`, the mode the API
  answered in. It is `null` when talking to a server that does not send it.
- `Mode` constants and the `KnownMode` type are exported.

## 0.1.1

Packaging only, no library changes since 0.1.0. First release published through trusted
publishing, with no token stored in the repository.

## 0.1.0

First release.

- `OneMax` client for the partner integration API: `context`, `verifyCode`, `usage`,
  `confirmUsage`, `voidUsage`, `exchangeCode`, `linkStatus`, `verifyLink`, `revokeLink` and
  `authorizeUrl`.
- `generatePkce` and `challengeFor` for the account linking flow.
- Typed results with camelCase fields and `Date` values.
- Error classes mapped from the HTTP status: `AuthenticationError`, `AccessDisabledError`,
  `NotFoundError`, `ConflictError`, `InvalidRequestError`, `RateLimitError`, `ServerError`, and
  `TransportError` for failures before a usable answer.
