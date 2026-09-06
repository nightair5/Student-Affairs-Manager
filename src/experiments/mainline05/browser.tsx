import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../App'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import { emptyWorkspace } from '../mainline01/fixtures'
import { IsolatedTestStore } from '../mainline01/isolatedStore'
import { CanonicalWorkspaceRepository, type WorkspaceRecordStore } from '../../domain/v2/repository'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { buildBrowserReminderJobs } from '../../lib/notifications'
import { createSemanticRuntime } from './runtime'
import { engineeringReply, engineeringCase, cases, notices, linkedEvent, sharedMaterial, sharedEvent, cancelWithoutReplacement } from './engineeringReplay'
import { validateSemanticWorkspace, stateOf } from './semanticState'
import { parseSemanticInput } from '../mainline04/semanticContract'
import type { SeenInput } from '../mainline03/seenReplay'

declare const __MAINLINE05_INPUTS__: { seen: SeenInput[] }
const params = new URLSearchParams(location.search)
const run = params.get('run')
if (!run || !/^mainline05-[a-z0-9-]{10,80}$/.test(run)) throw Error('TEST_RUN_REQUIRED')
const name = 'rco-mainline-01-02-i1-' + run
const effects = { databaseOpens: [] as string[], recordReads: 0, recordWrites: 0, localStorage: 0,
  fetch: 0, xhr: 0, webSocket: 0, beacon: 0, notificationPermission: 0, notifications: 0 }
