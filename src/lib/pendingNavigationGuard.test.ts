import {describe, expect, it, vi} from 'vitest'
import {protectPendingNavigation, type PendingNavigationState} from './pendingNavigationGuard'

const clear: PendingNavigationState = {writes: 0, taskActions: 0, eventActions: 0, taskDrafts: 0, materialDrafts: 0, eventDrafts: 0}

describe('pending changes during navigation', () => {
  it('does not interrupt navigation when nothing is pending', () => {
    const event = {preventDefault: vi.fn(), returnValue: 'unchanged'}
    expect(protectPendingNavigation(event, clear)).toBe(false)
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.returnValue).toBe('unchanged')
  })

  it.each(Object.keys(clear) as Array<keyof PendingNavigationState>)(
    'warns before navigation as soon as %s is pending', (field) => {
      const event = {preventDefault: vi.fn(), returnValue: 'unchanged'}
      expect(protectPendingNavigation(event, {...clear, [field]: 1})).toBe(true)
      expect(event.preventDefault).toHaveBeenCalledOnce()
      expect(event.returnValue).toBe('')
    },
  )
})
