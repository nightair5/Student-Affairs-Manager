import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../App'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import { IsolatedTestStore } from '../mainline01/isolatedStore'
import { CanonicalWorkspaceRepository, type WorkspaceRecordStore } from '../../domain/v2/repository'
import { SemanticRepository } from '../mainline05/semanticRepository'
import { validateSemanticWorkspace, readingOf } from '../mainline05/semanticState'
import { createRealInputRuntime, emptyRealInputWorkspace, prepareInputRun, replayRecordedA02, validateRecordedA02, replayRecordedBatch, type RecordedBatch, type RecordedBatchIdentity, type RecordedA02 } from './runtime'
import { createModelClient, type ModelExecutor } from './modelClient'
import { acquireFile, acquireText } from './inputAcquisition'
import { makeSendSnapshot, sha256Text } from './inputReceipt'
import { buildModelRequest } from './modelWire'
import { replayRecordedCandidate02, type RecordedCandidate02, replayRecordedCandidate03, type RecordedCandidate03 } from './runtime'
import type { LocalExtractionResources } from '../../lib/fileExtraction'
import { buildBrowserReminderJobs } from '../../lib/notifications'

interface Carrier { unitId: string; name: string; mime: string; sha256: string; url: string; sourceText: string }
declare const __REAL_INPUT_CONFIG__: { mode: 'seen_engineering_replay' | 'live' | 'recorded_a02' | 'recorded_batch'; capability: string;
  batch?: RecordedBatchIdentity[];
  candidate02?: boolean;
  candidate03?: boolean;
  recorded?:{name:string;requestSha:string;responseSha:string};
  units: Array<{unitId: string; requestSha: string}>; resources: LocalExtractionResources; carriers: Carrier[] }
const config = __REAL_INPUT_CONFIG__
const params = new URLSearchParams(location.search), run = params.get('run')
if (location.hostname !== '127.0.0.1' || !run || !/^real-input-[a-z0-9-]{10,100}$/.test(run)) throw Error('REAL_INPUT_ISOLATED_RUN_REQUIRED')
const name = 'rco-mainline-01-02-i1-' + run
if((config.mode==='recorded_a02'||config.mode==='recorded_batch')&&(location.origin!=='http://127.0.0.1:6631'||config.recorded?.name!==name||params.has('new')))throw Error('REAL_INPUT_RECORDED_ORIGIN_OR_DATABASE')
const effects = { databaseOpens: [] as string[], foreignDatabase: 0, blockedDatabaseUpgrades: 0, legacyStorage: 0, forbiddenNetwork: 0, writes: 0 }
function preventRecordedDatabaseUpgrade(request: IDBOpenDBRequest) {
  // Register before the legacy store's onupgradeneeded property handler.
  // Aborting the version-change transaction also rolls back creation of a
  // missing database; stopping dispatch prevents the legacy createObjectStore.
  request.addEventListener('upgradeneeded', event => {
    event.stopImmediatePropagation()
    effects.blockedDatabaseUpgrades++
    request.transaction!.abort()
  }, { once: true })
}
const nativeOpen = indexedDB.open.bind(indexedDB), nativeFetch = window.fetch.bind(window)
indexedDB.open = (target: string, version?: number) => {
  if (target !== name) { effects.foreignDatabase++; throw Error('REAL_INPUT_FOREIGN_DATABASE_FORBIDDEN') }
  if ((config.mode === 'recorded_a02' || config.mode === 'recorded_batch') && version !== 1) throw Error('REAL_INPUT_RECORDED_DATABASE_VERSION_FORBIDDEN')
  effects.databaseOpens.push(target)
  const request = nativeOpen(target,version)
  if (config.mode === 'recorded_a02' || config.mode === 'recorded_batch') preventRecordedDatabaseUpgrade(request)
  return request
}
for (const method of ['getItem','setItem','removeItem','clear','key'] as const) Object.defineProperty(Storage.prototype,method,
  {value:()=>{effects.legacyStorage++; throw Error('REAL_INPUT_LEGACY_STORAGE_FORBIDDEN')}})
