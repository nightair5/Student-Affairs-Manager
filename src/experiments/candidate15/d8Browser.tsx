import {createRoot} from 'react-dom/client'
import {useState} from 'react'
import App from '../../App'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import '../candidate11/preview.css'
import {IsolatedTestStore} from '../mainline01/isolatedStore'
import {sha256Text} from '../realInput01/inputReceipt'
import {createD8Runtime} from './d8Runtime'
import type {D8ReplayRecord} from './d8Replay'

declare const __D8_CONFIG__:{origin:string;database:string;records:Array<{id:string;label:string;kind:D8ReplayRecord['kind'];sha256:string}>}
const config=__D8_CONFIG__
if(location.origin!==config.origin||location.hostname!=='127.0.0.1'||(location.search&&location.search!=='?automation=1'))throw Error('D8_ORIGIN_REQUIRED')
const nativeOpen=indexedDB.open.bind(indexedDB),nativeFetch=window.fetch.bind(window)
indexedDB.open=(name,version)=>{if(name!==config.database||version!==1)throw Error('D8_DATABASE_FORBIDDEN');return nativeOpen(name,version)}
for(const method of ['getItem','setItem','removeItem','clear','key'] as const)Object.defineProperty(Storage.prototype,method,{value:()=>{throw Error('D8_LEGACY_STORAGE_FORBIDDEN')}})
window.fetch=(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin!==config.origin||url.search||!config.records.some(record=>url.pathname==='/records/'+record.id+'.json')||(init?.method??'GET')!=='GET')throw Error('D8_NETWORK_DISABLED');return nativeFetch(input,{...init,redirect:'error'})}
XMLHttpRequest.prototype.open=()=>{throw Error('D8_XHR_DISABLED')};window.WebSocket=new Proxy(WebSocket,{construct:()=>{throw Error('D8_SOCKET_DISABLED')}});navigator.sendBeacon=()=>{throw Error('D8_BEACON_DISABLED')}
const root=createRoot(document.getElementById('root')!)
async function start(){
  const transport=new IsolatedTestStore(config.database),app=await createD8Runtime({transport,choices:config.records,origin:location.search==='?automation=1'?'AUTOMATION':'ENGINEERING_REPLAY',read:async id=>{const item=config.records.find(record=>record.id===id);if(!item)throw Error('D8_RECORD_ID');const response=await fetch('/records/'+id+'.json'),text=await response.text();if(!response.ok||await sha256Text(text)!==item.sha256)throw Error('D8_RECORD_HASH');return JSON.parse(text) as D8ReplayRecord}})
  function Tools(){const [status,setStatus]=useState(''),[download,setDownload]=useState<string>();return <details className="c11-tools" open><summary>D10工程回放验收工具</summary><p>独立数据库：{config.database}。原6633等入口及其数据不会被读取或修改。</p>
    <button type="button" onClick={()=>{app.observed.failNext();setStatus('下一次工作区写入将中止；原数据与草稿保留。')}}>模拟下一次保存失败</button>
    <button type="button" onClick={()=>{void(async()=>{const workspace=await app.independentReadback(),events=await app.observed.events(),metricEntries=await Promise.all((workspace?.extractionDrafts??[]).map(async draft=>[draft.id,await app.metrics.events(draft.id)] as const)),metricEvents=Object.fromEntries(metricEntries);if(download)URL.revokeObjectURL(download);setDownload(URL.createObjectURL(new Blob([JSON.stringify({workspace,events,metricEvents},null,2)],{type:'application/json'})));setStatus(`独立读回：${workspace?.tasks.length??0}个正式任务，${workspace?.projects.length??0}个项目，${workspace?.events.length??0}个事件，${workspace?.timePoints.length??0}个时间，${workspace?.extractionDrafts.length??0}个草稿，${events.length}条工程事件，${metricEntries.reduce((n,[,rows])=>n+rows.length,0)}条计时事件。不计作真人指标。`)})().catch(()=>setStatus('独立读回失败。'))}}>独立读回与导出</button>
    {download&&<a href={download} download="candidate15-d8-engineering-readback.json">下载匿名验收记录</a>}<p role="status">{status}</p></details>}
  root.render(<><Tools/><App runtime={app.runtime}/></>)}
void start().catch(()=>root.render(<main><h1>D8工程回放入口未能打开</h1><p role="alert">数据库或运行身份校验失败。没有退回旧库，也没有清空数据。</p></main>))
