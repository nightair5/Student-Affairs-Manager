import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { DraftReviewPanel } from '../../components/DraftReviewPanel'
import { CanonicalWorkspaceRepository } from '../../domain/v2/repository'
import { confirmationRevisionV2, confirmV2, editConfirmationV2, reviewEditsV2, type ConfirmationIntentV2 } from '../../domain/v2/confirmationV2'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { captureFixture } from '../mainline01/chain'
import { IsolatedTestStore } from '../mainline01/isolatedStore'
import { LABEL, type CaseName } from '../mainline01/fixtures'
import { reviewV2 } from './confirmationHarness'

const run = new URL(location.href).searchParams.get('run')
const caseName = new URL(location.href).searchParams.get('case') ?? 'multi'
if (!run || !/^[a-z0-9-]+$/u.test(run) || !['multi', 'no-date', 'vague'].includes(caseName)) throw new Error('TEST_RUN_REQUIRED')
const databaseName = `rco-mainline-01-p1-${run}-${caseName}`
const repository = new CanonicalWorkspaceRepository(new IsolatedTestStore(databaseName))

export function HarnessV2() {
  const [workspace, setWorkspace] = useState<WorkspaceV8 | null>(null)
  const [opened, setOpened] = useState(false)
  const [message, setMessage] = useState('请读取隔离测试库。外部请求已被禁止。')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const [lastIntent, setLastIntent] = useState<ConfirmationIntentV2 | null>(null)
  const [checks, setChecks] = useState(0)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const current = workspace?.extractionDrafts[0]
  const view = workspace && current ? reviewV2(workspace, current.id) : null
  const act = async (operation: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try { await operation() } catch (error) { setMessage(error instanceof Error ? error.message : '测试失败') }
    finally { lock.current = false; setBusy(false) }
  }
  const read = () => act(async () => {
    if (!await repository.load()) await captureFixture(repository, caseName as CaseName)
    setWorkspace((await repository.load())!); setOpened(true)
    setMessage('已从独立 IndexedDB 读回；不重新识别，不触及用户工作区。')
  })
  const confirm = (itemId?: string) => act(async () => {
    if (!view || !workspace) throw new Error('REVIEW_REQUIRED')
    const intent = { draftId: view.draft.id, revision: confirmationRevisionV2(workspace),
      taskTempIds: view.draft.items.filter((item) => item.status === '待确认'
        && (itemId ? item.id === itemId : selected[item.id] ?? item.selected !== false)).map((item) => item.suggestion.id) }
    await confirmV2(repository, intent)
    setLastIntent(intent); setWorkspace((await repository.load())!)
    setMessage('点击真实面板确认后写入测试库，并已读回。')
  })
  const unsupported = () => setMessage('此结构编辑不在隔离 V2 本轮范围；没有更改任何记录。')
  const snapshot = workspace && current && {
    databaseName, provider: workspace.recognitionRuns[0].provider, tasks: workspace.tasks,
    times: workspace.timePoints, materials: workspace.materials, evidence: workspace.evidenceRefs,
    firstResponse: current.result, edits: reviewEditsV2(workspace, current.id).history,
    taskCount: workspace.tasks.length, timeCount: workspace.timePoints.length, rollbackChecks: checks,
  }
  return <main>
    <h1>{LABEL} · 隔离确认 V2</h1>
    <p>只验证产品承接人工响应，不代表模型准确率。未接 App、日历、提醒或正式工作区。</p>
    <p>测试数据库：{databaseName}</p>
    <button disabled={busy} onClick={read}>读取 / 重开隔离工程样例</button>
    <button disabled={busy || !lastIntent} onClick={() => act(async () => {
      await confirmV2(repository, lastIntent!); setWorkspace((await repository.load())!); setMessage('重复确认已读回。')
    })}>校验重复确认</button>
    <button disabled={busy || !workspace} onClick={() => act(async () => {
      const before = await repository.load()
      try { await repository.transaction((w) => { w.tasks = []; throw new Error('TEST_ABORT') }) }
      catch (error) { if (!(error instanceof Error) || error.message !== 'TEST_ABORT') throw error }
      const after = await repository.load()
      if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('ROLLBACK_FAILED')
      setChecks((n) => n + 1); setMessage('真实 IndexedDB 事务失败，原记录保持完整。')
    })}>校验失败回滚</button>
    <p role="status">{message}</p>
    <pre aria-label="隔离存储读回结果">{JSON.stringify(workspace && current && {
      databaseName, taskCount: workspace.tasks.length, timeCount: workspace.timePoints.length,
      materialCount: workspace.materials.length, eventCount: workspace.events.length, rollbackChecks: checks,
      tasks: workspace.tasks.map((task) => ({ id: task.id, title: task.title, action: task.legacyData?.actionVerb, object: task.legacyData?.actionObject })),
      times: workspace.timePoints.map((point) => ({ raw: point.rawText, value: point.normalizedValue, timezone: point.timezone, taskIds: point.relatedTaskIds, materialIds: point.relatedMaterialIds })),
      originalTimeTexts: current.result?.timePoints.map((point) => point.rawText),
      edits: reviewEditsV2(workspace, current.id).history.map((row) => ({ field: row.fieldName, before: row.before, after: row.after })),
    }, null, 2)}</pre>
    <details><summary>首次建议与完整存储快照</summary><pre>{JSON.stringify(snapshot, null, 2)}</pre></details>
    {opened && view && workspace && <DraftReviewPanel
      draft={{ ...view.draft, items: view.draft.items.map((item) => ({ ...item, selected: selected[item.id] ?? item.selected })) }}
      source={view.source} confirmationV2={{ busy, items: view.states }}
      onClose={() => setOpened(false)} projectWillCreate={false} projects={[]}
      onUpdate={(itemId, patch) => void act(async () => {
        const item = view.draft.items.find((candidate) => candidate.id === itemId)!
        const fields = Object.keys(patch)
        if (fields.length !== 1 || !['title', 'deadline'].includes(fields[0])) throw new Error('本轮仅支持名称和时间编辑')
        const field = fields[0] as 'title' | 'deadline'
        await editConfirmationV2(repository, { draftId: view.draft.id, taskTempId: item.suggestion.id,
          revision: view.revision, operationId: crypto.randomUUID(), field, value: patch[field]! })
        setWorkspace((await repository.load())!); setMessage('用户编辑已独立持久化，尚未创建任务；可刷新读回。')
      })}
      onConfirm={(id) => void confirm(id)} onConfirmAll={() => void confirm()}
      onToggleTaskSelected={(id, checked) => setSelected((previous) => ({ ...previous, [id]: checked }))}
      onReject={unsupported} onProjectChoice={unsupported} onKeepExplicit={unsupported} onMoveTask={unsupported}
      onToggleRecognitionEntity={unsupported} onSplitTask={unsupported} onMergeTask={unsupported}
    />}
  </main>
}
createRoot(document.getElementById('root')!).render(<HarnessV2 />)
