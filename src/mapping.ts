import { TransportError } from './errors.js'
import type { Context, LinkStatus, LinkToken, Offer, Usage, Verification } from './models.js'

type Fields = Record<string, unknown>

function unexpected(field: string, expected: string): TransportError {
  return new TransportError(`Unexpected response: ${field} is not ${expected}`)
}

function asFields(value: unknown, field: string): Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw unexpected(field, 'an object')
  }
  return value as Fields
}

function readString(fields: Fields, key: string): string {
  const value = fields[key]
  if (typeof value !== 'string') throw unexpected(key, 'a string')
  return value
}

function readNullableString(fields: Fields, key: string): string | null {
  const value = fields[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw unexpected(key, 'a string or null')
  return value
}

function readBoolean(fields: Fields, key: string): boolean {
  const value = fields[key]
  if (typeof value !== 'boolean') throw unexpected(key, 'a boolean')
  return value
}

function readInteger(fields: Fields, key: string): number {
  const value = fields[key]
  if (typeof value !== 'number' || !Number.isInteger(value)) throw unexpected(key, 'an integer')
  return value
}

function parseDate(value: string, key: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw unexpected(key, 'a datetime')
  return date
}

function readDate(fields: Fields, key: string): Date {
  return parseDate(readString(fields, key), key)
}

function readNullableDate(fields: Fields, key: string): Date | null {
  const value = readNullableString(fields, key)
  return value === null ? null : parseDate(value, key)
}

function toOffer(value: unknown): Offer {
  const fields = asFields(value, 'offer')
  return {
    id: readString(fields, 'id'),
    headline: readString(fields, 'headline'),
    title: readString(fields, 'title'),
    openNow: readBoolean(fields, 'open_now'),
  }
}

export function toContext(value: unknown): Context {
  const fields = asFields(value, 'context')
  const offers = fields.offers
  if (!Array.isArray(offers)) throw unexpected('offers', 'a list')
  return {
    partnerName: readString(fields, 'partner_name'),
    venueId: readString(fields, 'venue_id'),
    venueName: readString(fields, 'venue_name'),
    dailyLimit: readInteger(fields, 'daily_limit'),
    offers: offers.map(toOffer),
  }
}

export function toVerification(value: unknown): Verification {
  const fields = asFields(value, 'verification')
  return {
    active: readBoolean(fields, 'active'),
    usable: readBoolean(fields, 'usable'),
    reason: readString(fields, 'reason'),
    usageId: readNullableString(fields, 'usage_id'),
    dailyLimit: readInteger(fields, 'daily_limit'),
  }
}

export function toUsage(value: unknown): Usage {
  const fields = asFields(value, 'usage')
  return {
    usageId: readString(fields, 'usage_id'),
    status: readString(fields, 'status'),
    reference: readNullableString(fields, 'reference'),
    createdAt: readDate(fields, 'created_at'),
    confirmedAt: readNullableDate(fields, 'confirmed_at'),
    voidedAt: readNullableDate(fields, 'voided_at'),
  }
}

export function toLinkToken(value: unknown): LinkToken {
  const fields = asFields(value, 'link token')
  return {
    linkToken: readString(fields, 'link_token'),
    active: readBoolean(fields, 'active'),
  }
}

export function toLinkStatus(value: unknown): LinkStatus {
  const fields = asFields(value, 'link status')
  return {
    linked: readBoolean(fields, 'linked'),
    active: readBoolean(fields, 'active'),
  }
}
