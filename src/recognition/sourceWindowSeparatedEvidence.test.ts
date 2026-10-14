import { describe, it, expect } from 'vitest'
import { createObligationFixture } from '../experiments/candidate19Recorded/obligationFixtures'
import { decodeObligationProductRecording } from './sourceContractV6'
import { groundSourceWindows, type SourceWindowDeclaration } from './sourceWindowGrounding'

describe('window value and explicit owner references use separate literal evidence', () => {
  const setup = async () => {
    const x = await createObligationFixture('shared-window'), d = decodeObligationProductRecording(x.rawHttpText, x.context)
    const r = structuredClone(d.result), t = r.standaloneTasks[0], p = r.timePoints[0]
    const declarations: SourceWindowDeclaration[] = [{ id: p.tempId, role: 'window_start', owners: [{ kind: 'task', entityId: t.tempId }], valuePolicy: 'CITED_VALUE_SEPARATE_FROM_OWNER', ownerEvidencePolicy: 'EXPLICIT_SINGLE_WINDOW_REFERENCE' }]
    const sourceText = '请在指定时间内填写借用记录。办理窗口：2026年11月10—12日。'
    r.evidence = [{ ...r.evidence[0], id: 'action-proof', quote: '请在指定时间内填写借用记录。' }, { ...r.evidence[0], id: 'date-proof', quote: '2026年11月10—12日' }]
    t.evidenceIds = ['action-proof']; t.timePointTempIds = [p.tempId]
    p.rawText = '2026年11月10—12日'; p.evidenceIds = ['date-proof']; p.relatedTaskTempIds = [t.tempId]
    return { r, t, p, declarations, context: { sourceText, referenceTime: x.context.referenceTime, timezone: x.context.timezone } }
  }
  it('accepts declared reciprocal owner with explicit unique-window reference; does not create a deadline', async () => {
    const x = await setup(), d = groundSourceWindows(x.r, x.declarations, x.context)
    expect(d.result.timePoints[0].normalizedValue).toBe('2026-11-10')
    expect(d.result.timePoints[0].needsConfirmation).toBe(false)
    expect(d.result.timePoints[0].type).toBe('event_start')
    expect(d.audit.decisions[0].ownerSupport).toBe('EXPLICIT_SINGLE_WINDOW_REFERENCE')
    expect(d.audit.inferredFacts).toBe(0)
  })
  it('blocks ambiguous windows, unrelated action, negation and nonreciprocal owner', async () => {
    for (const fault of ['competing', 'unrelated', 'negative', 'wrong-owner']) {
      const x = await setup()
      if (fault === 'competing') x.context.sourceText += '另一办理窗口：2026年12月1—3日。'
      if (fault === 'unrelated' || fault === 'negative') {
        x.r.evidence[0].quote = fault === 'unrelated' ? '请提交另一份申请。' : '不要在指定时间内填写借用记录。'
        x.context.sourceText = x.r.evidence[0].quote + '办理窗口：2026年11月10—12日。'
      }
      if (fault === 'wrong-owner') x.p.relatedTaskTempIds = []
      const d = groundSourceWindows(x.r, x.declarations, x.context)
      expect(d.result.timePoints[0].needsConfirmation).toBe(true)
      expect(d.result.conflicts.some(c => c.id === 'source-window:' + x.p.tempId)).toBe(true)
    }
  })
})
