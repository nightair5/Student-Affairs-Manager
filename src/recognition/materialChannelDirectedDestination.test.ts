import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { decodeTaskTimeAuthorityRecording } from './taskTimeAuthorityContract'
import { indexImmutableScopesV11 } from './scopeIndexV11'
import { assembleCurrentFirstSuggestion, groundMaterialChannels } from './materialChannelGrounding'
import { ordinaryWorkflowFixture } from './ordinaryProviderSupport.fixture'
import { ProxyDeepSeekExtractionService } from '../lib/deepseekExtraction'
import { ordinaryWorkflowMaterialSupportFromSidecar } from './ordinaryProviderSupport'

const observed = JSON.parse(readFileSync('docs/recognition-optimization/p1-first-pass-convergence/TIME_CHANNEL_OBSERVED_02.json', 'utf8')) as {
  role: string; ordinal: number; candidate: string; responseSha256: string; rawHttpText: string;
  source: { sourceId: string; sourceVersionId: string; sourceText: string; sourceSha256: string; referenceTime: string; timezone: string }
}
const sha = (value: string) => createHash('sha256').update(value).digest('hex')
async function actual() {
  const source = observed.source
  const context = { index: await indexImmutableScopesV11(source.sourceId, source.sourceVersionId, source.sourceText),
    referenceTime: source.referenceTime, timezone: source.timezone }
  return { source, context, decoded: decodeTaskTimeAuthorityRecording(observed.rawHttpText, context, 'SingleAuthority') }
}

describe('explicit directed material destinations preserve existing observed facts', () => {
  it('real raw02 contains both destinations and complete action surfaces; ordinary shared grounding retains them without editing raw', async () => {
    expect(observed.role).toBe('RECORDED_ANONYMOUS_MODEL_DEVELOPMENT_NOT_HOLDOUT')
    expect(observed.ordinal).toBe(2)
    expect(sha(observed.rawHttpText)).toBe(observed.responseSha256)
    expect(sha(observed.source.sourceText)).toBe(observed.source.sourceSha256)
    const original = JSON.parse(JSON.parse(observed.rawHttpText).output[0].content[0].text)
    expect(original.tasks.map((t: { action: { surface: string }; object: { surface: string } }) => t.action.surface.endsWith(t.object.surface))).toEqual([true, true])
    expect(original.materials.map((m: { submissionChannel: string }) => m.submissionChannel)).toEqual(['学业系统', '学习中心B305窗口'])
    const { source, decoded } = await actual()
    const first = assembleCurrentFirstSuggestion(decoded.result, { sourceText: source.sourceText, referenceTime: source.referenceTime, timezone: source.timezone })
    expect(first.result.materials.map(m => [m.name, m.submissionChannel])).toEqual([
      ['课程报告PDF', '学业系统'], ['纸质课程报告', '学习中心B305窗口'],
    ])
    expect(first.materialChannelAudit.decisions.every(d => d.status === 'EXPLICIT_CHANNEL')).toBe(true)
    expect(first.result.conflicts.some(c => c.id.startsWith('material-channel:'))).toBe(false)
    expect(decoded.sidecar.originalResponse).toBe(observed.rawHttpText)
  })
  it('the actual normalized facts also retain their destinations through the default proxy parser and ordinary assembler', async () => {
    const { source, decoded } = await actual()
    // A transport fixture at the official proxy's normalized 2.0 boundary;
    // it is not another supplier response or a new model observation.
    const normalized = structuredClone(decoded.result)
    normalized.evidence.forEach(e => { e.sourceId = 'pending-source' })
    const fetchMock = vi.fn(async () => Response.json({ result: normalized }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const proxy = new ProxyDeepSeekExtractionService('/api/deepseek')
      const result = await proxy.recognize({ sourceType: 'text', content: source.sourceText, now: new Date(source.referenceTime),
        sourceId: 'fresh-capture', sourceVersionId: 'fresh-capture:version:1' })
      const sidecar = proxy.semanticSidecar('fresh-capture', 'fresh-capture:version:1')!
      const first = assembleCurrentFirstSuggestion(result, { sourceText: source.sourceText, referenceTime: source.referenceTime,
        timezone: source.timezone, workflowMaterialSupport: ordinaryWorkflowMaterialSupportFromSidecar(sidecar) })
      expect(first.result.materials.map(m => m.submissionChannel)).toEqual(['学业系统', '学习中心B305窗口'])
      expect(first.result.conflicts.some(c => c.id.startsWith('material-channel:'))).toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally { vi.unstubAllGlobals() }
  })
  it.each([
    ['请向昼溪办事入口提交课程报告PDF。', '昼溪办事入口', true],
    ['请到若水B305窗口提交课程报告PDF。', '若水B305窗口', true],
    ['请勿向学业系统提交课程报告PDF。', '学业系统', false],
    ['如果向学业系统提交课程报告PDF，请保留记录。', '学业系统', false],
    ['请向学业系统提交课程报告PDF照片。', '学业系统', false],
    ['请向学业系统分站提交课程报告PDF。', '学业系统', false],
    ['请向学业系统提交另一报告PDF。', '学业系统', false],
    ['请到学业系统提交课程报告PDF，但不要到学业系统提交课程报告PDF。', '学业系统', false],
  ])('checks closed current-object roles, not name membership: %s', (sourceText, channel, accepted) => {
    const input = ordinaryWorkflowFixture()
    input.standaloneTasks[0].title = '提交课程报告PDF'; input.standaloneTasks[0].actionVerb = '提交'
    input.standaloneTasks[0].actionObject = '课程报告PDF'
    input.materials[0].name = '课程报告PDF'; input.materials[0].submissionChannel = channel
    input.evidence = [{ id: 'e-action', sourceId: 'source', quote: sourceText, field: 'materials' }]
    input.materials[0].evidenceIds = ['e-action']
    const first = groundMaterialChannels(input, sourceText)
    expect(first.result.materials[0].submissionChannel).toBe(accepted ? channel : null)
  })
  it('does not borrow a source destination for a missing reciprocal material owner', () => {
    const input = ordinaryWorkflowFixture(), sourceText = '请向甲业务系统上传本学年回执。'
    input.evidence = [{ id: 'e-action', sourceId: 'source', quote: sourceText, field: 'materials' }]
    input.materials[0].evidenceIds = ['e-action']; input.standaloneTasks[0].materialTempIds = []
    expect(groundMaterialChannels(input, sourceText).result.materials[0].submissionChannel).toBeNull()
  })
})
