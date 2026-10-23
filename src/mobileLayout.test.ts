import { describe, expect, it } from 'vitest'
import { coreNavigation, libraryNavigation } from './components/navigation'

describe('mobile application shell', () => {
  it('keeps the five requested daily destinations in the bottom navigation', () => {
    expect(coreNavigation.map((item) => item.id)).toEqual([
      'today',
      'inbox',
      'calendar',
      'tasks',
      'library',
    ])
    expect(coreNavigation.map((item) => item.label)).toEqual(['今日', '收件箱', '日历', '所有任务', '资料库'])
  })

  it('keeps secondary destinations available from the mobile menu', () => {
    expect(libraryNavigation.map((item) => item.id)).toEqual([
      'archive',
      'knowledge',
      'reports',
    ])
    expect(libraryNavigation.map((item) => item.label)).toEqual(['项目', '知识问答', '周报月报'])
  })

  it('does not duplicate destinations across the mobile navigation layers', () => {
    const destinations = [...coreNavigation, ...libraryNavigation].map((item) => item.id)

    expect(new Set(destinations).size).toBe(destinations.length)
    expect(destinations).not.toContain('services')
  })
})
