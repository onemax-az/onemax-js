export class OneMaxError extends Error {
  override name = 'OneMaxError'
}

export class TransportError extends OneMaxError {
  override name = 'TransportError'
}

export interface ApiErrorFields {
  status: number
  code: string
  message: string
  details: Record<string, unknown>
  requestId: string | null
}

export class ApiError extends OneMaxError {
  override name = 'ApiError'
  readonly status: number
  readonly code: string
  readonly details: Record<string, unknown>
  readonly requestId: string | null

  constructor(fields: ApiErrorFields) {
    super(fields.message)
    this.status = fields.status
    this.code = fields.code
    this.details = fields.details
    this.requestId = fields.requestId
  }
}

export class AuthenticationError extends ApiError {
  override name = 'AuthenticationError'
}

export class AccessDisabledError extends ApiError {
  override name = 'AccessDisabledError'
}

export class NotFoundError extends ApiError {
  override name = 'NotFoundError'
}

export class ConflictError extends ApiError {
  override name = 'ConflictError'
}

export class InvalidRequestError extends ApiError {
  override name = 'InvalidRequestError'
}

export class RateLimitError extends ApiError {
  override name = 'RateLimitError'
  readonly retryAfter: number | null

  constructor(fields: ApiErrorFields) {
    super(fields)
    const retryAfter = fields.details.retry_after
    this.retryAfter =
      typeof retryAfter === 'number' && Number.isInteger(retryAfter) ? retryAfter : null
  }
}

export class ServerError extends ApiError {
  override name = 'ServerError'
}

export function apiErrorFor(fields: ApiErrorFields): ApiError {
  const { status } = fields
  if (status === 401) return new AuthenticationError(fields)
  if (status === 403) return new AccessDisabledError(fields)
  if (status === 404) return new NotFoundError(fields)
  if (status === 409) return new ConflictError(fields)
  if (status === 400 || status === 422) return new InvalidRequestError(fields)
  if (status === 429) return new RateLimitError(fields)
  if (status >= 500) return new ServerError(fields)
  return new ApiError(fields)
}
