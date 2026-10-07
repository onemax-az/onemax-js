# Changelog

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