window.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input),location.href)
  if (url.origin !== location.origin || !(url.pathname.startsWith('/real-input-assets/') || url.pathname.startsWith('/engineering-carriers/')
    || (config.mode==='recorded_batch'?url.pathname==='/api/real-input/recorded-batch':config.mode==='recorded_a02'?url.pathname==='/api/real-input/recorded-a02'
      :url.pathname === '/api/real-input/replay' || url.pathname === '/api/real-input/recognize'))) {
    effects.forbiddenNetwork++; throw Error('REAL_INPUT_NETWORK_FORBIDDEN')
  }
  return nativeFetch(input,{...init,redirect:'error'})
}
XMLHttpRequest.prototype.open = () => { effects.forbiddenNetwork++; throw Error('REAL_INPUT_XHR_FORBIDDEN') }
window.WebSocket = new Proxy(WebSocket,{construct:()=>{effects.forbiddenNetwork++; throw Error('REAL_INPUT_SOCKET_FORBIDDEN')}})
navigator.sendBeacon = () => { effects.forbiddenNetwork++; throw Error('REAL_INPUT_BEACON_FORBIDDEN') }
if ('Notification' in window) {
  window.Notification = new Proxy(Notification,{construct:()=>{throw Error('REAL_INPUT_NOTIFICATION_FORBIDDEN')}})
  Notification.requestPermission = async () => { throw Error('REAL_INPUT_NOTIFICATION_PERMISSION_FORBIDDEN') }
}
const actual = new IsolatedTestStore(name)
let failNext = false
const store: WorkspaceRecordStore & {name: string} = { name,
  read:key=>actual.read(key), write:async(key,value)=>{
    // The existing canonical.save initializes an empty current record. Keep it
    // atomic and forbid replacement; subsequent writes remain transactions.
    await store.transaction(key,raw=>{if(raw!==undefined)throw Error('REAL_INPUT_INITIALIZATION_OVERWRITE_FORBIDDEN');return value})
  },
  remove:async()=>{throw Error('REAL_INPUT_DELETE_FORBIDDEN')}, transactionMany:async()=>{throw Error('REAL_INPUT_MIGRATION_FORBIDDEN')},
  transaction:(key,mutate)=>actual.transaction(key,raw=>{const next=mutate(raw);effects.writes++;
    if(failNext){failNext=false;throw Error('INJECTED_ATOMIC_FAILURE')} return next}) }
const execute: ModelExecutor = config.mode === 'live'
  ? createModelClient({origin:location.origin,capability:config.capability,units:config.units})
  : config.mode==='recorded_a02'||config.mode==='recorded_batch'?async()=>{throw Error('REAL_INPUT_NEW_SEND_DISABLED')}
  : async context => {
    const response = await fetch('/api/real-input/replay',{method:'POST',headers:{'content-type':'application/json','x-real-input-capability':config.capability},
      body:JSON.stringify(context)})
    if (!response.ok) throw Error('只支持已见8通知的明确工程回放，不作真实预测或自动fallback。')
    const value = await response.json() as {label: string; rawHttpText: string}
    if (value.label !== 'seen_engineering_replay' || typeof value.rawHttpText !== 'string') throw Error('REAL_INPUT_REPLAY_IDENTITY')
    return value.rawHttpText
  }
