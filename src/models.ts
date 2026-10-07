export const Reason = {
  Ok: 'ok',
  NotSubscribed: 'not_subscribed',
  LimitReached: 'limit_reached',
  OfferUnavailable: 'offer_unavailable',
  InvalidCode: 'invalid_code',
  NotLinked: 'not_linked',
} as const

export type KnownReason = (typeof Reason)[keyof typeof Reason]

export type Reason = KnownReason | (string & {})

export const UsageStatus = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Voided: 'voided',
} as const

export type KnownUsageStatus = (typeof UsageStatus)[keyof typeof UsageStatus]

export type UsageStatus = KnownUsageStatus | (string & {})

export const Locale = {
  Az: 'az',
  Ru: 'ru',
  En: 'en',
} as const

export type Locale = (typeof Locale)[keyof typeof Locale]

export interface Offer {
  id: string
  headline: string
  title: string
  openNow: boolean
}

export interface Context {
  partnerName: string
  venueId: string
  venueName: string
  dailyLimit: number
  offers: Offer[]
}

export interface Verification {
  active: boolean
  usable: boolean
  reason: Reason
  usageId: string | null
  dailyLimit: number
}

export interface Usage {
  usageId: string
  status: UsageStatus
  reference: string | null
  createdAt: Date
  confirmedAt: Date | null
  voidedAt: Date | null
}

export interface LinkToken {
  linkToken: string
  active: boolean
}

export interface LinkStatus {
  linked: boolean
  active: boolean
}

export interface PkcePair {
  verifier: string
  challenge: string
}
