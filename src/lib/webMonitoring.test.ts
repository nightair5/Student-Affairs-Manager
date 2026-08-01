import { describe, expect, it } from 'vitest'
import {
  applyMonitorCheck,
  compareMonitorText,
  createWebMonitor,
  hashMonitorText,
  normalizeMonitorText,
  validateMonitorUrl,
} from './webMonitoring'

describe('web monitoring rules', () => {
  it('normalizes harmless spacing before comparison', () => {
    expect(normalizeMonitorText(' 报名  截止\r\n\r\n 8 月 3 日 ')).toBe('报名 截止\n8 月 3 日')
    expect(hashMonitorText('报名  截止')).toBe(hashMonitorText('报名 截止'))
  })

  it('explains added and removed lines', () => {
    const result = compareMonitorText('报名截止 8 月 3 日\n需要盖章', '报名截止 8 月 5 日\n需要盖章\n新增承诺书', 'local-paste', '2026-08-01T00:00:00.000Z')
    expect(result).toMatchObject({ changed: true, addedLineCount: 2, removedLineCount: 1 })
    expect(result.addedSamples).toContain('新增承诺书')
    expect(result.removedSamples).toContain('报名截止 8 月 3 日')
  })

  it('updates the baseline only through an explicit check', () => {
    const monitor = createWebMonitor('比赛通知', 'https://example.edu/notice', '初版', '2026-08-01T00:00:00.000Z')
    const updated = applyMonitorCheck(monitor, '新版', 'server-fetch', '2026-08-02T00:00:00.000Z')
    expect(updated.status).toBe('changed')
    expect(updated.lastResult?.method).toBe('server-fetch')
    expect(updated.baselineText).toBe('新版')
  })

  it('rejects non-HTTPS monitoring URLs', () => {
    expect(validateMonitorUrl('http://example.edu')).toContain('HTTPS')
    expect(validateMonitorUrl('https://example.edu')).toBeNull()
  })
})