const open = indexedDB.open.bind(indexedDB)
indexedDB.open = (target: string, version?: number) => {
  effects.databaseOpens.push(target)
  if (target !== name) throw Error('FOREIGN_DATABASE_FORBIDDEN')
  return open(target, version)
}
for (const method of ['getItem','setItem','removeItem','clear','key'] as const) {
  Object.defineProperty(Storage.prototype, method, { value: () => { effects.localStorage++; throw Error('LEGACY_STORAGE_FORBIDDEN') } })
}
window.fetch = async () => { effects.fetch++; throw Error('NETWORK_FORBIDDEN') }
XMLHttpRequest.prototype.open = () => { effects.xhr++; throw Error('XHR_FORBIDDEN') }
window.WebSocket = new Proxy(WebSocket, { construct: () => { effects.webSocket++; throw Error('WEBSOCKET_FORBIDDEN') } })
navigator.sendBeacon = () => { effects.beacon++; throw Error('BEACON_FORBIDDEN') }
if ('Notification' in window) {
  window.Notification = new Proxy(Notification, { construct: () => { effects.notifications++; throw Error('NOTIFICATION_FORBIDDEN') } })
  Notification.requestPermission = async () => { effects.notificationPermission++; throw Error('NOTIFICATION_PERMISSION_FORBIDDEN') }
}
const actual = new IsolatedTestStore(name)
let failNext = false
let variant = 'original'
const store: WorkspaceRecordStore & { name: string } = {
  name, read: key => { effects.recordReads++; return actual.read(key) },
  write: (key,value) => { effects.recordWrites++; return actual.write(key,value) },
  remove: async () => { throw Error('DELETE_FORBIDDEN') }, transactionMany: async () => { throw Error('MIGRATION_FORBIDDEN') },
  transaction: (key,mutate) => {
    effects.recordWrites++
    return actual.transaction(key,raw => { const next = mutate(raw)
      if (failNext) { failNext = false; throw Error('INJECTED_ATOMIC_FAILURE') } return next })
  },
}
async function digest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('')
}
function Evidence() {
  const [snapshot,setSnapshot] = useState<WorkspaceV8 | null>(null), [status,setStatus] = useState('尚未读库')
  const [identity,setIdentity] = useState(''), [diagnosis,setDiagnosis] = useState('')
  const [reading,setReading] = useState(false)
  const read = async () => {
    if (reading) return
    setReading(true); setSnapshot(null); setIdentity(''); setStatus('正在独立读库，尚无本次结果')
    try {
    // New transport + new real repository: not the App snapshot or internal exportJson.
    const reader = new CanonicalWorkspaceRepository(new IsolatedTestStore(name))
    const value = await reader.load()
    if (!value) throw Error('INDEPENDENT_DATABASE_MISSING')
    await validateSemanticWorkspace(value)
    const sha256=await digest(JSON.stringify(value))
    setSnapshot(value); setIdentity(sha256); setStatus('独立仓储完整读回并通过联合校验')
    console.info('MAINLINE05_INDEPENDENT_READ', JSON.stringify({ name, origin: location.origin, sha256,
      source: 'new CanonicalWorkspaceRepository(new IsolatedTestStore(name)).load()', tasks: value.tasks.length }))
    } finally { setReading(false) }
  }
  const downloadIndependent = () => {
    if (reading || !snapshot || !/^[a-f0-9]{64}$/.test(identity)) return
    const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot)],{type:'application/json'}))
    const link=document.createElement('a'); link.href=url; link.download='mainline-05-independent-read.json'
    document.body.append(link); link.click(); link.remove(); window.setTimeout(()=>URL.revokeObjectURL(url),1000)
    console.info('MAINLINE05_INDEPENDENT_DOWNLOAD',JSON.stringify({name,origin:location.origin,sha256:identity,
      source:'last completed new CanonicalWorkspaceRepository(new IsolatedTestStore(name)).load()',file:link.download}))
  }
  return <details aria-label="MAINLINE05工程工具" style={{position:'fixed',left:8,top:8,zIndex:2000,maxWidth:'min(560px,90vw)',maxHeight:'55vh',overflow:'auto',background:'white',padding:12,border:'1px solid #163b41'}}>
    <summary>MAINLINE05工程工具（不是确认入口）</summary>
    <p>仅用已见人工工程通知；不测模型准确率。浏览器时区：{Intl.DateTimeFormat().resolvedOptions().timeZone}；业务时区：Asia/Shanghai。</p>
    <label>下一次人工响应变形<select aria-label="人工响应变形" defaultValue="original" onChange={e=>{variant=e.target.value}}>
      <option value="original">原8类人工响应</option><option value="planned-start">仅开始时间</option><option value="linked-event">材料关联事件</option>
      <option value="shared-material">共享材料、独立时间</option><option value="date-only">时间与原文不一致（负例）</option><option value="bad-reference">悬空材料引用</option>
      <option value="dependency">显式前置依赖（工程变形）</option><option value="unaccounted-information">信息未覆盖（负例）</option>
      <option value="shared-event">共享事件时间（工程关系变形）</option><option value="cancel-without-replacement">取消无替代关系，保留独立新事项（工程）</option>
      <option value="bad-scope">仅一项依据待核对</option>
    </select></label>
    <details><summary>已见工程通知正文</summary>{cases.map(kind=><p key={kind}>{kind}：{notices[kind]}</p>)}</details>
    <button type="button" disabled={reading} onClick={()=>{void read().catch(error=>setStatus('读回失败：'+String(error)))}}>独立读取测试库</button>
    <button type="button" disabled={reading||!snapshot||!identity} onClick={downloadIndependent}>下载本次独立读库对象</button>
    <button type="button" onClick={()=>{failNext=true;setStatus('下一笔事务将在写入前失败，不改已有数据')}}>设置下一笔事务故障</button>
    <button type="button" onClick={()=>setDiagnosis(JSON.stringify(__MAINLINE05_INPUTS__.seen.map(input=>{
      try { parseSemanticInput(input.parsed); return {id:input.caseId,status:'UNEXPECTED_EXPRESSIBLE'} }
      catch { return {id:input.caseId,status:'NOT_EXPRESSIBLE',reason:'原始候选缺少本包所需完整语义，不补写、不生成任务',rawOutputText:input.rawOutputText} }
    })))}>只读检查3条B8已见候选</button>
    <p>{name} · {status}</p><p aria-label="独立读库全对象摘要">{identity}</p>
    <pre aria-label="副作用记录">{JSON.stringify(effects)}</pre>
    <p aria-label="无日期与提醒检查">{snapshot?JSON.stringify({tasks:snapshot.tasks.length,timePoints:snapshot.timePoints.length,reminders:snapshot.reminderRecords.length,
      noDate:snapshot.tasks.filter(t=>!snapshot.timePoints.some(p=>p.relatedTaskIds.includes(t.id))).map(t=>({id:t.id,timePoints:0,reminders:snapshot.reminderRecords.filter(r=>r.taskId===t.id).length})),
      realJobs:buildBrowserReminderJobs(runtime.view(snapshot).tasks,new Date()).length,
      drafts:snapshot.extractionDrafts.map(d=>({id:d.id,status:d.status,operations:d.legacyData?.mainline05?stateOf(snapshot,d.id).operations.length:0}))}):'尚未读回'}</p>
    <details><summary>独立canonical完整JSON</summary><pre aria-label="独立canonical完整JSON">{snapshot?JSON.stringify(snapshot):'尚未读回'}</pre></details>
    <details><summary>B8诊断（历史FAIL不改）</summary><pre>{diagnosis}</pre></details>
  </details>
}
let runtime: Awaited<ReturnType<typeof createSemanticRuntime>>
async function mount() {
const initial = emptyWorkspace(); initial.workspace.id = name
runtime = await createSemanticRuntime({ name, store, initial: params.get('new') === '1' ? initial : undefined,
  recognize: (text,handle) => engineeringReply(engineeringCase(text),handle,input=>{
    if (variant === 'original') return
    if (variant === 'unaccounted-information') {
      if (engineeringCase(text) !== 'information') throw Error('未覆盖信息负例仅适用于information通知')
      input.informationScopeIds=[]; return
    }
    if (variant === 'cancel-without-replacement') {
      if (engineeringCase(text) !== 'revision') throw Error('取消关系变形仅适用于revision通知')
      cancelWithoutReplacement(input); return
    }
    if (engineeringCase(text) !== 'multi') throw Error('变形仅适用于已登记multi工程通知')
    if (variant === 'planned-start') input.timePoints[0].type='planned_start'
    else if (variant === 'linked-event') linkedEvent(input)
    else if (variant === 'shared-material') sharedMaterial(input)
    else if (variant === 'shared-event') sharedEvent(input)
    else if (variant === 'dependency') input.tasks[1].detail.dependencyTempIds=['submit']
    else if (variant === 'date-only') { input.timePoints[0].normalizedValue='2026-09-08'; input.timePoints[0].isAllDay=true; input.timePoints[0].precision='date_only' }
    else if (variant === 'bad-reference') input.tasks[0].detail.materialTempIds.push('missing-material')
    else if (variant === 'bad-scope') input.tasks[0].action.scopeId='unverifiable-scope'
    else throw Error('UNREGISTERED_ENGINEERING_VARIANT')
  }) })
params.delete('new'); history.replaceState(null,'','/?'+params.toString())
createRoot(document.getElementById('root')!).render(<><App runtime={runtime}/><Evidence/></>)
}
void mount().catch(error=>{document.getElementById('root')!.textContent='隔离入口停止：'+String(error)})
