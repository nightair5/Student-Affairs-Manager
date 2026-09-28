import {createRoot} from 'react-dom/client'
import {useEffect,useState} from 'react'
import App from '../../App'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import '../candidate11/preview.css'
import {IsolatedTestStore} from '../mainline01/isolatedStore'
import {sha256Text} from '../realInput01/inputReceipt'
import {createD13Runtime} from './runtime'
import {calculateLowEditV2,D14_DATABASE} from './measurement'
import {beginTrial,loadTrial,trialAction,metricEntry,type Trial} from './d14Trial'
import type {D13ReplayRecord} from './replay'

declare const __D14_CONFIG__:{origin:string;database:string;records:Array<{id:string;label:string;kind:D13ReplayRecord['kind'];sha256:string}>}
const config=__D14_CONFIG__
if(location.origin!==config.origin||location.hostname!=='127.0.0.1'||config.database!==D14_DATABASE||!['','?automation=1'].includes(location.search))throw Error('D14_ORIGIN_REQUIRED')
const nativeOpen=indexedDB.open.bind(indexedDB),nativeFetch=window.fetch.bind(window)
indexedDB.open=(name,version)=>{if(name!==D14_DATABASE||version!==1)throw Error('D14_DATABASE_FORBIDDEN');return nativeOpen(name,version)}
for(const method of ['getItem','setItem','removeItem','clear','key'] as const)Object.defineProperty(Storage.prototype,method,{value:()=>{throw Error('D14_OLD_STORAGE_DISABLED')}})
window.fetch=(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin!==config.origin||url.search||!config.records.some(r=>url.pathname==='/records/'+r.id+'.json')||(init?.method??'GET')!=='GET')throw Error('D14_NETWORK_DISABLED');return nativeFetch(input,{...init,redirect:'error'})}
XMLHttpRequest.prototype.open=()=>{throw Error('D14_XHR_DISABLED')};window.WebSocket=new Proxy(WebSocket,{construct:()=>{throw Error('D14_SOCKET_DISABLED')}});navigator.sendBeacon=()=>{throw Error('D14_BEACON_DISABLED')}
const root=createRoot(document.getElementById('root')!)

