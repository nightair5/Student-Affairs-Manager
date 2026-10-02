import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGoldenWorkspaceV8 } from '../domain/v2/fixtures'
import { workspaceV8ToLegacyView } from '../domain/v2/legacyView'
import { buildLocalRecognition } from '../recognition/pipeline'
import { ProxyDeepSeekExtractionService } from './deepseekExtraction'

const input = { sourceType: 'text' as const, sourceTitle: '匿名盘点通知', content: '请于10月19日16:30提交社团器材盘点表。', now: new Date('2026-10-02T08:00:00+08:00') }
const recognition = buildLocalRecognition({
  sourceType: input.sourceType, sourceTitle: input.sourceTitle, content: input.content,
  referenceTime: input.now, timezone: 'Asia/Shanghai', projects: [], tasks: [],
})
const workspace = workspaceV8ToLegacyView(createGoldenWorkspaceV8())
afterEach(() => vi.unstubAllGlobals())

describe('D26 selected cloud extraction scope', () => {
  it('sends only the current source even if an old caller supplies its entire workspace context', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ result: recognition }))
    vi.stubGlobal('fetch', fetchMock)
    await new ProxyDeepSeekExtractionService().recognize(input, workspace)
    const requestBody = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    expect(requestBody).toMatchObject({ content: input.content, sourceTitle: input.sourceTitle })
    expect(requestBody).not.toHaveProperty('projectCandidates')
    expect(requestBody).not.toHaveProperty('existingTasks')
    expect(requestBody).not.toHaveProperty('contextSelection')
    expect(JSON.stringify(requestBody)).not.toContain(workspace.tasks[0].title)
    expect(JSON.stringify(requestBody)).not.toContain(workspace.projects[0].title)
    expect(JSON.stringify(requestBody)).not.toContain(workspace.sources[0].rawText)
  })

  it('sends exactly the selected minimal summaries, leaving source bodies and project details local', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ result: recognition }))
    vi.stubGlobal('fetch', fetchMock)
    await new ProxyDeepSeekExtractionService().recognize(input, {
      ...workspace,
      cloudSelection: { projectIds: [workspace.projects[0].id], taskIds: [workspace.tasks[0].id] },
    })
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    expect(body.contextSelection).toEqual({ projectIds: [workspace.projects[0].id], taskIds: [workspace.tasks[0].id] })
    expect(body.projectCandidates).toEqual([{
      projectId: workspace.projects[0].id, title: workspace.projects[0].title, category: workspace.projects[0].category,
      keywords: [], activeMilestones: [], recentSourceTitles: [], dateRange: [],
    }])
    expect(body.existingTasks).toHaveLength(1)
    expect(body.existingTasks[0].id).toBe(workspace.tasks[0].id)
    expect(JSON.stringify(body)).not.toContain(workspace.tasks[2].title)
    expect(JSON.stringify(body)).not.toContain(workspace.sources[0].rawText)
  })

  it('blocks source POSTs after status explicitly reports not configured', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({ configured: false }))
    vi.stubGlobal('fetch', fetchMock)
    const service = new ProxyDeepSeekExtractionService()
    expect(await service.status()).toMatchObject({ configured: false })
    await expect(service.recognize(input, workspace)).rejects.toThrow('来源内容未发送')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/deepseek/status')
  })
})
