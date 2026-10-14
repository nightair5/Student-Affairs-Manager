import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../App'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import { emptyWorkspace } from '../mainline01/fixtures'
import { IsolatedTestStore } from '../mainline01/isolatedStore'
import { createMainlineRuntime, assertDatabaseName, type MainlineRuntime } from '../mainline02/runtime'
import { engineeringReceipts, seenReceipt, createReplayHandoff, type SeenInput } from './seenReplay'
import type { WorkspaceRecordStore } from '../../domain/v2/repository'
import type { WorkspaceV8 } from '../../domain/v2/types'
import { buildBrowserReminderJobs } from '../../lib/notifications'

declare const __MAINLINE03_INPUTS__: { fixtureSha256: string; seen: SeenInput[] }
const params = new URLSearchParams(location.search)
const name = 'rco-mainline-01-02-i1-' + params.get('run')
assertDatabaseName(name)
const effects = { databaseOpens: [] as string[], recordReads: 0, recordWrites: 0, localStorage: 0,
  fetch: 0, xhr: 0, webSocket: 0, beacon: 0, notificationPermission: 0, notifications: 0 }
const open = indexedDB.open.bind(indexedDB)
indexedDB.open = (target: string, version?: number) => {
  effects.databaseOpens.push(target)
  if (target !== name) throw Error('FOREIGN_DATABASE_FORBIDDEN')
  return open(target, version)
}
for (const method of ['getItem', 'setItem', 'removeItem', 'clear', 'key'] as const) {
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
const store: WorkspaceRecordStore & { name: string } = {
  name, read: key => { effects.recordReads++; return actual.read(key) },
  write: (key, value) => { effects.recordWrites++; return actual.write(key, value) },
  remove: async () => { throw Error('DELETE_FORBIDDEN') },
  transactionMany: async () => { throw Error('MIGRATION_FORBIDDEN') },
  transaction: (key, mutate) => {
    effects.recordWrites++
    return actual.transaction(key, raw => {
      const result = mutate(raw)
      if (failNext) { failNext = false; throw Error('INJECTED_ATOMIC_FAILURE') }
      return result
    })
  },
}
export function Evidence({ runtime, texts }: { runtime: MainlineRuntime; texts: Array<{ label: string; text: string }> }) {
  const [snapshot, setSnapshot] = useState<WorkspaceV8 | null>(null)
  const [status, setStatus] = useState('')
  return <details aria-label="MAINLINE03工程工具" style={{ position: 'fixed', right: 8, bottom: 8,
    zIndex: 2000, maxWidth: 'min(560px,90vw)', maxHeight: '55vh', overflow: 'auto', background: 'white', padding: 12, border: '1px solid #163b41' }}>
    <summary>MAINLINE03工程工具（非确认入口）</summary>
    <p>只读回放旧人工响应/3个已见候选；不调用模型，不测准确率。</p>
    <details><summary>获准旧通知正文</summary>{texts.map(item => <p key={item.label}>{item.label}：{item.text}</p>)}</details>
    <button type="button" onClick={() => { void runtime.load().then(value => {
      setSnapshot(value); setStatus('已从指定测试库读回')
    }).catch(() => setStatus('读回失败')) }}>读取测试库证据</button>
    <button type="button" onClick={() => { failNext = true; setStatus('已设置下一笔事务故障；无数据写入') }}>设置下一笔事务故障</button>
    <p>{name} · {status}</p>
    <pre aria-label="副作用调用记录">{JSON.stringify(effects)}</pre>
    <p aria-label="真实提醒作业数">{snapshot ? '真实提醒函数作业：' + buildBrowserReminderJobs(runtime.view(snapshot).tasks, new Date()).length : '尚未读取提醒作业'}</p>
    <details><summary>实际canonical读回JSON</summary><pre aria-label="canonical读回JSON">{snapshot ? JSON.stringify(snapshot) : '尚未读回'}</pre></details>
  </details>
}
async function mount() {
  const receipts = [...await engineeringReceipts(__MAINLINE03_INPUTS__.fixtureSha256),
    ...await Promise.all(__MAINLINE03_INPUTS__.seen.map(seenReceipt))]
  const initial = emptyWorkspace(); initial.workspace.id = name
  const runtime = await createMainlineRuntime({
    name, store, initialize: params.get('new') === '1' ? initial : undefined,
    handoff: await createReplayHandoff(receipts), recognize: () => { throw Error('OLD_CALLBACK_FORBIDDEN') },
  })
  params.delete('new'); history.replaceState(null, '', '/?' + params.toString())
  createRoot(document.getElementById('root')!).render(<><App runtime={runtime} /><Evidence runtime={runtime}
    texts={receipts.map(item => ({ label: item.originCaseId + ' / ' + item.kind, text: item.sourceText }))} /></>)
}
void mount().catch(error => { document.getElementById('root')!.textContent = '隔离入口停止：' + (error instanceof Error ? error.message : '初始化失败') })
