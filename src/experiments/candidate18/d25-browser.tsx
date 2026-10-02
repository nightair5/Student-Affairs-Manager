import {createRoot} from 'react-dom/client'
import {useState} from 'react'
import App from '../../App'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import '../candidate11/preview.css'
import {IsolatedTestStore} from '../mainline01/isolatedStore'
import {sha256Text} from '../realInput01/inputReceipt'
import {createD13Runtime} from '../candidate16/runtime'
import {calculateLowEditV2,D24_CORRECTION_VERSION} from '../candidate16/measurement'
import {calculateD22Engineering} from '../candidate16/d22Measurement'
import type {ReviewSession} from '../candidate16/d20ReviewSession'
import type {D13ReplayRecord} from '../candidate16/replay'
import {effectiveStateFacts,stateOfRuntime} from '../mainline05/semanticState'
import {inspectFirstSuggestion} from '../realInput01/firstSuggestionGuard'
declare const __D25_CONFIG__:{origin:string;database:string;buildIdentity:string;records:Array<{id:string;label:string;kind:D13ReplayRecord['kind'];sha256:string}>}
const config=__D25_CONFIG__
if(location.origin!==config.origin||location.hostname!=='127.0.0.1'||!/^rco-mainline-01-02-i1-real-input-d23-study-engineering-d25-[a-z0-9]{2,18}$/.test(config.database)||!['','?automation=1'].includes(location.search))throw Error('D25_ORIGIN_REQUIRED')
const nativeOpen=indexedDB.open.bind(indexedDB),nativeFetch=window.fetch.bind(window)
indexedDB.open=(name,version)=>{if(name!==config.database||version!==1)throw Error('D25_DATABASE_FORBIDDEN');return nativeOpen(name,version)}
for(const method of ['getItem','setItem','removeItem','clear','key'] as const)Object.defineProperty(Storage.prototype,method,{value:()=>{throw Error('D25_OLD_STORAGE_DISABLED')}})
window.fetch=(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin!==config.origin||url.search||!config.records.some(r=>url.pathname==='/records/'+r.id+'.json')||(init?.method??'GET')!=='GET')throw Error('D25_NETWORK_DISABLED');return nativeFetch(input,{...init,redirect:'error'})}
XMLHttpRequest.prototype.open=()=>{throw Error('D25_XHR_DISABLED')};window.WebSocket=new Proxy(WebSocket,{construct:()=>{throw Error('D25_SOCKET_DISABLED')}});navigator.sendBeacon=()=>{throw Error('D25_BEACON_DISABLED')}
const root=createRoot(document.getElementById('root')!)
async function start(){
  const transport=new IsolatedTestStore(config.database),read=async(id:string)=>{const item=config.records.find(r=>r.id===id);if(!item)throw Error('D25_RECORD_ID');const r=await fetch('/records/'+id+'.json'),text=await r.text();if(!r.ok||await sha256Text(text)!==item.sha256)throw Error('D25_RECORD_HASH');return JSON.parse(text) as D13ReplayRecord}
  const app=await createD13Runtime({transport,choices:config.records,read,sourceSession:true,buildLabel:'D25首次建议机制工程验收',correctionVersion:D24_CORRECTION_VERSION})
  document.addEventListener('visibilitychange',()=>{void app.metrics.visibility(document.hidden)})
  for(const d of (await app.repository.load()).extractionDrafts)if((await app.metrics.events(d.id)).length)await app.metrics.restore(d.id)
  function Tools(){
    const [report,setReport]=useState(''),[status,setStatus]=useState('')
    const readback=async()=>{try{
      const w=await app.independentReadback(),drafts=await Promise.all(w.extractionDrafts.map(async d=>{
        const trace=await app.metrics.events(d.id),session=await transport.read('d20-review-session:'+d.id) as ReviewSession|undefined
        const audit={draftId:d.id,status:d.status,originalModelOrFixture:await transport.read('d13-original:'+d.id),trace,lowEdit:calculateLowEditV2(trace),engineering:calculateD22Engineering(trace,session,'assisted')}
        try { const state=stateOfRuntime(w,d.id),currentFacts=effectiveStateFacts(state).facts;return {...audit,programConvertedFirstFacts:state.rawResponse,currentFacts,issues:inspectFirstSuggestion(currentFacts)} }
        catch { return {...audit,firstFactsStatus:'NOT_PARSEABLE',currentFactsStatus:'NOT_AVAILABLE',failure:w.recognitionRuns.find(r=>r.id===d.recognitionRunId)?.errorCode??null} }
      }))
      setReport(JSON.stringify({role:'ENGINEERING_REPLAY',buildIdentity:config.buildIdentity,database:config.database,modelCalls:0,humanMetrics:'NOT_OBSERVABLE',counts:{Task:w.tasks.length,Project:w.projects.length,Event:w.events.length,TimePoint:w.timePoints.length},canonical:w,drafts,pendingReadback:await app.observed.pending()},null,2));setStatus('独立读回完成：Task '+w.tasks.length+'，Project '+w.projects.length+'，Event '+w.events.length+'，TimePoint '+w.timePoints.length)
    }catch(e){setStatus(String(e))}}
    return <details className="c11-tools" open><summary>D25 首次正确率主线 · 隔离工程验收</summary><p><strong>工程合成正例与 D17 原录制；非新模型成绩、非真人试用。</strong>模型派发关闭。</p><p>构建：{config.buildIdentity}；库：{config.database}。</p><p>Candidate18使用逐片段事实账目、独立前置完成证据及单向关联；原回答、程序转换和用户修改分开保留。</p><button onClick={()=>{app.observed.failNext();setStatus('下一次正式保存失败；编辑保留，请手动重试。')}}>注入下一次保存失败</button><button onClick={()=>{app.observed.failReadbackNext();setStatus('下一次提交后读回失败；请只重读，不重复提交。')}}>注入下一次读回失败</button><button onClick={()=>void readback()}>独立读回与测量证据</button><p role="status">{status}</p>{report&&<details open><summary>本库事实与原答、转换、编辑记录</summary><pre aria-label="D25独立读回JSON" style={{maxHeight:300,overflow:'auto'}}>{report}</pre></details>}</details>
  }
  root.render(<><Tools/><App runtime={app.runtime}/></>)
}
void start().catch(e=>root.render(<main><p role="alert">D25未能打开：{String(e)}。未回退旧库、未清空。</p></main>))
