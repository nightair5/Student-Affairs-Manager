import {createRoot} from 'react-dom/client'
import {useEffect,useState} from 'react'
import App from '../../App'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import '../candidate11/preview.css'
import {IsolatedTestStore} from '../mainline01/isolatedStore'
import {sha256Text,correctReadPage,makeSendSnapshot} from '../realInput01/inputReceipt'
import {createD13Runtime} from './runtime'
import {calculateLowEditV2,D14_DATABASE,isD15Database,isD19Database,isD20Database,isD21Database} from './measurement'
import {beginTrial,loadTrial,trialAction,metricEntry,type Trial} from './d14Trial'
import {calculateD19Engineering,summarizeD19HumanTrials} from './d19Measurement'
import {summarizeD20Engineering} from './d20Measurement'
import {calculateD22Engineering} from './d22Measurement'
import type {ReviewSession} from './d20ReviewSession'
import {IndependentEventEditor} from '../realInput01/IndependentEventEditor'
import {reviewIndependentEvents} from '../mainline05/semanticConfirmation'
import {effectiveStateFacts,life,readingOf,semanticRevision,stateOfRuntime} from '../mainline05/semanticState'
import type {WorkspaceV8} from '../../domain/v2/types'
import type {D13ReplayRecord} from './replay'
import {FLASH41_MODEL_NAME} from '../realInput01/modelWire'
import {CANDIDATE03_VERSION} from '../realInput01/candidate03'

declare const __D14_CONFIG__:{origin:string;database:string;records:Array<{id:string;label:string;kind:D13ReplayRecord['kind'];sha256:string}>;sourceSession?:boolean;buildLabel?:string;buildIdentity?:string}
const config=__D14_CONFIG__
if(location.origin!==config.origin||location.hostname!=='127.0.0.1'||(config.database!==D14_DATABASE&&!isD15Database(config.database)&&!isD19Database(config.database)&&!isD20Database(config.database)&&!isD21Database(config.database))||!['','?automation=1'].includes(location.search))throw Error('D14_ORIGIN_REQUIRED')
const nativeOpen=indexedDB.open.bind(indexedDB),nativeFetch=window.fetch.bind(window)
indexedDB.open=(name,version)=>{if(name!==config.database||version!==1)throw Error('D14_DATABASE_FORBIDDEN');return nativeOpen(name,version)}
for(const method of ['getItem','setItem','removeItem','clear','key'] as const)Object.defineProperty(Storage.prototype,method,{value:()=>{throw Error('D14_OLD_STORAGE_DISABLED')}})
window.fetch=(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin!==config.origin||url.search||!config.records.some(r=>url.pathname==='/records/'+r.id+'.json')||(init?.method??'GET')!=='GET')throw Error('D14_NETWORK_DISABLED');return nativeFetch(input,{...init,redirect:'error'})}
XMLHttpRequest.prototype.open=()=>{throw Error('D14_XHR_DISABLED')};window.WebSocket=new Proxy(WebSocket,{construct:()=>{throw Error('D14_SOCKET_DISABLED')}});navigator.sendBeacon=()=>{throw Error('D14_BEACON_DISABLED')}
const root=createRoot(document.getElementById('root')!)

