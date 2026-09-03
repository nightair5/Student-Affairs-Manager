import { describe, expect, it } from 'vitest'
import { indexImmutableScopesV11, SCOPE_INDEX_VERSION } from './scopeIndexV11'

describe('scope-index-1.1', () => {
  it('keeps ASCII and full-width clock colons inside their proposition scope', async () => {
    const index = await indexImmutableScopesV11('clock-source', 'v1', '活动在19:30开始。签到在20：15结束。')
    expect(index.scopes.map((scope) => scope.text)).toEqual(['活动在19:30开始。', '签到在20：15结束。'])
  })

  it('still treats heading colons as deterministic boundaries', async () => {
    const index = await indexImmutableScopesV11('heading-source', 'v1', '提醒：请在19:30前保存草稿。')
    expect(index.scopes.map((scope) => scope.text)).toEqual(['提醒：', '请在19:30前保存草稿。'])
  })

  it('binds ids to the index version, source, version, bytes and exact local offsets', async () => {
    const content = '提醒：请在19:30前保存草稿。'
    const first = await indexImmutableScopesV11('stable-source', 'v1', content)
    const repeated = await indexImmutableScopesV11('stable-source', 'v1', content)
    const changed = await indexImmutableScopesV11('stable-source', 'v2', content)
    expect(SCOPE_INDEX_VERSION).toBe('scope-index-1.1')
    expect(repeated).toEqual(first)
    expect(changed.sourceFingerprint).not.toBe(first.sourceFingerprint)
    expect(changed.scopes[0].id).not.toBe(first.scopes[0].id)
    for (const scope of first.scopes) expect(content.slice(scope.start, scope.end)).toBe(scope.text)
  })
})
