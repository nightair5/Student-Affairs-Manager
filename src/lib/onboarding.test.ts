import { describe, expect, it } from 'vitest'
import { markOnboardingComplete, shouldShowOnboarding, type OnboardingStorage } from './onboarding'

function memoryStorage(): OnboardingStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

describe('onboarding preference', () => {
  it('shows once and can be reopened explicitly by the app', () => {
    const storage = memoryStorage()
    expect(shouldShowOnboarding(storage)).toBe(true)
    markOnboardingComplete(storage)
    expect(shouldShowOnboarding(storage)).toBe(false)
  })
})
