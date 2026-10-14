import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../App'
import { IsolatedTestStore } from '../mainline01/isolatedStore'
import { emptyWorkspace } from '../mainline01/fixtures'
import { planFixtureResult, planFixtures } from './fixtures'
import { CanonicalWorkspaceRepository, type WorkspaceRecordStore } from '../../domain/v2/repository'
import { IndexedDbWorkspaceRepository } from '../../lib/repository'
import { CapturePersistenceService } from '../../domain/v2/capture'
import { workspaceV8ToLegacyView } from '../../domain/v2/legacyView'
import { D20ReviewSessionRepository } from '../candidate16/d20ReviewSession'
import { createOrdinaryMeasurement } from '../../domain/v2/ordinaryMeasurementD26'
import { PLAN_RECEIPT } from '../../domain/v2/personalPlanD27'
import { PLAN_MEASUREMENT } from '../../domain/v2/planMeasurementD27'
import type { WorkspaceV8 } from '../../domain/v2/types'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import '../d26/diagnostics.css'
declare const __D27_CONFIG__: { database: string; build: string; origin: string }
const config = __D27_CONFIG__
if (location.origin !== config.origin || !/^rco-mainline-01-02-i1-d27-plan-[a-z0-9-]+$/.test(config.database)) throw Error('D27_ISOLATION_REQUIRED')
const actual = new IsolatedTestStore(config.database)
let failCommit = false, failRead = false, failCheckpoint = false
const store: WorkspaceRecordStore & { name: string } = { name: actual.name, read: k => actual.read(k), remove: k => actual.remove(k), write: (k, v) => { if (k === PLAN_MEASUREMENT + ':checkpoint' && failCheckpoint) { failCheckpoint = false; return Promise.reject(Error('D27_INJECTED_PLAN_CHECKPOINT_FAILURE')) } return actual.write(k, v) }, transaction: (k, f) => actual.transaction(k, raw => {
  const next = f(raw), a = raw as WorkspaceV8 | undefined, b = next as WorkspaceV8
  if (k === 'current' && b.preferences.legacyData?.[PLAN_RECEIPT] && JSON.stringify(b.preferences.legacyData[PLAN_RECEIPT]) !== JSON.stringify(a?.preferences.legacyData?.[PLAN_RECEIPT]) && failCommit) { failCommit = false; throw Error('D27_INJECTED_PLAN_COMMIT_FAILURE') }
  return next
}), transactionMany: (k, f) => actual.transactionMany(k, f) }
const canonical = new CanonicalWorkspaceRepository(store), initial = emptyWorkspace(); initial.workspace.id = config.database
await canonical.initialize(initial)
const readerStore: WorkspaceRecordStore = { ...store, read: k => { if (k === 'current' && failRead) { failRead = false; return Promise.reject(Error('D27_INJECTED_INDEPENDENT_READBACK_FAILURE')) } return new IsolatedTestStore(config.database).read(k) } }
const measurement = createOrdinaryMeasurement(store)
const environment = { canonical, viewRepository: new IndexedDbWorkspaceRepository(canonical), reader: new CanonicalWorkspaceRepository(readerStore), capture: new CapturePersistenceService(canonical), measurement, reviewSession: new D20ReviewSessionRepository(store, measurement.changed, measurement.activity, true), initial: workspaceV8ToLegacyView((await canonical.load())!), store, label: config.build,
  extraction: { status: async () => ({ configured: true, model: 'ANONYMOUS_OFFLINE_FAKE_TRANSPORT' }), extract: async () => [], recognize: async (input: { content: string; sourceId?: string }) => { const f = planFixtures.find(f => f.text === input.content); if (!f) throw Error('工程入口只接受列出的匿名通知；实时模型派发关闭。'); return planFixtureResult(f.id, input.sourceId ?? 'anonymous') } } }
export function Page() {
  const [text, setText] = useState(''), [selected, setSelected] = useState('shared-plan')
  return <><App ordinaryEnvironment={environment}/><details className="d26-diagnostics"><summary>D27 工程诊断 · 匿名输入与故障</summary><p>{config.build}；{config.database}；ENGINEERING_REPLAY；业务模型请求0，非真人试次。与6777旧入口、旧库分开。</p>
    <label>匿名通知<select value={selected} onChange={e => setSelected(e.target.value)}>{planFixtures.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label><textarea aria-label="匿名通知原文" value={planFixtures.find(f => f.id === selected)!.text} readOnly/>
    <p>复制原文到普通首页；接受来源，再查看同一首页安排。故障按钮仅用于匿名工程验收。</p><button onClick={() => { failCommit = true }}>注入下次安排事务失败</button><button onClick={() => { failRead = true }}>注入下次安排独立读回失败</button><button onClick={() => { failCheckpoint = true }}>注入下次安排检查点失败</button>
    <button onClick={() => void new CanonicalWorkspaceRepository(new IsolatedTestStore(config.database)).load().then(w => setText(JSON.stringify(w, null, 2)))}>工程独立canonical读回</button>
    <button onClick={() => void canonical.transaction(w => ({ ...w, tasks: w.tasks.map((t, i) => i ? t : { ...t, description: '匿名工程并发备注' }) })).then(() => setText('另一标签写入无关备注，当前页面尚未刷新。'))}>模拟另一标签无关备注变化</button>
    <button onClick={() => void canonical.transaction(w => ({ ...w, tasks: w.tasks.map((t, i) => i ? t : { ...t, snoozedUntil: '2026-10-06T15:00:00+08:00' }) })).then(() => setText('另一标签改变同一事项稍后时间，当前页面尚未刷新。'))}>模拟另一标签关联状态变化</button><pre>{text}</pre>
  </details></>
}
createRoot(document.getElementById('root')!).render(<Page/> )