let runtime: Awaited<ReturnType<typeof createRealInputRuntime>>
const download = (value: unknown, filename: string) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}))
  const link = document.createElement('a'); link.href=url; link.download=filename
  document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function EngineeringTools() {
  const [status,setStatus]=useState('尚未操作'), [busy,setBusy]=useState(false), [output,setOutput]=useState<unknown>(null)
  const action=async(work:()=>Promise<unknown>)=>{
    if(busy)return;setBusy(true);setOutput(null)
    try{const result=await work();setOutput(result);setStatus('本次本机操作完成；尚未代表产品旅程或模型质量通过')}
    catch(error){setStatus(error instanceof Error?error.message:'本机操作失败，现场保留')}
    finally{setBusy(false)}
  }
  const repository=()=>SemanticRepository.open(name,store,undefined,'real-input-01')
  return <details aria-label="真实输入工程工具" style={{position:'fixed',left:8,top:8,zIndex:2000,maxWidth:'min(680px,90vw)',maxHeight:'65vh',overflow:'auto',background:'white',padding:12,border:'1px solid #163b41'}}>
    <summary>真实输入工程工具（不是用户确认入口）</summary>
    <p>{config.mode==='recorded_batch'?`${config.batch?.length??0}份已记录真实模型响应 · 本页零调用，原回答不改`:config.mode==='recorded_a02'?'A02历史真实模型响应 · 本轮零调用，不是人工预测':config.mode==='live'?'已绑定真实调用模式':'零调用工程回放模式'}。浏览器时区{Intl.DateTimeFormat().resolvedOptions().timeZone}；业务时区Asia/Shanghai。{name}</p>
    {config.mode==='recorded_batch'&&config.batch?.map(identity=><button key={identity.unitId} disabled={busy} onClick={()=>void action(async()=>{
      const response=await fetch('/api/real-input/recorded-batch',{method:'POST',headers:{'content-type':'application/json','x-real-input-capability':config.capability},
        body:JSON.stringify({unitId:identity.unitId,requestSha:identity.requestSha})})
      if(!response.ok)throw Error('REAL_INPUT_BATCH_RECORD_UNAVAILABLE')
      const record=await response.json() as RecordedBatch|RecordedCandidate02|RecordedCandidate03
      const saved=record.version==='recorded-candidate03-1'&&config.candidate03
        ?await replayRecordedCandidate03(await repository(),record,identity)
        :record.version==='recorded-candidate02-1'&&config.candidate02
        ?await replayRecordedCandidate02(await repository(),record,identity)
        :await replayRecordedBatch(await repository(),record as RecordedBatch,identity)
      const savedDraft=record.version==='recorded-candidate02-1'||record.version==='recorded-candidate03-1'
        ?saved.extractionDrafts.find(d=>{const pending=d.legacyData?.realInputPending;return pending&&typeof pending==='object'&&!Array.isArray(pending)&&pending.operationId===record.version.replace(/-1$/,'-')+record.unitId})
        :undefined
      return {unitId:identity.unitId,label:'原模型响应，非新预测/人工替身',tasks:saved.tasks.length,...(savedDraft?{draftId:savedDraft.id}:{originalDraftId:record.handle.draftId}),
        next:'刷新后从收件箱核对；保留原答错误，未自动选择或确认'}
    })}>载入{identity.unitId}原回答（零调用）</button>)}
    {config.mode==='recorded_a02'&&<button disabled={busy} onClick={()=>void action(async()=>{
      // A random, never-committed probe exercises the actual browser's upgrade
      // transaction. It is not a replacement workspace and never gets a store.
      const probeName=name+'-aborted-open-probe-'+crypto.randomUUID()
      const upgrades:number[]=[]
      let legacyHandlerCalls=0
      const probe=()=>new Promise<void>((resolve,reject)=>{
        const request=nativeOpen(probeName,1)
        request.addEventListener('upgradeneeded',event=>upgrades.push(event.oldVersion))
        preventRecordedDatabaseUpgrade(request)
        request.onupgradeneeded=()=>{legacyHandlerCalls++}
        request.onsuccess=()=>{request.result.close();reject(Error('REAL_INPUT_PROBE_UNEXPECTED_SUCCESS'))}
        request.onerror=()=>request.error?.name==='AbortError'?resolve():reject(Error('REAL_INPUT_PROBE_UNEXPECTED_ERROR'))
        request.onblocked=()=>reject(Error('REAL_INPUT_PROBE_BLOCKED'))
      })
      await probe();await probe()
      if(upgrades.length!==2||upgrades.some(version=>version!==0)||legacyHandlerCalls!==0)throw Error('REAL_INPUT_PROBE_NOT_ROLLED_BACK')
      const value=await new CanonicalWorkspaceRepository(new IsolatedTestStore(name)).load()
      if(!value)throw Error('INDEPENDENT_DATABASE_MISSING')
      await validateSemanticWorkspace(value,'real-input-01')
      return {name,probeName,engine:'actual Edge IndexedDB',upgrades,legacyHandlerCalls,
        probeDatabasePersisted:false,originalRepositorySha256:await sha256Text(JSON.stringify(value)),
        note:'两次真实升级事件均中止，第二次oldVersion仍0；原库独立只读打开成功。没有建表、清库或写入工作区。'}
    })}>检验缺失库不会创建（真实IndexedDB，仅中止事务）</button>}
    {config.mode==='recorded_a02'&&<button disabled={busy} onClick={()=>void action(async()=>{
      const response=await fetch('/api/real-input/recorded-a02',{method:'POST',headers:{'content-type':'application/json','x-real-input-capability':config.capability},
        body:JSON.stringify({unitId:'A02',requestSha:config.recorded!.requestSha})})
      if(!response.ok)throw Error('REAL_INPUT_RECORDED_UNAVAILABLE')
      const record=await response.json() as RecordedA02;await validateRecordedA02(record)
      if(record.name!==name||record.requestSha!==config.recorded!.requestSha||record.responseSha!==config.recorded!.responseSha)throw Error('REAL_INPUT_RECORDED_IDENTITY')
      const saved=await replayRecordedA02(await repository(),record)
      return {label:'历史A02原响应，来源身份仍为live_model_candidate；不是新预测',sourceId:record.handle.sourceId,draftId:record.handle.draftId,
        tasks:saved.tasks.length,materialReview:'须由用户分别核对并保存',next:'刷新页面后从收件箱打开A02；未自动确认任何任务'}
    })}>载入已记录A02建议（零模型调用）</button>}
    <p>下列格式读取只使用旧8通知的工程载体，不是盲测。读取结果仍需校对；这里不从参考正文自动修正OCR。</p>
    {config.carriers.map(c=><div key={c.unitId}><span>{c.unitId} {c.name} </span>
      <button disabled={busy} onClick={()=>void action(async()=>{
        const response=await fetch(c.url);if(!response.ok)throw Error('ENGINEERING_CARRIER_MISSING')
        const bytes=await response.arrayBuffer(), digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')
        if(digest!==c.sha256)throw Error('ENGINEERING_CARRIER_CHANGED')
        const acquired=await acquireFile(c.unitId,new File([bytes],c.name,{type:c.mime}),{resources:config.resources,signal:new AbortController().signal,isCurrent:()=>true,
          onProgress:p=>setStatus(p.message)})
        if(!acquired?.receipt)throw Error('ENGINEERING_READING_FAILED')
        if(config.candidate02)return {unitId:c.unitId,receipt:acquired.receipt,result:acquired.result,
          note:'新候选轮本机读取复验；没有覆盖原读取/校对/发送记录，没有写库或发送模型。'}
        const repo=await repository(), handle=await repo.saveReading(acquired.receipt,c.unitId+'工程文件','engineering-'+c.unitId)
        return {unitId:c.unitId,handle,receipt:acquired.receipt,result:acquired.result}
      })}>本机读取{c.unitId}</button>
      <details><summary>旧工程正文（校对参考，不是模型答案）</summary><p>{c.sourceText}</p></details></div>)}
    <button disabled={busy||config.mode==='recorded_a02'||config.mode==='recorded_batch'} onClick={()=>void action(async()=>{
      if(config.mode==='recorded_a02'||config.mode==='recorded_batch')throw Error('REAL_INPUT_NEW_SOURCE_DISABLED')
      const repo=await repository(), handles=[]
      for(const c of config.carriers){const unitId=c.unitId.replace('B','A'),receipt=await acquireText(unitId,c.sourceText)
        handles.push({unitId,handle:await repo.saveReading(receipt,unitId+'工程文字','engineering-'+unitId)})}
      return {handles,source:'旧8通知文字；仅保存Source，没有模型请求/正式任务'}
    })}>保存A组工程文字来源（零调用）</button>
    <button disabled={busy} onClick={()=>void action(async()=>{
      const value=await new CanonicalWorkspaceRepository(new IsolatedTestStore(name)).load()
      if(!value)throw Error('INDEPENDENT_DATABASE_MISSING')
      await validateSemanticWorkspace(value,'real-input-01')
      return {origin:location.origin,name,source:'new CanonicalWorkspaceRepository(new IsolatedTestStore(name)).load()',
        sha256:await sha256Text(JSON.stringify(value)),workspace:value,effects,
        realJobs:buildBrowserReminderJobs(runtime.view(value).tasks,new Date()).length}
    })}>独立仓储读回全对象</button>
    <button disabled={busy} onClick={()=>{failNext=true;setStatus('下一事务写入前失败；不影响已经保存的记录')}}>设置下一笔事务故障</button>
    <button disabled={busy||config.mode==='recorded_a02'||config.mode==='recorded_batch'} onClick={()=>void action(async()=>{
      if(config.mode==='recorded_a02'||config.mode==='recorded_batch')throw Error('REAL_INPUT_NEW_PREPARATION_DISABLED')
      const repo=await repository(), workspace=await repo.load(), preparations=[]
      const ids=['A','B'].flatMap(arm=>config.carriers.map(c=>c.unitId.replace('B',arm)))
      // Preparation is a separate engineering action, never a paid dispatch or human review claim.
      for(const id of ids){const source=workspace.sources.find(s=>s.legacyData?.captureOperationId==='engineering-'+id)
        if(!source)throw Error('PREPARE_SOURCE_MISSING_'+id)
        const receipt=readingOf(source.legacyData?.realInput01).inputReceipt
        const pages=receipt.pages.map(p=>p.number)
        await makeSendSnapshot(receipt,pages,pages,new Date().toISOString())}
      for(const id of ids){const current=await repo.load(),source=current.sources.find(s=>s.legacyData?.captureOperationId==='engineering-'+id)!
        const {handle,reading,context}=await prepareInputRun(repo,source.id,'prepare-'+id)
        const request=await buildModelRequest(context)
        preparations.push({unitId:id,handle,context,reading,requestText:request.serialized})}
      return {version:'real-input-local-preparation-1',origin:location.origin,name,preparations,
        note:'工程输入准备；页面范围核对标记不是真人研究。零模型调用。冻结前仍须核对实际提取与校对。'}
    })}>准备A/B来源与请求（不发送模型）</button>
    <button disabled={busy||!output} onClick={()=>download(output,'real-input-local-evidence.json')}>下载本次工程证据JSON</button>
    <p role="status">{status}</p><pre aria-label="本次工程证据">{output?JSON.stringify(output):'尚无本次结果'}</pre>
  </details>
}
async function mount() {
  runtime=await createRealInputRuntime({name,store,initial:params.get('new')==='1'?emptyRealInputWorkspace(name):undefined,
    execution:config.mode==='recorded_a02'||config.mode==='recorded_batch'?'live':config.mode,resources:config.resources,execute,
    ...(config.mode==='recorded_a02'?{recordedA02:true as const}:config.mode==='recorded_batch'?{recordedBatch:true as const,...(config.candidate02?{recordedCandidate02:true as const}:{}),...(config.candidate03?{recordedCandidate03:true as const}:{})}:{})})
  params.delete('new');history.replaceState(null,'','/?'+params.toString())
  createRoot(document.getElementById('root')!).render(<><App runtime={runtime}/><EngineeringTools/></>)
}
void mount().catch(error=>{
  const code=error instanceof Error&&/^[A-Z][A-Z0-9_]{1,100}$/.test(error.message)?error.message:'DETAIL_NOT_EXPOSED'
  document.getElementById('root')!.textContent='隔离入口无法加载或校验测试库；已停止，没有回退用户数据库。错误码：'+code
})