async function start(){
  const transport=new IsolatedTestStore(config.database)
  const read=async(id:string)=>{const item=config.records.find(r=>r.id===id);if(!item)throw Error('D14_RECORD_ID');const response=await fetch('/records/'+id+'.json'),body=await response.text();if(!response.ok||await sha256Text(body)!==item.sha256)throw Error('D14_RECORD_HASH');return JSON.parse(body) as D13ReplayRecord}
  const app=await createD13Runtime({transport,choices:config.records,read,buildLabel:config.buildLabel,sourceSession:config.sourceSession===true,beforeOpen:async record=>{const t=await loadTrial(transport);if(t?.status!=='started'||t.recordId!==record.id||t.stimulusSha256!==record.responseSha256)throw Error(isD15Database(config.database)?`D15_TRIAL_STIMULUS_MISMATCH:${t?.recordId??'NONE'}:${record.id}:${t?.stimulusSha256?.slice(0,8)??'NONE'}:${record.responseSha256.slice(0,8)}`:'D14_TRIAL_STIMULUS_MISMATCH')},onOpen:async(record,draftId)=>{const active=await loadTrial(transport);if(active?.status==='started'&&active.recordId===record.id&&!active.draftId)await trialAction(transport,active.id,'attach',draftId)},onDisposition:async draftId=>{const active=await loadTrial(transport);if(active?.status==='started'&&active.draftId===draftId)await trialAction(transport,active.id,'complete',draftId)}})
  document.addEventListener('visibilitychange',()=>{void app.metrics.visibility(document.hidden)})
  for(const draft of (await app.repository.load()).extractionDrafts)if((await app.metrics.events(draft.id)).length)await app.metrics.restore(draft.id)
  const d22Trials=async()=>{
    const ids=await transport.read('d22-trial-index') as string[]|undefined,allTrace=await app.metrics.events()
    const trials=await Promise.all((ids??[]).map(async id=>{
      const trial=await loadTrial(transport,id),trace=allTrace.filter(row=>row.draftId===trial?.draftId)
      const session=trial?.draftId?await transport.read('d20-review-session:'+trial.draftId) as ReviewSession|undefined:undefined
      return {trial,measurement:trial?.draftId?calculateD22Engineering(trace,session,trial.condition):null}
    }))
    return {role:'ENGINEERING_REPLAY',allTrace,trials,groups:(['manual','assisted'] as const).map(condition=>{
      const rows=trials.filter(row=>row.trial?.condition===condition)
      return {condition,denominator:rows.length,completed:rows.filter(row=>row.trial?.status==='completed').length,exited:rows.filter(row=>row.trial?.status==='exited').length,unresolved:rows.filter(row=>!row.measurement?.outcomes.complete).length,humanMetrics:'NOT_OBSERVABLE'}
    })}
  }
  function Tools(){
    const [trial,setTrial]=useState<Trial|undefined>(),[status,setStatus]=useState(''),[condition,setCondition]=useState<'manual'|'assisted'>('assisted'),[recordId,setRecordId]=useState('d13-fixture-no-task'),[report,setReport]=useState(''),[url,setUrl]=useState<string>(),[snapshot,setSnapshot]=useState<WorkspaceV8|null>(null),[eventDirty,setEventDirty]=useState(false)
    useEffect(()=>{void loadTrial(transport).then(setTrial).catch(e=>setStatus(String(e)))},[])
    const act=async(kind:'pause'|'resume'|'exit')=>{if(!trial)return;setTrial(await trialAction(transport,trial.id,kind));setStatus('试次状态已持久化：'+kind)}
    const selected=config.records.find(r=>r.id===recordId)??config.records[0]
    const run=async(fn:()=>Promise<void>)=>{try{await fn()}catch(e){setStatus(e instanceof Error?e.message:'操作失败')}}
    const d15=isD15Database(config.database),eventState=trial?.draftId&&snapshot?stateOfRuntime(snapshot,trial.draftId):null,eventFacts=eventState?effectiveStateFacts(eventState).facts:null
    const refreshEvents=async()=>{const current=await loadTrial(transport);setTrial(current);if(!current?.draftId)throw Error('请先在快速录入中打开本试次来源');setSnapshot(await app.repository.load())}
    return <details className="c11-tools" open><summary>{config.buildLabel??(d15?'D15':'D14')} 隔离试次与工程测量</summary><p><strong>匿名工程回放 / 非真人试用</strong>。数据库：{config.database}。此入口不发送模型请求；真人四项指标均不可观测。</p><p>构建：{config.buildIdentity??'历史工程构建'}；刺激：{trial?.recordId??'尚未载入'}。</p>
      <p>试次身份：{trial?.id??'尚未开始'}；状态：{trial?.status??'NOT_RUN'}；条件：{trial?.condition??'未选'}；来源夹具：{trial?.recordId??'未选'}。</p>
      {!trial&&<div><label>条件 <select value={condition} onChange={e=>setCondition(e.target.value as 'manual'|'assisted')}><option value="assisted">固定辅助建议</option><option value="manual">从空白手动录入</option></select></label><label>匿名通知 <select value={recordId} onChange={e=>setRecordId(e.target.value)}>{config.records.filter(r=>!r.id.includes('-manual-')&&(condition==='assisted'||r.kind==='ENGINEERING_FIXTURE')).map(r=><option value={r.id} key={r.id}>{r.label}</option>)}</select></label>
        <button onClick={()=>{void run(async()=>{const r=await read(selected.id),stimulus=condition==='manual'?await read('d13-fixture-manual-'+selected.id.slice('d13-fixture-'.length)):r,t=await beginTrial(transport,condition,r.context.index.sourceContent,stimulus.id,stimulus.responseSha256);if(config.buildLabel?.startsWith('D22'))await transport.transaction('d22-trial-index',old=>[...(Array.isArray(old)?old:[]),t.id]);setTrial(t);setStatus('请在下方快速录入中选择“'+stimulus.label+'”，走同一编辑、确认和 canonical 保存链。')})}}>开始隔离工程试次</button></div>}
      {trial?.status==='started'&&<button onClick={()=>{void run(()=>act('pause'))}}>暂停</button>}{trial?.status==='paused'&&<button onClick={()=>{void run(()=>act('resume'))}}>继续</button>}{trial&&['started','paused'].includes(trial.status)&&<button onClick={()=>{void run(()=>act('exit'))}}>退出</button>}
      {trial&&['completed','exited'].includes(trial.status)&&<button onClick={()=>{setTrial(undefined);setStatus('上一试次保留在隔离库，可开始下一匿名工程试次。')}}>开始下一试次</button>}
      {trial?.condition==='manual'&&trial.status==='started'&&<p>空白手动基线：{trial.sourceText}。在下方快速录入选择本试次的“空白手动”夹具，再按原文补任务、完成标准、材料或独立事件；没有模型建议，确认后走正式隔离库的同一保存与读回链。同一夹具在本库只能打开一次。</p>}
      {trial?.condition==='assisted'&&trial.status==='started'&&<p>辅助刺激已锁定。在下方“快速录入”选择本试次对应夹具，核对、拒绝或确认；页面编辑、保存和独立读回进入同一隔离库。首次输出 SHA 已固定。</p>}
      {d15&&!config.sourceSession&&trial?.status==='started'&&<section aria-label="D15混合来源独立事件核对"><h3>混合通知的独立事件</h3><p>先在下方快速录入打开本试次，再返回这里核对事件；含任务时须先保存并确认独立事件，再确认任务。</p><button type="button" onClick={()=>{void run(refreshEvents)}}>载入当前来源的事件核对</button>
        {eventState&&trial.draftId&&<div onChangeCapture={e=>{void app.metrics.changed(trial.draftId!,e.target instanceof HTMLElement?e.target.closest('label')?.textContent??'event-field':'event-field')}} onBlurCapture={()=>{void app.metrics.blur(trial.draftId!)}}><IndependentEventEditor repo={app.repository} workspace={snapshot!} draftId={trial.draftId} busy={false} onDirty={setEventDirty} onSaved={refreshEvents}/></div>}
        {eventState&&eventFacts&&eventFacts.tasks.length>0&&eventFacts.events.some(event=>!event.relatedTaskTempIds.length)&&!life(eventState).independentEventsReviewedAt&&<button type="button" disabled={eventDirty} onClick={()=>{void run(async()=>{await reviewIndependentEvents(app.repository,{draftId:trial.draftId!,revision:semanticRevision(snapshot!),operationId:crypto.randomUUID()});await refreshEvents();setStatus('独立事件已正式保存并读回；现在可以逐项确认任务。')})}}>确认并保存独立事件</button>}
        {eventState?.version&&life(eventState).independentEventsReviewedAt&&<p role="status">独立事件已确认，原回答与人工修改分别保存。</p>}
      </section>}
      <button onClick={()=>{app.observed.failNext();setStatus('下次工作区保存将失败；请在页面手动重试。')}}>注入下一次工作区保存失败</button>
      <button onClick={()=>{app.observed.failCheckpointNext();setStatus('下次编辑检查点写入将失败；请保留页面输入并手动重试。')}}>注入下一次检查点失败</button>
      <button onClick={()=>{app.observed.failReadbackNext();setStatus('下次提交后的读回将失败；已提交时只能重新读回，不重复提交。')}}>注入下一次提交后读回失败</button>
      {config.buildLabel?.startsWith('D22')&&<button onClick={()=>{void run(async()=>{
        const current=await loadTrial(transport),workspace=await app.repository.load()
        const draft=workspace.extractionDrafts.find(row=>row.id===current?.draftId)
        const oldRun=workspace.recognitionRuns.find(row=>row.id===draft?.recognitionRunId)
        const oldVersion=workspace.sourceVersions.find(row=>row.id===oldRun?.sourceVersionId)
        const source=workspace.sources.find(row=>row.id===oldVersion?.sourceId)
        const version=workspace.sourceVersions.find(row=>row.id===source?.currentVersionId)
        if(!source||!version)throw Error('D22_ANONYMOUS_SOURCE_REQUIRED')
        const rawText=(version.rawText??'')+'\n[D22匿名故障注入：来源版本已更新，请重新核对。]'
        // Existing reading/revision services preserve the original receipt and answer.
        // This only queues an anonymous engineering revision; no provider is invoked.
        const original=readingOf(source.legacyData?.realInput01)
        const receipt=await correctReadPage(original.inputReceipt,1,rawText,crypto.randomUUID(),new Date().toISOString())
        const corrected=await app.repository.saveReadingCorrection(source.id,receipt,semanticRevision(workspace))
        await app.repository.beginInputRun(source.id,{...original,inputReceipt:receipt,sendSnapshot:await makeSendSnapshot(receipt,[1],[1],new Date().toISOString())},'seen_engineering_replay',crypto.randomUUID(),semanticRevision(corrected),undefined,CANDIDATE03_VERSION,FLASH41_MODEL_NAME)
        setStatus('只在本匿名隔离库追加了新来源版本；旧来源与输入保留，旧版本确认应被阻断。')
      })}}>注入匿名来源版本变化</button>}
      <button onClick={()=>{void run(async()=>{const workspace=await app.independentReadback(),current=await loadTrial(transport),trace=current?.draftId?await app.metrics.events(current.draftId):[],metric=current?.draftId?calculateLowEditV2(trace):null,d20Session=current?.draftId&&(isD20Database(config.database)||isD21Database(config.database))?await transport.read('d20-review-session:'+current.draftId) as ReviewSession|undefined:undefined,reportData={role:'ENGINEERING_REPLAY',buildIdentity:config.buildIdentity,trial:current,...(config.buildLabel?.startsWith('D22')?{canonicalWorkspace:workspace,engineeringTrials:await d22Trials(),pendingReadback:await app.observed.pending(),d22Engineering:current?.draftId?calculateD22Engineering(trace,d20Session,current.condition):null}:{}),workspaceCounts:{sources:workspace.sources.length,drafts:workspace.extractionDrafts.length,tasks:workspace.tasks.length,projects:workspace.projects.length,events:workspace.events.length,timePoints:workspace.timePoints.length},...(isD21Database(config.database)?{canonicalFacts:{tasks:workspace.tasks.map(item=>({id:item.id,title:item.title,dependencyIds:item.dependencyIds,status:item.status,sourceId:item.legacyData?.sourceId})),events:workspace.events.map(item=>({id:item.id,title:item.title,startTimePointId:item.startTimePointId,endTimePointId:item.endTimePointId,sourceId:item.legacyData?.sourceId})),timePoints:workspace.timePoints.map(item=>({id:item.id,eventId:item.eventId,type:item.type,rawText:item.rawText,normalizedValue:item.normalizedValue,precision:item.precision,needsConfirmation:item.needsConfirmation}))}}:{}),trace,metric:metricEntry(current,metric),...(config.sourceSession?{d19Engineering:current?.draftId?calculateD19Engineering(trace,current.condition):null,humanConditionGroups:summarizeD19HumanTrials([])}:{}),...((isD20Database(config.database)||isD21Database(config.database))?{d20Engineering:summarizeD20Engineering(d20Session,trace)}:{}),original:current?.draftId?await transport.read('d13-original:'+current.draftId):null,humanTrial:'NOT_RUN'};const body=JSON.stringify(reportData,null,2);setReport(body);if(url)URL.revokeObjectURL(url);setUrl(URL.createObjectURL(new Blob([body],{type:'application/json'})));setTrial(current);setStatus(`独立读回：Task ${workspace.tasks.length}，Project ${workspace.projects.length}，Event ${workspace.events.length}，TimePoint ${workspace.timePoints.length}。`)})}}>独立读回与四指标状态</button>
      {url&&<a href={url} download="d14-engineering-trial.json">下载匿名工程证据</a>}<p role="status">{status}</p>{report&&<details><summary>查看隔离库读回</summary><pre aria-label="D14独立读回JSON" style={{maxHeight:260,overflow:'auto'}}>{report}</pre></details>}
    </details>
  }
  root.render(<><Tools/><App runtime={app.runtime}/></>)
}
void start().catch(e=>root.render(<main><h1>D14隔离试次未能打开</h1><p role="alert">{e instanceof Error?e.message:'初始化失败'}。未退回旧库、未清空数据。</p></main>))
