import { describe, expect, it } from 'vitest'
import { proveDirectDirectiveGovernor } from './directiveGovernorProof'

describe('RCO-5-010-E1 positive directive governor proof', () => {
  it.each([
    '请',
    '申请人请',
    '请于周五前',
    '请在系统中',
    '请各位同学认真',
    '请你',
    '请各位同学于周五前认真',
    '各位同学请先',
  ])('proves a complete positive grammar before the action: %s', (prefix) => {
    expect(proveDirectDirectiveGovernor(prefix)).toMatchObject({
      governed: true,
      proof: 'SINGLE_CHARACTER_POSITIVE_GRAMMAR',
    })
  })

  it.each([
    '申请材料',
    '邀请记录',
    '请假流程',
    '请求',
    '聘请',
    '请柬',
    '请帖',
    '请安',
  ])('does not prove a single 请 through uncontrolled characters: %s', (prefix) => {
    expect(proveDirectDirectiveGovernor(prefix)).toMatchObject({ governed: false, proof: 'NOT_PROVEN' })
  })

  it('rejects every uncontrolled one-character CJK bridge instead of maintaining a blacklist', () => {
    const allowedSingleCharacterBridges = new Set(['你', '您', '先', '再'])
    const unexpectedlyGoverned: string[] = []
    for (let codePoint = 0x4e00; codePoint <= 0x9fff; codePoint += 1) {
      const bridge = String.fromCodePoint(codePoint)
      if (allowedSingleCharacterBridges.has(bridge)) continue
      if (proveDirectDirectiveGovernor(`请${bridge}`).governed) unexpectedlyGoverned.push(bridge)
    }
    expect(unexpectedlyGoverned).toEqual([])
  })

  it.each(['你', '您', '先', '再'])('keeps the explicitly controlled one-character bridge %s', (bridge) => {
    expect(proveDirectDirectiveGovernor(`请${bridge}`).governed).toBe(true)
  })

  it.each(['请你你', '请先先', '请认真各位同学', '请于周五前于周六前'])('rejects repeated or out-of-order bridge segments: %s', (prefix) => {
    expect(proveDirectDirectiveGovernor(prefix).governed).toBe(false)
  })

  it('uses the last 请 so a subject containing 请 cannot shadow the real governor', () => {
    expect(proveDirectDirectiveGovernor('申请人请')).toMatchObject({ governed: true, markerStartInPrefix: 3 })
  })

  it.each([
    '请在请假后',
    '请在申请材料中',
  ])('backtracks past a later word-internal 请 to the earlier proved governor: %s', (prefix) => {
    expect(proveDirectDirectiveGovernor(prefix)).toMatchObject({
      governed: true,
      markerSurface: '请',
      markerStartInPrefix: 0,
      proof: 'SINGLE_CHARACTER_POSITIVE_GRAMMAR',
    })
  })

  it('requires positive left-side grammar for multi-character governors too', () => {
    expect(proveDirectDirectiveGovernor('学院要求')).toMatchObject({ governed: true, markerSurface: '要求' })
    expect(proveDirectDirectiveGovernor('申请要求')).toMatchObject({ governed: false, proof: 'NOT_PROVEN' })
  })
})
