import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DraftReviewPanel } from '../../components/DraftReviewPanel'
import { CanonicalWorkspaceRepository } from '../../domain/v2/repository'
import { commitDomainPlan, type DomainCommitPlan } from '../../domain/v2/domainCommit'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { captureFixture, confirmItems, reviewView } from './chain'
import { IsolatedTestStore } from './isolatedStore'
import { LABEL, NOW } from './fixtures'
import type { ExtractionDraft } from '../../types'

const run = new URL(location.href).searchParams.get('run')
if (!run || !/^[a-z0-9-]+$/.test(run)) throw new Error('TEST_RUN_ID_REQUIRED')
const databaseName = `rco-mainline-01-${run}`
const repository = new CanonicalWorkspaceRepository(new IsolatedTestStore(databaseName))

function Harness() {
  const [workspace, setWorkspace] = useState<WorkspaceV8 | null>(null)
  const [draft, setDraft] = useState<ExtractionDraft | null>(null)
  const [lastPlan, setLastPlan] = useState<DomainCommitPlan | null>(null)
  const [message, setMessage] = useState('请读取隔离存储；已有测试记录会直接读回，不会重新识别。')
  const [busy, setBusy] = useState(false)
  const [aborts, setAborts] = useState(0)
  const publish = (next: WorkspaceV8) => {
    setWorkspace(next)
    const current = next.extractionDrafts[0]
    if (current) setDraft(reviewView(next, current.id).draft)
  }
  const act = async (operation: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try { await operation() } catch (error) { setMessage(error instanceof Error ? error.message : '测试失败') }
    finally { setBusy(false) }
  }
  const read = () => act(async () => {
    if (!await repository.load()) await captureFixture(repository, 'multi')
    publish((await repository.load())!)
    setMessage('已从独立 IndexedDB 读回；非用户工作区。')
  })
  const confirm = (itemId?: string) => act(async () => {
    if (!draft) throw new Error('TEST_REVIEW_REQUIRED')
    const items = itemId ? draft.items.filter((item) => item.id === itemId) : draft.items
    const { plan } = await confirmItems(repository, draft.id, items)
    setLastPlan(plan)
    publish((await repository.load())!)
    setMessage('用户点击真实客户端确认按钮后，经真实 DomainCommitPlan 写入并读回。')
  })
  const unsupported = () => setMessage('此操作未接入本轮测试适配，不代表产品功能验证。')
  const snapshot = workspace && {
    databaseName, provider: workspace.recognitionRuns[0]?.provider,
    sourceCount: workspace.sources.length, draftStatus: workspace.extractionDrafts[0]?.status,
    taskCount: workspace.tasks.length, materialCount: workspace.materials.length, timeCount: workspace.timePoints.length,
    evidenceCount: workspace.evidenceRefs.length, transactionAbortChecks: aborts,
    tasks: workspace.tasks.map((task) => ({ id: task.id, title: task.title, action: task.legacyData?.actionVerb, object: task.legacyData?.actionObject })),
    materials: workspace.materials.map((material) => ({ name: material.name, tasks: material.relatedTaskIds, formats: material.formatRequirements })),
    times: workspace.timePoints.map((time) => ({ value: time.normalizedValue, rawText: time.rawText, tasks: time.relatedTaskIds, materials: time.relatedMaterialIds })),
    sourceText: workspace.sourceVersions[0]?.rawText,
  }
  return <main>
    <h1>{LABEL}</h1>
    <p>仅复用真实 DraftReviewPanel、领域确认与仓储。未挂载 App；测试适配不包含 App 的日期拦截。无外部请求、无真人计时。</p>
    <p>测试数据库：{databaseName}</p>
    <button disabled={busy} onClick={read}>读取 / 初始化隔离工程样例</button>
    <button disabled={busy || !lastPlan} onClick={() => act(async () => {
      if (!lastPlan) return
      await commitDomainPlan(repository, lastPlan, NOW)
      publish((await repository.load())!)
      setMessage('相同确认计划重复提交后已读回。')
    })}>校验重复确认</button>
    <button disabled={busy || !workspace} onClick={() => act(async () => {
      const before = await repository.load()
      let rejected = false
      try { await repository.transaction((current) => { current.tasks.length = 0; throw new Error('TEST_ABORT') }) }
      catch (error) { rejected = error instanceof Error && error.message === 'TEST_ABORT' }
      const after = await repository.load()
      if (!rejected || JSON.stringify(before) !== JSON.stringify(after)) throw new Error('TEST_ABORT_ROLLBACK_FAILED')
      setAborts((count) => count + 1)
      setMessage('隔离 IndexedDB 事务中途失败，读回证明原记录未丢失。')
    })}>校验失败回滚</button>
    <p role="status">{message}</p>
    <pre aria-label="隔离存储读回结果">{JSON.stringify(snapshot, null, 2)}</pre>
    {draft && workspace && <DraftReviewPanel draft={draft} source={reviewView(workspace, draft.id).source}
      onClose={() => setDraft(null)} projectWillCreate={false} projects={[]}
      onUpdate={(id, patch) => setDraft({ ...draft, items: draft.items.map((item) => item.id === id ? { ...item, suggestion: { ...item.suggestion, ...patch } } : item) })}
      onConfirm={(id) => { void confirm(id) }} onConfirmAll={() => { void confirm() }}
      onToggleTaskSelected={(id, selected) => setDraft({ ...draft, items: draft.items.map((item) => item.id === id ? { ...item, selected } : item) })}
      onReject={unsupported} onProjectChoice={unsupported} onKeepExplicit={unsupported} onMoveTask={unsupported}
      onToggleRecognitionEntity={unsupported} onSplitTask={unsupported} onMergeTask={unsupported} />}
  </main>
}

createRoot(document.getElementById('root')!).render(<Harness />)
