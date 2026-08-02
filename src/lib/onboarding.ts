const ONBOARDING_KEY = 'student-affairs-steward:onboarding:v1'

export interface OnboardingStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function browserStorage(): OnboardingStorage | null {
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function shouldShowOnboarding(storage: OnboardingStorage | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    return storage.getItem(ONBOARDING_KEY) !== 'complete'
  } catch {
    return false
  }
}

export function markOnboardingComplete(storage: OnboardingStorage | null = browserStorage()): void {
  if (!storage) return
  try {
    storage.setItem(ONBOARDING_KEY, 'complete')
  } catch {
    // Tutorial preference is optional and must never block the workspace.
  }
}
