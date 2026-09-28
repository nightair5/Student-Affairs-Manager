import {createRoot} from 'react-dom/client'
import {useState} from 'react'
import App from '../../App'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import '../candidate11/preview.css'
import {IsolatedTestStore} from '../mainline01/isolatedStore'
import {sha256Text} from '../realInput01/inputReceipt'
import {createD13Runtime} from './runtime'
import {calculateLowEditV2,D13_DATABASE} from './measurement'
import type {D13ReplayRecord} from './replay'

declare const __D13_CONFIG__:{origin:string;database:string;records:Array<{id:string;label:string;kind:D13ReplayRecord['kind'];sha256:string}>}
const config=__D13_CONFIG__
if(location.origin!==config.origin||location.hostname!=='127.0.0.1'||config.database!==D13_DATABASE||!['','?automation=1'].includes(location.search))throw Error('D13_ORIGIN_REQUIRED')
const nativeOpen=indexedDB.open.bind(indexedDB),nativeFetch=window.fetch.bind(window)
indexedDB.open=(name,version)=>{if(name!==D13_DATABASE||version!==1)throw Error('D13_DATABASE_FORBIDDEN');return nativeOpen(name,version)}
for(const method of ['getItem','setItem','removeItem','clear','key'] as const)Object.defineProperty(Storage.prototype,method,{value:()=>{throw Error('D13_OLD_STORAGE_DISABLED')}})
window.fetch=(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin!==config.origin||url.search||!config.records.some(r=>url.pathname==='/records/'+r.id+'.json')||(init?.method??'GET')!=='GET')throw Error('D13_NETWORK_DISABLED');return nativeFetch(input,{...init,redirect:'error'})}
XMLHttpRequest.prototype.open=()=>{throw Error('D13_XHR_DISABLED')};window.WebSocket=new Proxy(WebSocket,{construct:()=>{throw Error('D13_SOCKET_DISABLED')}});navigator.sendBeacon=()=>{throw Error('D13_BEACON_DISABLED')}
const root=createRoot(document.getElementById('root')!)
async function start(){
  const transport=new IsolatedTestStore(config.database),app=await createD13Runtime({transport,choices:config.records,read:async id=>{
    const r=config.records.find(r=>r.id===id);if(!r)throw Error('D13_RECORD_ID');const response=await fetch('/records/'+id+'.json'),text=await response.text()
    if(!response.ok||await sha256Text(text)!==r.sha256)throw Error('D13_RECORD_HASH');return JSON.parse(text) as D13ReplayRecord
  }})
  document.addEventListener('visibilitychange',()=>{void app.metrics.visibility(document.hidden)})
  for(const draft of (await app.repository.load()).extractionDrafts)if((await app.metrics.events(draft.id)).length)await app.metrics.restore(draft.id)
  function Tools(){const [status,setStatus]=useState(''),[url,setUrl]=useState<string>(),[summary,setSummary]=useState(''),[reportText,setReportText]=useState('')
    return <details className="c11-tools" open><summary>D13工程回放与测量</summary><p>工程回放 / 录制回答 / 非真人试用。独立数据库：{config.database}</p>
      <button onClick={()=>{app.observed.failNext();setStatus('下一次保存将原子失败；需手动重试。')}}>模拟下一次保存失败</button>
      <button onClick={()=>{void (async()=>{const workspace=await app.independentReadback(),events=await app.metrics.events(),metrics=workspace.extractionDrafts.map(d=>({draftId:d.id,...calculateLowEditV2(events.filter(e=>e.draftId===d.id))}))
        const originals=await Promise.all(workspace.extractionDrafts.map(async d=>({draftId:d.id,record:await transport.read('d13-original:'+d.id)})))
        const report={role:'ENGINEERING_REPLAY',workspace,originals,events,metrics,humanMetrics:'NOT_OBSERVABLE'}
        setReportText(JSON.stringify(report,null,2))
        if(url)URL.revokeObjectURL(url);setUrl(URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})))
        setStatus(`独立读回：任务 ${workspace.tasks.length}，项目 ${workspace.projects.length}，事件 ${workspace.events.length}，时间 ${workspace.timePoints.length}，草稿 ${workspace.extractionDrafts.length}。`)
        setSummary(JSON.stringify(metrics,null,2))
      })().catch(e=>setStatus(e instanceof Error?e.message:'读回失败'))}}>独立读回与测量导出</button>
      {url&&<a href={url} download="d13-engineering-readback.json">下载匿名工程证据</a>}<p role="status">{status}</p><pre style={{maxHeight:240,overflow:'auto'}}>{summary}</pre>
      {reportText&&<details><summary>查看完整匿名读回 JSON</summary><pre aria-label="完整匿名工程读回JSON" style={{maxHeight:240,overflow:'auto'}}>{reportText}</pre></details>}
    </details>}
  root.render(<><Tools/><App runtime={app.runtime}/></>)
}
void start().catch(e=>root.render(<main><h1>D13工程入口未能打开</h1><p role="alert">{e instanceof Error?e.message:'初始化失败'}。未退回旧库、未自动清空数据。</p></main>))
