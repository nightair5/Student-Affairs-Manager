import { describe, expect, it } from 'vitest'
import {
  clearConnectionIntent,
  connectionStatus,
  recordConnectionIntent,
} from './integrationConnections'

describe('integration connection readiness', () => {
  it('records reviewed prerequisites without pretending to connect WeChat', () => {
    const intents = recordConnectionIntent([], 'wechat', '2026-08-01T00:00:00.000Z')
    expect(connectionStatus(intents, 'wechat')).toBe('blocked-platform-approval')
    expect(intents[0].plannedScopes).toEqual(['任务标题', '截止时间', '提醒文案'])
  })

  it('keeps cross-device sync blocked until account infrastructure exists', () => {
    const intents = recordConnectionIntent([], 'cross-device')
    expect(connectionStatus(intents, 'cross-device')).toBe('backend-not-configured')
    expect(connectionStatus(clearConnectionIntent(intents, 'cross-device'), 'cross-device')).toBe('not-connected')
  })
})
