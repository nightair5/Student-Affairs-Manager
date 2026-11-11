import { describe, expect, it } from 'vitest'
import { createOperationId } from './randomId'

describe('createOperationId', () => {
  it('keeps a UUID shape when randomUUID is missing', () => {
    const original = globalThis.crypto
    const bytes = Uint8Array.from({ length: 16 }, (_, index) => index)
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { getRandomValues: (target: Uint8Array) => target.set(bytes) },
    })
    try {
      expect(createOperationId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { configurable: true, value: original })
    }
  })
})
