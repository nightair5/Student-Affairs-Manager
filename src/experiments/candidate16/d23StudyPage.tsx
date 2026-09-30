import {useEffect,useState,type ReactNode} from 'react'
import App from '../../App'
import '../../styles.css'
import '../../mobile.css'
import '../../visual.css'
import '../candidate11/preview.css'
import './d23.css'
import {IsolatedTestStore} from '../mainline01/isolatedStore'
import {sha256Text} from '../realInput01/inputReceipt'
import {createD13Runtime} from './runtime'
import {createD13Measurement} from './measurement'
import {D23Study,aggregateD23Reports,d23Measurement,d23DomainTransport,JUDGMENT_FIELDS,type StudyPlan,type StudyRegistry,type StudyRole,type ScopeAuthority,type Judgment} from './d23Study'
import type {D13ReplayRecord} from './replay'
import type {MainlineRealInputCapabilities} from '../mainline02/runtime'

declare const __D23_CONFIG__:{origin:string;databases:Record<string,string>;records:Array<{id:string;label:string;kind:D13ReplayRecord['kind'];sha256:string}>;plan:StudyPlan;role:StudyRole;authority:ScopeAuthority;buildIdentity:string}
const config=__D23_CONFIG__
if(location.origin!==config.origin||location.hostname!=='127.0.0.1'||!['','?automation=1','?owner=1'].includes(location.search))throw Error('D23_ORIGIN_REQUIRED')
const nativeOpen=indexedDB.open.bind(indexedDB),nativeFetch=window.fetch.bind(window)
indexedDB.open=(name,version)=>{if(!Object.values(config.databases).includes(name)||version!==1)throw Error('D23_OTHER_DATABASE_FORBIDDEN');return nativeOpen(name,version)}
for(const method of ['getItem','setItem','removeItem','clear','key'] as const)Object.defineProperty(Storage.prototype,method,{value:()=>{throw Error('D23_OLD_STORAGE_DISABLED')}})
window.fetch=(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input),location.href);if(url.origin!==config.origin||url.search||!config.records.some(r=>url.pathname==='/records/'+r.id+'.json')||(init?.method??'GET')!=='GET')throw Error('D23_NETWORK_DISABLED');return nativeFetch(input,{...init,redirect:'error'})}
XMLHttpRequest.prototype.open=()=>{throw Error('D23_XHR_DISABLED')};window.WebSocket=new Proxy(WebSocket,{construct:()=>{throw Error('D23_SOCKET_DISABLED')}});navigator.sendBeacon=()=>{throw Error('D23_BEACON_DISABLED')}
const read=async(id:string)=>{const item=config.records.find(r=>r.id===id);if(!item)throw Error('D23_RECORD_ID');const response=await fetch('/records/'+id+'.json'),body=await response.text();if(!response.ok||await sha256Text(body)!==item.sha256)throw Error('D23_RECORD_HASH');return JSON.parse(body) as D13ReplayRecord}
const labels={tasks:'任务／无任务',events:'独立事件',time:'时间',materials:'材料',conditions:'条件',relations:'依赖／修订',information:'通知信息'}
const unknown=()=>Object.fromEntries(JUDGMENT_FIELDS.map(k=>[k,'unknown'])) as Record<typeof JUDGMENT_FIELDS[number],Judgment>

