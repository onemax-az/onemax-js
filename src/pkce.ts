import type { PkcePair } from './models.js'

const VERIFIER_BYTES = 32
const NODE_CRYPTO = 'node:crypto'

async function webCrypto(): Promise<Crypto> {
  const available = (globalThis as { crypto?: Crypto }).crypto
  if (available !== undefined) return available
  const module = (await import(NODE_CRYPTO)) as { webcrypto: Crypto }
  return module.webcrypto
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

async function challengeWith(crypto: Crypto, verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

export async function challengeFor(verifier: string): Promise<string> {
  return challengeWith(await webCrypto(), verifier)
}

export async function generatePkce(): Promise<PkcePair> {
  const crypto = await webCrypto()
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES)))
  return { verifier, challenge: await challengeWith(crypto, verifier) }
}
