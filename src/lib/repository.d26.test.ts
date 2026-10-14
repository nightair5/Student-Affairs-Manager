import { describe, expect, it } from 'vitest'
import { createGoldenWorkspaceV8 } from '../domain/v2/fixtures'
import { workspaceV8ToLegacyView } from '../domain/v2/legacyView'
import { CanonicalWorkspaceRepository, CURRENT_WORKSPACE_RECORD_KEY, MemoryWorkspaceRecordStore } from '../domain/v2/repository'
import { IndexedDbWorkspaceRepository, WorkspaceViewConflictError } from './repository'

const timeA = '2026-10-02T10:00:00.000Z'
const timeB = '2026-10-02T11:00:00.000Z'

async function pages(store = new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: createGoldenWorkspaceV8() })) {
  const canonical = new CanonicalWorkspaceRepository(store)
  const pageA = new IndexedDbWorkspaceRepository(new CanonicalWorkspaceRepository(store))
  const pageB = new IndexedDbWorkspaceRepository(new CanonicalWorkspaceRepository(store))
  const viewA = structuredClone((await pageA.load())!)
  const viewB = structuredClone((await pageB.load())!)
  return { canonical, pageA, pageB, viewA, viewB, store }
}

describe('D26 ordinary workspace read baseline and atomic field edits', () => {
  it('retains newer title, status and deadline when a stale second page edits another task', async () => {
    const { canonical, pageA, pageB, viewA, viewB } = await pages()
    Object.assign(viewA.tasks[0], { title: '提交新的报名材料', status: '进行中', deadline: '2026-10-20T16:30', updatedAt: timeA })
    viewA.savedAt = timeA
    await pageA.save(viewA)
    Object.assign(viewB.tasks[2], { title: '制作匿名展示作品', updatedAt: timeB })
    viewB.savedAt = timeB
    await pageB.save(viewB)
    const reloaded = workspaceV8ToLegacyView((await canonical.load())!)
    expect(reloaded.tasks[0]).toMatchObject({ title: '提交新的报名材料', status: '进行中', deadline: '2026-10-20T16:30' })
    expect(reloaded.tasks[2].title).toBe('制作匿名展示作品')
  })

  it('merges different fields of one task, including another save from the still stale page', async () => {
    const { canonical, pageA, pageB, viewA, viewB } = await pages()
    Object.assign(viewA.tasks[0], { title: '填写最新报名表', updatedAt: timeA })
    await pageA.save(viewA)
    Object.assign(viewB.tasks[0], { status: '进行中', updatedAt: timeB })
    await pageB.save(viewB)
    viewB.tasks[0].nextAction = '检查必填字段'
    await pageB.save(viewB)
    expect((await canonical.load())?.tasks[0]).toMatchObject({ title: '填写最新报名表', status: 'in_progress', nextAction: '检查必填字段' })
  })

  it('rejects conflicting titles with the diff and keeps all local edits and persisted facts intact', async () => {
    const { canonical, pageA, pageB, viewA, viewB } = await pages()
    Object.assign(viewA.tasks[0], { title: '页面甲已确认标题', updatedAt: timeA })
    await pageA.save(viewA)
    Object.assign(viewB.tasks[0], { title: '页面乙未保存标题', updatedAt: timeB })
    viewB.tasks[2].title = '同批另一项修改'
    const submitted = structuredClone(viewB)
    const persisted = await canonical.load()
    await expect(pageB.save(viewB)).rejects.toMatchObject({
      code: 'WORKSPACE_VIEW_CONFLICT', conflicts: expect.arrayContaining([{
        path: 'tasks[task-1].title', baseline: '填写报名表', current: '页面甲已确认标题', proposed: '页面乙未保存标题',
      }]),
    })
    expect(viewB).toEqual(submitted)
    expect(await canonical.load()).toEqual(persisted)
  })

  it('supports a fresh non-conflicting edit after a rejected save and explicit reload', async () => {
    const { canonical, pageA, pageB, viewA, viewB } = await pages()
    viewA.tasks[0].title = '甲标题'
    await pageA.save(viewA)
    viewB.tasks[0].title = '乙标题'
    await expect(pageB.save(viewB)).rejects.toBeInstanceOf(WorkspaceViewConflictError)
    const fresh = (await pageB.load())!
    fresh.tasks[0].title = '核对差异后的标题'
    await pageB.save(fresh)
    expect((await canonical.load())?.tasks[0].title).toBe('核对差异后的标题')
  })

  it('appends source text revisions and leaves prior version, run and evidence bytes unchanged', async () => {
    const { canonical, pageA, pageB, viewA, viewB } = await pages()
    const before = (await canonical.load())!
    Object.assign(viewA.sources[0], { rawText: '匿名通知修订：10月20日提交报名表。', updatedAt: timeA })
    viewA.savedAt = timeA
    await pageA.save(viewA)
    const revised = (await canonical.load())!
    expect(revised.sourceVersions.slice(0, before.sourceVersions.length)).toEqual(before.sourceVersions)
    expect(revised.recognitionRuns).toEqual(before.recognitionRuns)
    expect(revised.evidenceRefs).toEqual(before.evidenceRefs)
    expect(revised.sourceVersions.at(-1)).toMatchObject({ rawText: viewA.sources[0].rawText, versionNo: 2 })
    expect(revised.sources[0]).toMatchObject({ status: 'needs_review', currentVersionId: revised.sourceVersions.at(-1)?.id })
    viewB.tasks[0].title = '只改任务，不碰来源'
    await pageB.save(viewB)
    expect((await canonical.load())?.sourceVersions).toEqual(revised.sourceVersions)
    await pageA.save(viewA)
    expect((await canonical.load())?.sourceVersions).toEqual(revised.sourceVersions)
  })

  it('rejects stale source text edits rather than replacing a newer source revision', async () => {
    const { canonical, pageA, pageB, viewA, viewB } = await pages()
    viewA.sources[0].rawText = '页面甲的新通知文字'
    await pageA.save(viewA)
    const before = await canonical.load()
    viewB.sources[0].rawText = '页面乙的陈旧文字修订'
    await expect(pageB.save(viewB)).rejects.toMatchObject({ code: 'WORKSPACE_VIEW_CONFLICT' })
    expect(await canonical.load()).toEqual(before)
    expect(viewB.sources[0].rawText).toBe('页面乙的陈旧文字修订')
  })

  it('a repeated unchanged save is idempotent even when field timestamps are identical', async () => {
    const { canonical, pageA, viewA } = await pages()
    viewA.tasks[0].title = '同时间戳下的新标题'
    await pageA.save(viewA)
    const once = await canonical.load()
    expect(once?.tasks[0].version).toBe(2)
    await pageA.save(viewA)
    expect(await canonical.load()).toEqual(once)
  })

  it('uses the last submitted baseline when the same returned projection is edited twice', async () => {
    const { canonical, pageA } = await pages()
    const view = (await pageA.load())!
    view.tasks[0].title = '第一次标题修改'
    await pageA.save(view)
    view.tasks[0].title = '第二次标题修改'
    await pageA.save(view)
    expect((await canonical.load())?.tasks[0].title).toBe('第二次标题修改')
  })

  it('does not change a cancelled canonical task back to todo when only its title changes', async () => {
    const seed = createGoldenWorkspaceV8()
    seed.tasks[0].status = 'cancelled'
    const { canonical, pageA, viewA } = await pages(new MemoryWorkspaceRecordStore({ [CURRENT_WORKSPACE_RECORD_KEY]: seed }))
    viewA.tasks[0].title = '保留取消状态的标题修改'
    await pageA.save(viewA)
    expect((await canonical.load())?.tasks[0].status).toBe('cancelled')
  })

  it('retains local input and leaves no partial facts when the transaction fails before write', async () => {
    class FailingStore extends MemoryWorkspaceRecordStore {
      fail = false
      override async transaction(key: string, mutate: Parameters<MemoryWorkspaceRecordStore['transaction']>[1]): Promise<unknown> {
        if (this.fail) { mutate(await this.read(key)); throw new Error('ANONYMOUS_STORAGE_FAILURE') }
        return super.transaction(key, mutate)
      }
    }
    const store = new FailingStore({ [CURRENT_WORKSPACE_RECORD_KEY]: createGoldenWorkspaceV8() })
    const { canonical, pageA, viewA } = await pages(store)
    viewA.tasks[0].title = '失败时保留的输入'
    viewA.sources[0].rawText = '失败时不能部分写入的新来源'
    const before = await canonical.load()
    store.fail = true
    await expect(pageA.save(viewA)).rejects.toThrow('ANONYMOUS_STORAGE_FAILURE')
    expect(await canonical.load()).toEqual(before)
    expect(viewA.tasks[0].title).toBe('失败时保留的输入')
    store.fail = false
    await pageA.save(viewA)
    expect((await canonical.load())?.tasks[0].title).toBe('失败时保留的输入')
  })

  it('initializes an empty record once without overwriting another page', async () => {
    const store = new MemoryWorkspaceRecordStore()
    const pageA = new CanonicalWorkspaceRepository(store)
    const pageB = new CanonicalWorkspaceRepository(store)
    const first = createGoldenWorkspaceV8(), other = createGoldenWorkspaceV8()
    other.tasks[0].title = '不能覆盖的第二份初始化'
    const [resultA, resultB] = await Promise.all([pageA.initialize(first), pageB.initialize(other)])
    expect(resultA).toEqual(first)
    expect(resultB).toEqual(first)
    expect(await pageA.load()).toEqual(first)
  })
})