async function start(){
  const transport=new IsolatedTestStore(config.database)
  const read=async(id:string)=>{const item=config.records.find(r=>r.id===id);if(!item)throw Error('D14_RECORD_ID');const response=await fetch('/records/'+id+'.json'),body=await response.text();if(!response.ok||await sha256Text(body)!==item.sha256)throw Error('D14_RECORD_HASH');return JSON.parse(body) as D13ReplayRecord}
  const app=await createD13Runtime({transport,choices:config.records,read,beforeOpen:async record=>{const t=await loadTrial(transport);if(t?.status!=='started'||t.recordId!==record.id||t.stimulusSha256!==record.responseSha256)throw Error('D14_TRIAL_STIMULUS_MISMATCH')},onOpen:async(record,draftId)=>{const active=await loadTrial(transport);if(active?.status==='started'&&active.recordId===record.id&&!active.draftId)await trialAction(transport,active.id,'attach',draftId)},onDisposition:async draftId=>{const active=await loadTrial(transport);if(active?.status==='started'&&active.draftId===draftId)await trialAction(transport,active.id,'complete',draftId)}})
  document.addEventListener('visibilitychange',()=>{void app.metrics.visibility(document.hidden)})
  for(const draft of (await app.repository.load()).extractionDrafts)if((await app.metrics.events(draft.id)).length)await app.metrics.restore(draft.id)
  function Tools(){
    const [trial,setTrial]=useState<Trial|undefined>(),[status,setStatus]=useState(''),[condition,setCondition]=useState<'manual'|'assisted'>('assisted'),[recordId,setRecordId]=useState('d13-fixture-no-task'),[report,setReport]=useState(''),[url,setUrl]=useState<string>()
    useEffect(()=>{void loadTrial(transport).then(setTrial).catch(e=>setStatus(String(e)))},[])
    const act=async(kind:'pause'|'resume'|'exit')=>{if(!trial)return;setTrial(await trialAction(transport,trial.id,kind));setStatus('试次状态已持久化：'+kind)}
    const selected=config.records.find(r=>r.id===recordId)??config.records[0]
    const run=async(fn:()=>Promise<void>)=>{try{await fn()}catch(e){setStatus(e instanceof Error?e.message:'操作失败')}}
    return <details className="c11-tools" open><summary>D14 隔离试次与工程测量</summary><p><strong>匿名工程回放 / 非真人试用</strong>。数据库：{config.database}。未进行新模型请求；真人四项指标均不可观测。</p>
      <p>试次身份：{trial?.id??'尚未开始'}；状态：{trial?.status??'NOT_RUN'}；条件：{trial?.condition??'未选'}。</p>
      {!trial&&<div><label>条件 <select value={condition} onChange={e=>setCondition(e.target.value as 'manual'|'assisted')}><option value="assisted">固定辅助建议</option><option value="manual">从空白手动录入</option></select></label><label>匿名通知 <select value={recordId} onChange={e=>setRecordId(e.target.value)}>{config.records.filter(r=>r.kind==='ENGINEERING_FIXTURE'&&!r.id.includes('-manual-')).map(r=><option value={r.id} key={r.id}>{r.label}</option>)}</select></label>
        <button onClick={()=>{void run(async()=>{const r=await read(selected.id),stimulus=condition==='manual'?await read('d13-fixture-manual-'+selected.id.slice('d13-fixture-'.length)):r,t=await beginTrial(transport,condition,r.context.index.sourceContent,stimulus.id,stimulus.responseSha256);setTrial(t);setStatus('请在下方快速录入中选择“'+stimulus.label+'”，走同一编辑、确认和 canonical 保存链。')})}}>开始隔离工程试次</button></div>}
      {trial?.status==='started'&&<button onClick={()=>{void run(()=>act('pause'))}}>暂停</button>}{trial?.status==='paused'&&<button onClick={()=>{void run(()=>act('resume'))}}>继续</button>}{trial&&['started','paused'].includes(trial.status)&&<button onClick={()=>{void run(()=>act('exit'))}}>退出</button>}
      {trial&&['completed','exited'].includes(trial.status)&&<button onClick={()=>{setTrial(undefined);setStatus('上一试次保留在隔离库，可开始下一匿名工程试次。')}}>开始下一试次</button>}
      {trial?.condition==='manual'&&trial.status==='started'&&<p>空白手动基线：{trial.sourceText}。在下方快速录入选择“空白手动”夹具，再用“依据原文补充漏任务”逐项录入；没有模型建议，确认后走正式隔离库的同一保存与读回链。</p>}
      {trial?.condition==='assisted'&&trial.status==='started'&&<p>辅助刺激已锁定。在下方“快速录入”选择本试次对应夹具，核对、拒绝或确认；页面编辑、保存和独立读回进入同一隔离库。首次输出 SHA 已固定。</p>}
      <button onClick={()=>{app.observed.failNext();setStatus('下次工作区保存将失败；请在页面手动重试。')}}>注入下一次工作区保存失败</button>
      <button onClick={()=>{void run(async()=>{const workspace=await app.independentReadback(),current=await loadTrial(transport),trace=current?.draftId?await app.metrics.events(current.draftId):[],metric=current?.draftId?calculateLowEditV2(trace):null,reportData={role:'ENGINEERING_REPLAY',trial:current,workspaceCounts:{sources:workspace.sources.length,drafts:workspace.extractionDrafts.length,tasks:workspace.tasks.length,projects:workspace.projects.length,events:workspace.events.length,timePoints:workspace.timePoints.length},trace,metric:metricEntry(current,metric),original:current?.draftId?await transport.read('d13-original:'+current.draftId):null,humanTrial:'NOT_RUN'};const body=JSON.stringify(reportData,null,2);setReport(body);if(url)URL.revokeObjectURL(url);setUrl(URL.createObjectURL(new Blob([body],{type:'application/json'})));setTrial(current);setStatus(`独立读回：Task ${workspace.tasks.length}，Project ${workspace.projects.length}，Event ${workspace.events.length}，TimePoint ${workspace.timePoints.length}。`)})}}>独立读回与四指标状态</button>
      {url&&<a href={url} download="d14-engineering-trial.json">下载匿名工程证据</a>}<p role="status">{status}</p>{report&&<details><summary>查看隔离库读回</summary><pre aria-label="D14独立读回JSON" style={{maxHeight:260,overflow:'auto'}}>{report}</pre></details>}
    </details>
  }
  root.render(<><Tools/><App runtime={app.runtime}/></>)
}
void start().catch(e=>root.render(<main><h1>D14隔离试次未能打开</h1><p role="alert">{e instanceof Error?e.message:'初始化失败'}。未退回旧库、未清空数据。</p></main>))
