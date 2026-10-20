import {useEffect,useState} from 'react'
import type {WorkspaceV8} from '../domain/v2/types'
import {receiptOpportunityViews,type ReceiptOpportunityInput} from '../domain/v2/receiptOpportunity'
import {workspaceSnapshotHash} from '../domain/v2/migration'
import {handlingWindowLabel} from '../recognition/handlingWindowSupport'
import {SOURCE_OBLIGATION_VIEW_VERSION} from '../recognition/sourceObligationProjection'
import type {D20ReviewSessionRepository,ReviewField} from '../experiments/candidate16/d20ReviewSession'

type Props={workspace:WorkspaceV8;draftId:string;session:D20ReviewSessionRepository;disabled:boolean;onDirty:(dirty:boolean)=>void;onApply:(input:ReceiptOpportunityInput)=>Promise<void>}
type Pending={key:string;input:ReceiptOpportunityInput;field:ReviewField|null}
function savedInput(value:unknown):ReceiptOpportunityInput|null {
  if(!value||typeof value!=='object')return null
  const v=value as Partial<ReceiptOpportunityInput>
  return typeof v.taskId==='string'&&typeof v.expectedResult==='string'&&typeof v.operationId==='string'&&(v.choice==='normal'||v.choice==='missed')&&(v.expectedChoice==='normal'||v.expectedChoice==='missed')?v as ReceiptOpportunityInput:null
}
/** A choice of opportunity edits only the draft's personal decision. The
 * original two source windows and one delivery goal remain untouched. */
export function ReceiptOpportunityReview({workspace,draftId,session,disabled,onDirty,onApply}:Props){
  const [pending,setPending]=useState<Pending|null>(null),[busy,setBusy]=useState(false),[status,setStatus]=useState('')
  useEffect(()=>{onDirty(Boolean(pending));return()=>onDirty(false)},[pending,onDirty])
  useEffect(()=>{let live=true;void session.load(workspace,draftId).then(r=>{const pair=Object.entries(r.fields).find(([key])=>key.startsWith('task:receipt-opportunity-'));if(pair&&live){const input=savedInput(pair[1].mine);if(input)setPending(p=>p??{key:pair[0],input,field:pair[1]})}}).catch(()=>{if(live)setStatus('未能读取上次选择。原文和建议仍在，请重新打开这份通知后核对。')});return()=>{live=false}},[workspace,draftId,session])
  const views=receiptOpportunityViews(workspace,draftId)
  const apply=async(p:Pending)=>{
    setPending(p);setBusy(true)
    try{
      const field=p.field??(await session.stage(workspace,draftId,p.key,{version:SOURCE_OBLIGATION_VIEW_VERSION,choice:p.input.expectedChoice},p.input,session.writer,true)).fields[p.key]
      setPending({...p,field})
      if(field.conflict||field.writer!==session.writer)throw Error('办理机会选择存在冲突，输入已保留。')
      await session.withFreshField(workspace,draftId,p.key,session.writer,field.revision,p.input,()=>onApply(p.input))
      await session.clear(workspace,draftId,p.key,session.writer,field.revision)
      setPending(null);setStatus('办理机会已保存；仍是同一项领取，尚未创建正式任务。')
    }catch{setStatus('本次选择尚未保存，输入仍保留。请手动恢复；有冲突时先选择采用哪一份，不会自动覆盖。')}finally{setBusy(false)}
  }
  const recover=async()=>{if(!pending)return;try{const next=pending.field&&pending.field.writer!==session.writer?await session.recover(workspace,draftId,session.writer,{[pending.key]:pending.field.revision}):null;await apply(next?{...pending,field:next.fields[pending.key]}:pending)}catch{setStatus('上次选择暂时不能恢复。请保留本页，重新读取通知后核对双方选择。')}}
  if(!views.length&&!pending)return null
  return <section aria-label="领取办理机会"><h3>同一项领取，选择一种办理机会</h3><p>默认使用正常窗口。只有确实错过、且尚未领取时才选择补领；不会安排两次领取。</p>
    {views.map(view=><article className="recognition-entity-row" key={view.goal.taskId}><div>
      {view.goal.opportunities.map(opportunity=><div key={opportunity.id}><strong>{opportunity.id==='normal'?'正常办理':'错过后的补领机会'}{view.choice===opportunity.id?'（当前选择）':''}</strong><p>{handlingWindowLabel(opportunity.window)}</p>
        <details><summary>查看本机会的原文条件、地点和依据</summary>{opportunity.window.evidenceIds.map(id=><blockquote key={id}>{workspace.extractionDrafts.find(d=>d.id===draftId)?.result?.evidence.find(e=>e.id===id)?.quote}</blockquote>)}</details>
        {!view.confirmed&&!view.goal.completedInSource&&<button type="button" disabled={disabled||busy||Boolean(pending)||view.choice===opportunity.id} onClick={()=>void apply({key:`task:receipt-opportunity-${view.goal.taskId}:facts`,field:null,input:{taskId:view.goal.taskId,choice:opportunity.id,expectedChoice:view.choice,expectedResult:workspaceSnapshotHash(workspace.extractionDrafts.find(d=>d.id===draftId)!.result),operationId:crypto.randomUUID()}})}>{opportunity.id==='normal'?'使用正常窗口':'我已错过正常窗口且尚未领取，使用补领机会'}</button>}
      </div>)}
      {view.confirmed&&<p>领取事项已确认；完成后不会再创建补领待办。请在任务中心处理这同一事项。</p>}
      {view.goal.completedInSource&&<p>原文已明确本次领取完成；保留两个机会的说明，不再次创建领取或补领待办。</p>}
    </div></article>)}
    {pending&&<div role="alert"><p>{pending.field?'未完成的办理机会检查点已保留。':'选择仍留在本页，检查点尚未保存；可手动重试。'}</p>
      {pending.field?.conflict?(<>{(['latest','incoming'] as const).map(choice=><button type="button" key={choice} disabled={busy||disabled} onClick={()=>void session.resolve(workspace,draftId,pending.key,choice,session.writer,pending.field!.revision).then(r=>{const field=r.fields[pending.key],input=savedInput(field.mine);if(input)setPending({key:pending.key,input,field})}).catch(()=>setStatus('双方选择仍保留，暂未解决冲突。请重新读取后再选择。'))}>采用{choice==='latest'?'最新选择':'我的选择'}</button>)}</>):<button type="button" disabled={busy||disabled} onClick={()=>void recover()}>恢复并保存办理机会选择</button>}
      <button type="button" disabled={busy||disabled||Boolean(pending.field?.conflict)} onClick={()=>{if(!pending.field){setPending(null);return}void session.clear(workspace,draftId,pending.key,session.writer,pending.field.revision).then(()=>setPending(null)).catch(()=>setStatus('上次选择仍保留，未能放弃；请先恢复或重新读取。'))}}>放弃未保存的机会选择</button>
    </div>}
    {status&&<p role="status">{status}</p>}
  </section>
}
