import {createRoot} from 'react-dom/client'
import {useState} from 'react'
import App from '../../App'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import './preview.css'
import {IsolatedTestStore} from '../mainline01/isolatedStore'
import {sha256Text} from '../realInput01/inputReceipt'
import {createCandidate11Runtime} from './runtime'
import {C11_DATABASE} from './observation'
import type {C11ReplayRecord} from './replay'

declare const __C11_CONFIG__:{origin:string;records:Array<{id:string;label:string;kind:C11ReplayRecord['kind'];sha256:string}>}
const config=__C11_CONFIG__
if(location.origin!==config.origin||location.hostname!=='127.0.0.1'||(location.search&&location.search!=='?automation=1'))throw Error('C11_ORIGIN_REQUIRED')
const nativeOpen=indexedDB.open.bind(indexedDB),nativeFetch=window.fetch.bind(window)
indexedDB.open=(name,version)=>{if(name!==C11_DATABASE||version!==1)throw Error('C11_DATABASE_FORBIDDEN');return nativeOpen(name,version)}
for(const method of ['getItem','setItem','removeItem','clear','key'] as const)Object.defineProperty(Storage.prototype,method,{value:()=>{throw Error('C11_LEGACY_STORAGE_FORBIDDEN')}})
window.fetch=(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href)
  if(url.origin!==config.origin||url.search||!(config.records.some(r=>url.pathname==='/records/'+r.id+'.json'))||(init?.method??'GET')!=='GET')throw Error('C11_NETWORK_DISABLED')
  return nativeFetch(input,{...init,redirect:'error'})
}
XMLHttpRequest.prototype.open=()=>{throw Error('C11_XHR_DISABLED')}
window.WebSocket=new Proxy(WebSocket,{construct:()=>{throw Error('C11_SOCKET_DISABLED')}})
navigator.sendBeacon=()=>{throw Error('C11_BEACON_DISABLED')}
if('Notification'in window){window.Notification=new Proxy(Notification,{construct:()=>{throw Error('C11_NOTIFICATION_DISABLED')}});Notification.requestPermission=async()=>{throw Error('C11_NOTIFICATION_DISABLED')}}
const root=createRoot(document.getElementById('root')!)
async function start(){
  const transport=new IsolatedTestStore(C11_DATABASE)
  const app=await createCandidate11Runtime({transport,choices:config.records,origin:location.search==='?automation=1'?'AUTOMATION':'ENGINEERING_REPLAY',read:async id=>{
    const item=config.records.find(record=>record.id===id);if(!item)throw Error('C11_RECORD_ID')
    const response=await fetch('/records/'+id+'.json'),text=await response.text()
    if(!response.ok||await sha256Text(text)!==item.sha256)throw Error('C11_RECORD_HASH')
    return JSON.parse(text) as C11ReplayRecord
  }})
  function Tools(){
    const [status,setStatus]=useState(''),[download,setDownload]=useState<string>()
    return <details className="c11-tools"><summary>C11 本地验收工具</summary>
      <p>独立数据库：{C11_DATABASE}。原入口数据不在本页。模型效果 NOT_RUN；真人收益未观测。</p>
      <button type="button" onClick={()=>{app.observed.failNext();setStatus('下一次工作区写入将中止；原数据与草稿保留。')}}>模拟下一次保存失败</button>
      <button type="button" onClick={()=>{void(async()=>{
        const workspace=await app.independentReadback(),events=await app.observed.events()
        if(download)URL.revokeObjectURL(download)
        setDownload(URL.createObjectURL(new Blob([JSON.stringify({workspace,events},null,2)],{type:'application/json'})))
        setStatus(`独立读回：${workspace?.tasks.length??0} 个正式任务，${workspace?.extractionDrafts.length??0} 个草稿，${events.length} 条本地事件。成功提交 ${events.filter(e=>e.kind==='commit_succeeded').length}；提交失败 ${events.filter(e=>e.kind==='commit_failed').length}；拒绝 ${events.filter(e=>e.kind==='rejected').length}；读回通过 ${events.filter(e=>e.kind==='readback_verified').length}。记录类型：${[...new Set(events.map(e=>e.origin))].join('、')}，不计作真人转化率。`)
      })().catch(()=>setStatus('独立读回失败，未记录成功。'))}}>独立读回与导出本地验收记录</button>
      {download&&<a href={download} download="candidate11-engineering-readback.json">下载匿名验收记录</a>}<p role="status">{status}</p>
    </details>
  }
  root.render(<><Tools/><App runtime={app.runtime}/></>)
}
void start().catch(()=>root.render(<main><h1>C11 独立入口未能打开</h1><p role="alert">数据库或运行身份校验失败。没有退回旧库，也没有清空任何数据。</p></main>))