export function D23StudyPage(){const [identity,setIdentity]=useState('p1');return <><header className="d23-header"><h1>D23 通知核对与受限探索入口</h1><p>角色：{config.role==='ENGINEERING_REPLAY'?'匿名工程回放／非真人试用':'已授权本机探索'} · 构建：{config.buildIdentity} · 固定 Candidate17 D17 录制 · 新模型调用关闭</p><label>隔离身份 <select aria-label="隔离身份" value={identity} onChange={e=>setIdentity(e.target.value)}>{Object.keys(config.databases).map(id=><option key={id} value={id}>{config.role==='ENGINEERING_REPLAY'?'模拟身份':'匿名参与者'} {id}</option>)}</select></label><p>本机浏览器保存；无账号认证或跨设备同步。登记、同意与准备不计通知处理时间。个人资料和同意原件留在负责人本机。</p></header><Surface key={identity} identity={identity}/></>}
function Surface({identity}:{identity:string}){
  const [service,setService]=useState<Awaited<ReturnType<typeof connect>>>(),[error,setError]=useState('')
  useEffect(()=>{let live=true;void connect(identity).then(value=>{if(live)setService(value)}).catch(e=>setError(String(e)));return()=>{live=false}},[identity])
  if(!service)return <p role={error?'alert':'status'}>{error||'正在打开本身份隔离库…'}</p>
  return <StudySurface identity={identity} service={service}/>
}
async function connect(identity:string){
  const store=new IsolatedTestStore(config.databases[identity]),study=new D23Study(store,config.plan,config.role,config.authority),base=createD13Measurement(store),metrics=d23Measurement(base,study)
  function AssignedInput(props:Parameters<MainlineRealInputCapabilities['inputPanel']>[0]){
    const [message,setMessage]=useState(''),[busy,setBusy]=useState(false)
    return <section aria-label="本试次固定输入"><p>仅打开当前已开始试次的锁定来源。手动条件为空白，辅助条件为原始录制；二者共用正式核对和保存链。</p><button disabled={busy} onClick={()=>{setBusy(true);void (async()=>{const t=await study.assertProcessing();await study.transition('load_wait');try{const draftId=await app.open(t.recordId);await props.onSaved();await props.onDraftReady(draftId)}finally{await study.transition('load_end')}})().catch(e=>setMessage(String(e))).finally(()=>setBusy(false))}}>打开本试次核对页</button>{message&&<p role="alert">{message}</p>}</section>
  }
  function SessionFrame({children,onClose}:{children:ReactNode;onClose?:()=>void}){
    const [registry,setRegistry]=useState<StudyRegistry>(),[message,setMessage]=useState('')
    useEffect(()=>{let live=true;const timer=setInterval(()=>{void study.load().then(r=>{if(live)setRegistry(r)})},250);return()=>{live=false;clearInterval(timer)}},[])
    const t=registry?.trials.find(t=>t.id===registry.activeTrialId),running=t&&['started','partial'].includes(t.status)
    const act=(kind:'pause'|'resume'|'exit')=>{void study.transition(kind).then(setRegistry).catch(e=>setMessage(String(e)))}
    if(t?.status==='candidate_complete')return <section className="d23-dialog-controls" role="status"><p>本试次已提交并独立读回，成为整份完成候选；是否正确仍待负责人裁决。请关闭核对页查看结果，不能继续改写本次固定试次。</p><button onClick={onClose}>返回已保存来源</button></section>
    return <><section className="d23-dialog-controls" aria-label="本试次暂停与退出"><strong>试次 {t?.status??'载入中'}（部分确认不算整份完成）</strong>{running&&<button onClick={()=>act('pause')}>暂停本页处理</button>}{t?.status==='paused'&&<button onClick={()=>act('resume')}>恢复本页处理</button>}{t&&!['candidate_complete','exited','timeout'].includes(t.status)&&<button onClick={()=>act('exit')}>退出本页试次</button>}{message&&<p role="alert">{message}</p>}</section><fieldset disabled={!running} className={"d23-review-fields"+(t?.condition==='manual'?' d23-manual-review':'')}>{t?.condition==='manual'&&<p className="d23-manual-notice" role="status">空白手动录入：目前没有预填答案，不能据此认定通知没有任务。请按原文补录任务、材料、时间和事件；确实无任务时才归档。手动录入量不会计作 AI 纠错。</p>}{children}</fieldset></>
  }
  const app=await createD13Runtime({transport:d23DomainTransport(store,study),choices:config.records,read,sourceSession:true,buildLabel:'D23来源级核对',audience:config.role==='HUMAN_EXPLORATORY'?'human':'engineering',measurement:metrics,sessionFrame:SessionFrame,inputPanel:props=><AssignedInput {...props}/>,beforeOpen:async r=>{const t=await study.assertProcessing(r.id),m=config.plan.materials.find(m=>m.id===t.materialId);if(!m||await sha256Text(r.context.index.sourceContent)!==m.sourceSha256||t.condition==='assisted'&&r.responseSha256!==m.stimulusSha256)throw Error('D23_STIMULUS_IDENTITY')},onOpen:async(r,draftId)=>{await study.attach(r.id,draftId)}})
  const saved=await study.load(),current=saved.trials.find(t=>t.id===saved.activeTrialId)
  if(current&&['started','partial','paused'].includes(current.status)){await study.transition('reload');if(current.draftId)await metrics.restore(current.draftId)}
  return {app,study,store,initialRegistry:await study.load()}
}
function StudySurface({identity,service}:{identity:string;service:Awaited<ReturnType<typeof connect>>}){
  const {app,study,store}=service
  const [registry,setRegistry]=useState<StudyRegistry>(service.initialRegistry),[status,setStatus]=useState(''),[slotId,setSlotId]=useState(identity+'-1'),[owner,setOwner]=useState(''),[consent,setConsent]=useState(''),[obligations,setObligations]=useState<Record<string,string>>({}),[report,setReport]=useState(''),[judgedTrialId,setJudgedTrialId]=useState(''),[evidence,setEvidence]=useState<Awaited<ReturnType<D23Study['evidence']>>>(),[firstRaw,setFirstRaw]=useState(''),[first,setFirst]=useState(unknown),[final,setFinal]=useState(unknown),[notes,setNotes]=useState(''),[disputes,setDisputes]=useState(''),[download,setDownload]=useState('')
  const refresh=async()=>{setRegistry(await study.load())}
  useEffect(()=>{let live=true;const interval=setInterval(()=>{void study.load().then(value=>{if(live)setRegistry(value)})},700);const visibility=()=>{void app.metrics.visibility(document.hidden)};document.addEventListener('visibilitychange',visibility);return()=>{live=false;clearInterval(interval);document.removeEventListener('visibilitychange',visibility)}},[study,app])
  const run=(fn:()=>Promise<void>)=>{void fn().then(refresh).catch(e=>setStatus(e instanceof Error?e.message:String(e)))}
  const t=registry?.trials.find(t=>t.id===registry.activeTrialId),slots=config.plan.slots.filter(s=>s.participantId===identity),selected=slots.find(s=>s.slotId===slotId),m=config.plan.materials.find(m=>m.id===selected?.materialId),engineering=config.role==='ENGINEERING_REPLAY'
  const active=Boolean(t&&['started','partial'].includes(t.status))
  const displayedMaterial=t?config.plan.materials.find(row=>row.id===t.materialId):m
  const ownerView=engineering||location.search==='?owner=1'
  const judgedTrial=registry.trials.find(row=>row.id===judgedTrialId)??t
  const exportReport=async()=>{const workspace=await app.independentReadback(),data={build:config.buildIdentity,database:store.name,registry:await study.load(),report:await study.report(),canonicalWorkspace:workspace,pendingReadback:await app.observed.pending(),role:config.role,humanMetrics:engineering?'NOT_OBSERVABLE':'SEE_REGISTERED_TRIALS'};const body=JSON.stringify(data,null,2);setReport(body);if(download)URL.revokeObjectURL(download);setDownload(URL.createObjectURL(new Blob([body],{type:'application/json'})));setStatus(`独立读回：Task ${workspace.tasks.length} / Project ${workspace.projects.length} / Event ${workspace.events.length} / TimePoint ${workspace.timePoints.length}；真人 ${engineering?'NOT_OBSERVABLE':'按注册记录报告'}`)}
  return <><section className="d23-study" aria-label="D23试次控制"><h2>试次与固定来源</h2><p>数据库：{store.name}。本身份已开始 {registry?.trials.length??0}；真人计划 16，真人实际 {engineering?0:registry?.trials.length??0}。</p><p>当前状态：{t?.status??'NOT_RUN'}；条件：{t?.condition??'未开始'}；试次：{t?.id??'无'}。</p>
    <button onClick={()=>{try{study.humanGate();setStatus('真人范围已授权，仍须负责人、冻结和真实同意。')}catch(e){setStatus(String(e))}}}>检查真人开始资格</button>
    {ownerView&&<details><summary>{engineering?'工程模拟登记／裁决（不会生成真人）':'负责人登记与材料冻结'}</summary><p>真实身份引用来自实际登记。本机记录提供可追溯出处，不等同账号鉴权。工程模拟永远保持 ENGINEERING_REPLAY。</p><label>负责人接受引用 <input aria-label="负责人接受引用" value={owner} onChange={e=>setOwner(e.target.value)}/></label><button onClick={()=>run(async()=>{await study.acceptOwner(owner);setStatus('负责人接受记录已保存；本角色为 '+config.role)})}>记录负责人接受</button>
      {config.plan.materials.map(material=><label key={material.id}>{material.id} 最小义务与争议（按原文核准）<textarea aria-label={material.id+'义务'} value={obligations[material.id]??''} onChange={e=>setObligations({...obligations,[material.id]:e.target.value})}/></label>)}<button onClick={()=>run(async()=>{await study.freeze(obligations);setStatus('材料、顺序、10分钟窗口和测量阈值已冻结；试次开始后禁止改写。')})}>核准并冻结材料</button>
    </details>}
    <details><summary>{engineering?'工程模拟知情同意':'参与者知情同意'}</summary><label>{engineering?'工程模拟同意引用':'真实参与者同意引用'} <input aria-label="同意引用" value={consent} onChange={e=>setConsent(e.target.value)}/></label><p>参与者已了解：本机保存、固定录制建议、可暂停或退出、采集编辑和操作时间、由指定负责人暂定裁决；不采集真实通知或联系方式。实际同意原件不进入代码仓库。</p><button onClick={()=>run(async()=>{await study.consent(identity,consent);setStatus('同意出处已登记；未进入通知计时。角色 '+config.role)})}>{engineering?'记录模拟同意':'本人同意并登记引用'}</button></details>
    <label>锁定排程 <select aria-label="锁定排程" value={slotId} disabled={Boolean(t&&!['candidate_complete','exited','timeout'].includes(t.status))} onChange={e=>setSlotId(e.target.value)}>{slots.map(s=><option key={s.slotId} value={s.slotId}>{s.ordinal} · {s.materialId} · {s.condition==='manual'?'空白手动':'固定辅助'}</option>)}</select></label>
    {displayedMaterial&&<div><h3>指定原文</h3><pre className="d23-source">{t?displayedMaterial.sourceText:'点击开始后才呈现原文，准备和同意不计处理时间。'}</pre><p>来源 SHA {displayedMaterial.sourceSha256.slice(0,12)}；首次刺激 SHA {displayedMaterial.stimulusSha256.slice(0,12)}。参考时点 2026-09-22，时区上海。空白手动不包含任务答案。</p></div>}
    <button disabled={Boolean(t&&!['candidate_complete','exited','timeout'].includes(t.status))} onClick={()=>run(async()=>{if(!m)throw Error('D23_SOURCE_REQUIRED');await study.start(slotId,m.sourceText);setStatus('原文已呈现并开始处理；点击下方“快速录入”，再打开本试次核对页。打开建议的等待单独计量。')})}>看到原文并开始处理</button>
    {active&&<button onClick={()=>run(async()=>{await study.transition('pause');setStatus('已暂停计时与核对输入，未保存输入保留。')})}>暂停处理</button>}{t?.status==='paused'&&<button onClick={()=>run(async()=>{await study.transition('resume');setStatus('已恢复处理，暂停区间单列。')})}>恢复处理</button>}{t&&!['candidate_complete','exited','timeout'].includes(t.status)&&<button onClick={()=>run(async()=>{await study.transition('exit');setStatus('已退出；已观测编辑成本保留，未完成事实不会计成功。')})}>退出本试次</button>}
    {engineering&&<details><summary>匿名故障注入</summary><button onClick={()=>{app.observed.failNext();setStatus('下一次正式保存注入失败，手动恢复。')}}>注入正式保存失败</button><button onClick={()=>{app.observed.failReadbackNext();setStatus('下一次提交后读回注入失败；仅重新读回。')}}>注入提交后读回失败</button></details>}
    <button onClick={()=>run(exportReport)}>独立读回与试次报告</button>{download&&<a href={download} download="d23-local-evidence.json">下载本机试次证据</a>}<p role="status">{status}</p>
    {ownerView&&<button onClick={()=>run(async()=>{const reports=await Promise.all(Object.values(config.databases).map(async name=>new D23Study(new IsolatedTestStore(name),config.plan,config.role,config.authority).report()));setReport(JSON.stringify(aggregateD23Reports(reports),null,2));setStatus('已按隔离身份独立读回，汇总条件、参与者和来源；工程记录仍不能进入真人成绩。')})}>独立读回全部身份汇总</button>}
    {ownerView&&<details><summary>{engineering?'工程模拟裁决接线':'负责人逐试次裁决'}</summary><p>裁决绑定指定来源、首次刺激、提交与独立读回。标题/自由描述仍由负责人核对，不伪称自动真值。</p><label>裁决试次 <select aria-label="裁决试次" value={judgedTrial?.id??''} onChange={e=>{setJudgedTrialId(e.target.value);setEvidence(undefined);setFirstRaw('');setFirst(unknown());setFinal(unknown());setNotes('');setDisputes('')}}>{registry.trials.map(row=><option key={row.id} value={row.id}>{row.slotId} · {row.materialId} · {row.condition} · {row.status}</option>)}</select></label><button onClick={()=>run(async()=>{if(!judgedTrial)throw Error('无试次');setEvidence(await study.evidence(judgedTrial.id));const material=config.plan.materials.find(row=>row.id===judgedTrial.materialId);setFirstRaw(judgedTrial.condition==='assisted'&&material?(await read(material.assistedId)).rawHttpText:'NOT_APPLICABLE（空白手动）');setStatus('已载入本次提交与读回证据，修改正式结果后旧裁决将被拒绝。')})}>载入裁决证据</button>
      {evidence&&<><pre className="d23-json" aria-label="裁决canonical证据">{JSON.stringify(evidence.payload,null,2)}</pre>{judgedTrial?.condition==='assisted'&&<div><h3>固定首次建议裁决</h3>{JUDGMENT_FIELDS.map(k=><label key={k}>{labels[k]} <select aria-label={'首次'+labels[k]} value={first[k]} onChange={e=>setFirst({...first,[k]:e.target.value as Judgment})}><option value="unknown">未决</option><option value="correct">完整正确</option><option value="incorrect">错误／遗漏</option></select></label>)}</div>}<h3>整份最终处置裁决</h3>{JUDGMENT_FIELDS.map(k=><label key={k}>{labels[k]} <select aria-label={'最终'+labels[k]} value={final[k]} onChange={e=>setFinal({...final,[k]:e.target.value as Judgment})}><option value="unknown">未决</option><option value="correct">完整正确</option><option value="incorrect">错误／遗漏</option></select></label>)}<label>原文依据／合法表达／介入帮助 <textarea aria-label="裁决依据" value={notes} onChange={e=>setNotes(e.target.value)}/></label><label>争议 <textarea aria-label="裁决争议" value={disputes} onChange={e=>setDisputes(e.target.value)}/></label><button onClick={()=>run(async()=>{if(!judgedTrial)throw Error('无试次');await study.adjudicate(judgedTrial.id,evidence.sha256,judgedTrial.condition==='manual'?null:first,final,notes,disputes);setStatus('裁决已追加并绑定提交。工程裁决不进入真人指标。')})}>追加绑定裁决</button>{engineering&&<button onClick={()=>run(async()=>{if(!judgedTrial)throw Error('无试次');await study.adjudicate(judgedTrial.id,'0'.repeat(64),judgedTrial.condition==='manual'?null:first,final,notes,disputes)})}>检查过期裁决阻断</button>}</>}
    {firstRaw&&<details><summary>原始固定首次回答（与最终事实分开）</summary><pre className="d23-json">{firstRaw}</pre></details>}</details>}{report&&<details><summary>查看逐试次与缺失报告</summary><pre className="d23-json" aria-label="D23独立读回JSON">{report}</pre></details>}
  </section><fieldset disabled={!t} className="d23-app"><legend>{t?.status==='paused'?'已暂停；恢复后继续核对':active?'本试次正式核对与保存':'请先开始一条获准试次；已确认事实可在报告中查看'}</legend><App runtime={app.runtime}/></fieldset></>
}
