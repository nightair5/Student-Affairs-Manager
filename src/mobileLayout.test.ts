import { describe, expect, it } from 'vitest'
import { coreNavigation, libraryNavigation } from './components/navigation'

describe('mobile application shell', () => {
  it('keeps the four daily destinations in the bottom navigation', () => {
    expect(coreNavigation.map((item) => item.id)).toEqual([
      'today',
      'inbox',
      'archive',
      'calendar',
    ])
    expect(coreNavigation.map((item) => item.label)).toEqual(['今日', '收件箱', '项目', '日历'])
  })

  it('keeps secondary destinations available from the mobile menu', () => {
    expect(libraryNavigation.map((item) => item.id)).toEqual([
      'library',
      'tasks',
      'knowledge',
      'reports',
    ])
    expect(libraryNavigation.slice(0, 2).map((item) => item.label)).toEqual(['资料库', '所有任务'])
  })

  it('does not duplicate destinations across the mobile navigation layers', () => {
    const destinations = [...coreNavigation, ...libraryNavigation].map((item) => item.id)

    expect(new Set(destinations).size).toBe(destinations.length)
    expect(destinations).not.toContain('services')
  })
})
