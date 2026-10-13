import { describe, expect, it, vi } from 'vitest'
import { createSmartIntakeResult, ProxyDeepSeekExtractionService, type DeepSeekExtractionService } from './deepseekExtraction'
import type { ParsedSuggestion } from '../types'
import { buildLocalRecognition } from '../recognition/pipeline'
import { ordinaryWorkflowFixture, ordinaryWorkflowText } from '../recognition/ordinaryProviderSupport.fixture'
import { ordinaryWorkflowMaterialSupportFromSidecar, ordinaryProviderContextFromSidecar } from '../recognition/ordinaryProviderSupport'
import { assembleCurrentFirstSuggestion } from '../recognition/materialChannelGrounding'
import { CanonicalWorkspaceRepository, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { CapturePersistenceService } from '../domain/v2/capture'
import { emptyWorkspace } from '../experiments/mainline01/fixtures'
import { IndexedDbWorkspaceRepository } from './repository'
import { buildSourceReviewPlan, commitSourceReview, verifySourceReviewReadback } from '../domain/v2/sourceReviewD26'

const aiSuggestion: ParsedSuggestion = {
  id: 'ai-1',
  title: '提交报名表',
  category: '比赛',
  deadline: '2026-08-10T18:00',
  estimatedMinutes: 30,
  nextAction: '核对报名表字段',
  description: '提交比赛报名表',
  priority: '中',
  materials: ['报名表'],
  evidence: '8月10日18:00提交报名表',
  confidence: '高',
}

function service(result: ParsedSuggestion[] | Error): DeepSeekExtractionService {
  return {
    status: async () => ({ configured: true, model: 'deepseek-v4-flash' }),
    extract: async () => {
      if (result instanceof Error) throw result
      return result
    },
  }
}

describe('smart intake', () => {
  it('uses DeepSeek suggestions while keeping the source locally traceable', async () => {
    const result = await createSmartIntakeResult({
      sourceType: 'text',
      content: '8月10日18:00提交报名表',
      now: new Date('2026-08-02T08:00:00+08:00'),
    }, service([aiSuggestion]))

    expect(result.method).toBe('deepseek-v4-flash')
    expect(result.source.extractionMethod).toBe('deepseek-v4-flash')
    expect(result.suggestions).toEqual([aiSuggestion])
  })

  it('falls back to local rules without losing the source when the proxy is unavailable', async () => {
    const result = await createSmartIntakeResult({
      sourceType: 'text',
      content: '8月10日18:00提交报名表',
      now: new Date('2026-08-02T08:00:00+08:00'),
    }, service(new Error('DeepSeek 尚未配置服务端密钥。')))

    expect(result.method).toBe('local-rules')
    expect(result.fallbackReason).toContain('尚未配置')
    expect(result.suggestions[0].title).toBe('提交报名表')
  })

  it('does not send a bare link to DeepSeek as if it were webpage content', async () => {
    let called = false
    const proxy: DeepSeekExtractionService = {
      status: async () => ({ configured: true }),
      extract: async () => { called = true; return [aiSuggestion] },
    }
    const result = await createSmartIntakeResult({
      sourceType: 'link', content: '', url: 'https://example.edu/notice', sourceTitle: '学院通知',
    }, proxy)

    expect(called).toBe(false)
    expect(result.method).toBe('local-rules')
    expect(result.fallbackReason).toContain('尚未读取')
  })

  it('sends only server-extracted link text to DeepSeek', async () => {
    let received = ''
    const proxy: DeepSeekExtractionService = {
      status: async () => ({ configured: true }),
      extract: async (input) => { received = input.content; return [aiSuggestion] },
    }
    const result = await createSmartIntakeResult({
      sourceType: 'link',
      content: '8月10日18:00提交报名表',
      url: 'https://example.edu/notice',
      sourceTitle: '学院通知',
    }, proxy)

    expect(received).toBe('8月10日18:00提交报名表')
    expect(result.method).toBe('deepseek-v4-flash')
  })

  it('deduplicates identical in-flight requests and caches by prompt version', async () => {
    const recognition = buildLocalRecognition({ sourceType: 'text', sourceTitle: '比赛通知', content: '8月10日18:00提交报名表', referenceTime: new Date('2026-08-02T08:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
    const fetchMock = vi.fn(async () => Response.json({ result: recognition }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const proxy = new ProxyDeepSeekExtractionService('/api/deepseek')
      const input = { sourceType: 'text' as const, sourceTitle: '比赛通知', content: '8月10日18:00提交报名表', now: new Date('2026-08-02T08:00:00+08:00') }
      const [first, second] = await Promise.all([proxy.recognize(input), proxy.recognize(input)])
      const cached = await proxy.recognize(input)
      expect(first.schemaVersion).toBe('2.0')
      expect(second).toEqual(first)
      expect(cached).toEqual(first)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('uses the isolated multimodal endpoint only for an explicit ephemeral image payload', async () => {
    const recognition = buildLocalRecognition({ sourceType: 'image', sourceTitle: '报名截图', content: '8月10日18:00提交报名表', referenceTime: new Date('2026-08-02T08:00:00+08:00'), timezone: 'Asia/Shanghai', projects: [], tasks: [] })
    let requestedUrl = ''
    let requestedBody: Record<string, unknown> = {}
    const fetchMock = vi.fn(async (url: string | URL | Request, options?: RequestInit) => {
      requestedUrl = String(url)
      requestedBody = JSON.parse(String(options?.body)) as Record<string, unknown>
      return Response.json({ result: recognition })
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const proxy = new ProxyDeepSeekExtractionService('/api/deepseek')
      await proxy.recognize({
        sourceType: 'image',
        sourceTitle: '报名截图',
        content: '8月10日18:00提交报名表',
        now: new Date('2026-08-02T08:00:00+08:00'),
        multimodal: {
          consent: true,
          mode: 'image',
          ocrTextIncluded: true,
          images: [{
            dataUrl: 'data:image/png;base64,eA==',
            mimeType: 'image/png',
            label: '报名截图.png',
            byteLength: 1,
          }],
        },
      })
      expect(requestedUrl).toBe('/api/deepseek/extract-multimodal')
      expect(requestedBody).toMatchObject({ consent: true, inputMode: 'image', ocrTextIncluded: true })
      expect(requestedBody.images).toHaveLength(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('ordinary proxy supports existing declared facts through the real product chain', () => {
  const request = { sourceType: 'text' as const, content: ordinaryWorkflowText, now: new Date('2026-10-13T02:00:00Z') }
  it('persists the source before transport, derives support after strict parsing, then confirms and independently reads the unchanged declared channel', async () => {
    const store = new MemoryWorkspaceRecordStore(), repository = new CanonicalWorkspaceRepository(store)
    await repository.initialize(emptyWorkspace())
    const capture = new CapturePersistenceService(repository)
    const handle = await capture.beginCapture({ operationId: crypto.randomUUID(), sourceType: 'text', title: '匿名服务链工程夹具', rawText: request.content,
      provider: 'deepseek', modelName: 'deepseek-v4-flash', promptVersion: 'TEST_ONLY_NOT_MODEL_OUTPUT', pipelineVersion: 'test-ordinary-provider' })
    const original = ordinaryWorkflowFixture(), raw = JSON.stringify({ result: original })
    let sentBody: Record<string, unknown> = {}
    const fetchMock = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
      const savedBeforeTransport = (await new CanonicalWorkspaceRepository(store).load())!
      expect(savedBeforeTransport.sources.find(s => s.id === handle.sourceId)?.currentVersionId).toBe(handle.sourceVersionId)
      expect(savedBeforeTransport.recognitionRuns.find(r => r.id === handle.recognitionRunId)?.status).toBe('running')
      expect(savedBeforeTransport.tasks).toHaveLength(0)
      sentBody = JSON.parse(String(options?.body)) as Record<string, unknown>
      return new Response(raw, { headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
    try {
      const proxy = new ProxyDeepSeekExtractionService('/api/deepseek')
      const result = await capture.recognize(handle, () => proxy.recognize({ ...request, sourceId: handle.sourceId, sourceVersionId: handle.sourceVersionId }))
      const sidecar = proxy.semanticSidecar(handle.sourceId, handle.sourceVersionId)!
      const first = assembleCurrentFirstSuggestion(result, { sourceText: request.content, referenceTime: request.now.toISOString(), timezone: 'Asia/Shanghai',
        workflowMaterialSupport: ordinaryWorkflowMaterialSupportFromSidecar(sidecar) })
      expect(sentBody).not.toHaveProperty('sourceId')
      expect(sentBody).not.toHaveProperty('sourceVersionId')
      expect(first.result.materials[0].submissionChannel).toBe('甲业务系统')
      expect(result.evidence.every(e => e.sourceId === handle.sourceId)).toBe(true)
      expect(sidecar.ordinaryProviderSupport.originalProxyRecognitionResult.evidence.every(e => e.sourceId === 'pending-source')).toBe(true)
      expect(sidecar.ordinaryProviderSupport.originalProxyResponse).toBe(raw)
      expect(ordinaryProviderContextFromSidecar(sidecar)).toEqual({ referenceTime: request.now.toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai' })
      await repository.transaction(w => ({ ...w, extractionDrafts: w.extractionDrafts.map(d => d.id === handle.draftId
        ? { ...d, result: first.result, legacyData: { ...d.legacyData, semanticSidecar: JSON.parse(JSON.stringify(sidecar)), firstSuggestionDisplayed: JSON.parse(JSON.stringify(first.result)) } } : d) }))
      const beforeConfirm = (await repository.load())!
      expect(beforeConfirm.tasks).toHaveLength(0)
      const view = (await new IndexedDbWorkspaceRepository(repository).load())!
      const draft = view.drafts.find(d => d.id === handle.draftId)!
      const plan = buildSourceReviewPlan(beforeConfirm, draft)
      const receipt = await commitSourceReview(repository, plan)
      const read = await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store), receipt)
      expect(read.tasks).toHaveLength(1)
      expect(read.materials).toHaveLength(1)
      expect(read.materials[0].submissionChannel).toBe('甲业务系统')
      expect(read.materials[0].relatedTaskIds).toEqual([read.tasks[0].id])
      expect(read.extractionDrafts.find(d => d.id === handle.draftId)?.legacyData?.semanticSidecar).toEqual(sidecar)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally { vi.unstubAllGlobals() }
  })
  it('rebinds a cached normalized response separately for different persisted captures without sharing mutable evidence or sidecars', async () => {
    const fetchMock = vi.fn(async () => Response.json({ result: ordinaryWorkflowFixture() }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const proxy = new ProxyDeepSeekExtractionService()
      const first = await proxy.recognize({ ...request, sourceId: 'capture-a', sourceVersionId: 'a:1' })
      const second = await proxy.recognize({ ...request, sourceId: 'capture-b', sourceVersionId: 'b:1' })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(first.evidence.every(e => e.sourceId === 'capture-a')).toBe(true)
      expect(second.evidence.every(e => e.sourceId === 'capture-b')).toBe(true)
      first.materials[0].submissionChannel = '手动篡改'
      const cached = await proxy.recognize({ ...request, sourceId: 'capture-b', sourceVersionId: 'b:1' })
      expect(cached.materials[0].submissionChannel).toBe('甲业务系统')
      const audit = proxy.semanticSidecar('capture-b', 'b:1')!
      audit.ordinaryProviderSupport.originalProxyRecognitionResult.materials[0].submissionChannel = null
      expect(proxy.semanticSidecar('capture-b', 'b:1')!.ordinaryProviderSupport.originalProxyRecognitionResult.materials[0].submissionChannel).toBe('甲业务系统')
      expect(proxy.semanticSidecar('capture-b', 'b:2')).toBeUndefined()
    } finally { vi.unstubAllGlobals() }
  })
  it('does not expose a stale audit after a failed new version or rescue a different wire contract', async () => {
    const fetchMock = vi.fn(async () => Response.json({ result: ordinaryWorkflowFixture() }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const proxy = new ProxyDeepSeekExtractionService()
      await proxy.recognize({ ...request, sourceId: 'capture-a', sourceVersionId: 'a:1' })
      fetchMock.mockImplementationOnce(async () => Response.json({ result: { schemaVersion: 'recognition-fact-role-authority-1.0.0', tasks: [] } }))
      await expect(proxy.recognize({ ...request, content: request.content + '\n新版本', sourceId: 'capture-a', sourceVersionId: 'a:2' })).rejects.toThrow('RecognitionResult 2.0')
      expect(proxy.semanticSidecar('capture-a', 'a:1')).toBeUndefined()
      expect(proxy.semanticSidecar('capture-a', 'a:2')).toBeUndefined()
    } finally { vi.unstubAllGlobals() }
  })
  it('rejects a genuine foreign source and a partial capture binding rather than overwriting provenance', async () => {
    const result = ordinaryWorkflowFixture(); result.evidence[0].sourceId = 'foreign-source'
    const fetchMock = vi.fn(async () => Response.json({ result }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const proxy = new ProxyDeepSeekExtractionService()
      await expect(proxy.recognize({ ...request, sourceId: 'capture-a' })).rejects.toThrow('CAPTURE_REQUIRED')
      expect(fetchMock).not.toHaveBeenCalled()
      await expect(proxy.recognize({ ...request, sourceId: 'capture-a', sourceVersionId: 'a:1' })).rejects.toThrow('FOREIGN_SOURCE')
      expect(proxy.semanticSidecar('capture-a', 'a:1')).toBeUndefined()
    } finally { vi.unstubAllGlobals() }
  })
})
