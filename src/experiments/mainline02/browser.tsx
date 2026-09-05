import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../App'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import { IsolatedTestStore } from '../mainline01/isolatedStore'
import { cases, notices, artificialResponse, emptyWorkspace } from '../mainline01/fixtures'
import { assertDatabaseName, createMainlineRuntime, type MainlineRuntime } from './runtime'
import { buildBrowserReminderJobs } from '../../lib/notifications'
import type { WorkspaceV8 } from '../../domain/v2/types'
import type { WorkspaceRecordStore } from '../../domain/v2/repository'

const parameters = new URLSearchParams(location.search)
const name = 'rco-mainline-01-02-i1-' + parameters.get('run')
assertDatabaseName(name)
// Dedicated entry instrumentation: never installed by normal main.tsx.
const effects = { databaseOpens: [] as string[], recordReads: [] as string[], recordWrites: [] as string[],
  localStorage: 0, fetch: 0, xhr: 0, webSocket: 0, notificationPermission: 0, notifications: 0 }
const originalOpen = indexedDB.open.bind(indexedDB)
indexedDB.open = (target: string, version?: number) => {
  effects.databaseOpens.push(target)
  if (target !== name) throw Error('FOREIGN_DATABASE_FORBIDDEN')
  return originalOpen(target, version)
}
for (const method of ['getItem','setItem','removeItem','clear','key'] as const) {
  Object.defineProperty(Storage.prototype, method, { value: () => { effects.localStorage++; throw Error('LEGACY_STORAGE_FORBIDDEN') } })
}
window.fetch = async () => { effects.fetch++; throw Error('NETWORK_FORBIDDEN') }
XMLHttpRequest.prototype.open = () => { effects.xhr++; throw Error('XHR_FORBIDDEN') }
window.WebSocket = new Proxy(WebSocket, { construct: () => { effects.webSocket++; throw Error('WEBSOCKET_FORBIDDEN') } })
if ('Notification' in window) {
  window.Notification = new Proxy(Notification, { construct: () => { effects.notifications++; throw Error('NOTIFICATION_FORBIDDEN') } })
  Notification.requestPermission = async () => { effects.notificationPermission++; throw Error('NOTIFICATION_PERMISSION_FORBIDDEN') }
}
const actual = new IsolatedTestStore(name)
let failNextTransaction = false
const store: WorkspaceRecordStore & { name: string } = {
  name, read: key => { effects.recordReads.push(key); return actual.read(key) }, write: (key,value) => { effects.recordWrites.push(key); return actual.write(key,value) },
  remove: async () => { throw Error('DELETE_FORBIDDEN') },
  transactionMany: async () => { throw Error('MIGRATION_FORBIDDEN') },
  transaction: (key,mutate) => { effects.recordWrites.push(key); return actual.transaction(key, raw => {
    const result = mutate(raw)
    if (failNextTransaction) { failNextTransaction=false; throw Error('INJECTED_ATOMIC_FAILURE') }
    return result
  }) },
}
const initial = emptyWorkspace()
initial.workspace.id = name
export function Evidence({runtime}:{runtime:MainlineRuntime}) {
  const [snapshot,setSnapshot]=useState<WorkspaceV8|null>(null)
  const [status,setStatus]=useState('')
  return <section aria-label="工程证据工具">
    <details><summary>旧人工通知文字（不是识别结果）</summary>{cases.map(c=><p key={c}>{c}：{notices[c]}</p>)}</details>
    <button type="button" onClick={()=>{void runtime.load().then(value=>{setSnapshot(value);setStatus('已从指定测试库读回')}).catch(()=>setStatus('读回失败'))}}>读取测试库证据</button>
    <button type="button" onClick={()=>{failNextTransaction=true;setStatus('已设置下一笔事务故障；无数据写入')}}>设置下一笔事务故障</button>
    <p>{name} · {status}</p>
    <pre aria-label="副作用调用记录">{JSON.stringify(effects)}</pre>
    <p aria-label="真实提醒作业数">{snapshot ? '真实提醒函数作业：'+buildBrowserReminderJobs(runtime.view(snapshot).tasks,new Date()).length : '尚未读取提醒作业'}</p>
    <details><summary>实际canonical读回JSON</summary><pre>{snapshot ? JSON.stringify(snapshot,null,2) : '尚未读回'}</pre></details>
  </section>
}
void createMainlineRuntime({
  name,store,initialize:parameters.get('new')==='1'?initial:undefined,
  recognize:(text,sourceId)=>{
    const kind=cases.find(c=>notices[c]===text)
    if(!kind)throw Error('ONLY_EXISTING_ENGINEERING_NOTICES_ALLOWED')
    return artificialResponse(kind,sourceId)
  },
}).then(runtime=>{
  parameters.delete('new')
  history.replaceState(null,'','/?'+parameters.toString())
  createRoot(document.getElementById('root')!).render(<><Evidence runtime={runtime}/><App runtime={runtime}/></>)
}).catch(error=>{
  document.getElementById('root')!.textContent='隔离入口停止：'+(error instanceof Error?error.message:'初始化失败')
})
