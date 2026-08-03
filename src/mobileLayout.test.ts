import { describe, expect, it } from 'vitest'
import { coreNavigation, libraryNavigation } from './components/navigation'

describe('mobile application shell', () => {
  it('keeps the four daily destinations in the bottom navigation', () => {
    expect(coreNavigation.map((item) => item.id)).toEqual([
      'today',
      'inbox',
      'tasks',
      'calendar',
    ])
  })

  it('keeps secondary destinations available from the mobile menu', () => {
    expect(libraryNavigation.map((item) => item.id)).toEqual([
      'library',
      'archive',
      'knowledge',
      'reports',
    ])
  })

  it('does not duplicate destinations across the mobile navigation layers', () => {
    const destinations = [...coreNavigation, ...libraryNavigation].map((item) => item.id)

    expect(new Set(destinations).size).toBe(destinations.length)
    expect(destinations).not.toContain('services')
  })
})
