import {useEffect,useState} from 'react'
import type {WorkspaceV8} from '../domain/v2/types'
import {sourceReadinessGroups,type ReadinessInput,type ReadinessGroup, SOURCE_READINESS_VERSION} from '../domain/v2/sourceReadiness'
import {workspaceSnapshotHash} from '../domain/v2/migration'
import type {D20ReviewSessionRepository,ReviewField} from '../experiments/candidate16/d20ReviewSession'

type Props={workspace:WorkspaceV8;draftId:string;session:D20ReviewSessionRepository;disabled:boolean;onDirty:(dirty:boolean)=>void;onApply:(input:ReadinessInput)=>Promise<void>}
type Pending={key:string;input:ReadinessInput;field:ReviewField|null}
const keyFor=(groupId:string)=>`task:readiness-${groupId}:facts`
function inputValue(v:unknown):ReadinessInput|null {if(!v||typeof v!=='object')return null;const x=v as Partial<ReadinessInput>;return typeof x.groupId==='string'&&typeof x.expectedResult==='string'&&typeof x.operationId==='string'&&(x.choice==='no_extra_condition'||x.choice==='meets_stated_condition')?x as ReadinessInput:null}

/** One explicit user judgement per shared condition; no invented qualification. */
export function SourceReadinessReview({workspace,draftId,session,disabled,onDirty,onApply}:Props){
 const [pending,setPending]=useState<Pending|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState('')
 useEffect(()=>{onDirty(Boolean(pending));return()=>onDirty(false)},[pending,onDirty])
 useEffect(()=>{let live=true;void session.load(workspace,draftId).then(r=>{const pair=Object.entries(r.fields).find(([key])=>key.startsWith('task:readiness-'));if(pair&&live){const input=inputValue(pair[1].mine);if(input)setPending(p=>p??{key:pair[0],input,field:pair[1]})}}).catch(e=>{if(live)setStatus(String(e))});return()=>{live=false}},[workspace,draftId,session])
 let groups:ReadinessGroup[]
 try{groups=sourceReadinessGroups(workspace,draftId)}catch{ return <p role="status">来源版本已变化，适用判断暂停；请重新打开当前通知。</p> }
 const apply=async(p:Pending)=>{
  setPending(p);setBusy(true)
  try{
   let field=p.field
   if(!field)field=(await session.stage(workspace,draftId,p.key,{version:SOURCE_READINESS_VERSION,groupId:p.input.groupId,value:'unknown'},p.input,session.writer,true)).fields[p.key]
   setPending({...p,field})
   if(field.conflict||field.writer!==session.writer)throw Error('适用判断需要先恢复或解决冲突，双方判断均保留。')
   await session.withFreshField(workspace,draftId,p.key,session.writer,field.revision,p.input,()=>onApply(p.input))
   await session.clear(workspace,draftId,p.key,session.writer,field.revision)
   setPending(null);setStatus('本组适用判断已保存；原始首次建议不变。前置事项仍须实际完成。')
  }catch(error){setStatus(`判断尚未完成，输入保留，可手动恢复：${String(error)}`)}finally{setBusy(false)}
 }
 const recover=async()=>{if(!pending)return;setBusy(true);try{const r=pending.field&&pending.field.writer!==session.writer?await session.recover(workspace,draftId,session.writer,{[pending.key]:pending.field.revision}):null;await apply(r?{...pending,field:r.fields[pending.key]}:pending)}catch(e){setStatus(String(e))}finally{setBusy(false)}}
 if(!groups.length&&!pending)return null
 return <section aria-label="本通知适用性"><h3>本通知适用性</h3><p>同一条件只判断一次，应用到下列事项。只记录你的明确判断；原始识别结果保留。</p>
  {groups.map(group=><article className="recognition-entity-row" key={group.id}><div><strong>{group.titles.join('、')}</strong>
   {group.ruleQuotes.length?<><p>原文适用条件；尚未判断你是否符合：</p>{group.ruleQuotes.map(q=><blockquote key={q}>{q}</blockquote>)}</>:<p>原答没有给出适用条件依据，不能据此认定你资格不足，也不能自动认定没有条件。</p>}
   {group.resolved?<p>本组已按你的明确判断处理，不重复核对。</p>:group.unresolvedEvidence?<p>条件引用不完整，保留待核对；不会替你猜资格。</p>:<button type="button" disabled={disabled||busy||Boolean(pending)} onClick={()=>void apply({key:keyFor(group.id),field:null,input:{groupId:group.id,choice:group.ruleQuotes.length?'meets_stated_condition':'no_extra_condition',expectedResult:workspaceSnapshotHash(workspace.extractionDrafts.find(d=>d.id===draftId)!.result),operationId:crypto.randomUUID()}})}>{group.ruleQuotes.length?'我符合上述适用条件':'我已核对：本通知没有额外适用条件'}</button>}
  </div></article>)}
  {pending&&<div role="alert"><p>{pending.field?'未完成的适用判断检查点已保留。':'判断仍在本页，检查点未保存；请手动重试。'}</p>
   {pending.field?.conflict?(<>{(['latest','incoming'] as const).map(choice=><button type="button" key={choice} disabled={busy||disabled} onClick={()=>void session.resolve(workspace,draftId,pending.key,choice,session.writer,pending.field!.revision).then(r=>{const f=r.fields[pending.key],input=inputValue(f.mine);if(input)setPending({key:pending.key,input,field:f})}).catch(e=>setStatus(String(e)))}>采用{choice==='latest'?'最新判断':'我的判断'}</button>)}</>):<button type="button" disabled={busy||disabled} onClick={()=>void recover()}>恢复并保存适用判断</button>}
   <button type="button" disabled={busy||disabled||Boolean(pending.field?.conflict)} onClick={()=>{if(!pending.field){setPending(null);return}void session.clear(workspace,draftId,pending.key,session.writer,pending.field.revision).then(()=>setPending(null)).catch(e=>setStatus(String(e)))}}>放弃未保存的判断</button>
  </div>}
  {status&&<p role="status">{status}</p>}
 </section>
}
