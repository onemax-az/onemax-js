import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

import { VERSION } from '../src/index.js'

test('the exported version is the one in package.json', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as {
    version: string
  }

  expect(VERSION).toBe(manifest.version)
})
