import {UnassignedSourceMaterials} from './UnassignedSourceMaterials'
import {useId,useRef,useState} from 'react'
import {CheckCircle2,ChevronDown,Trash2,X} from 'lucide-react'
import {useDialogFocusTrap} from '../lib/useDialogFocusTrap'
import {flowEditValue,flowTaskDate,flowEventDate,taskRelativeTimeHint} from '../lib/flowPresentation'
import type {TaskDetailPanelProps} from './TaskDetailPanel'
import {TaskScheduleButton} from './TaskScheduleButton'
import {suggestedTaskDuration} from '../lib/taskDurationSuggestion'
import {formatDuration} from '../lib/taskLogic'
import {TextWithLinks} from './TextWithLinks'
import {taskPublicDescription,taskPublicSummary} from '../lib/taskContentPresentation'
import {MaterialFactsList} from './MaterialFactsList'
import {MaterialEditor} from './MaterialEditor'

export function CompactTaskDetailPanel({task,sources,onClose,onComplete,onUpdate,onSaveTaskPatch,editDraft,onEditDraft,materialEditDrafts,onEditMaterialDraft,onSaveMaterial,onDelete,onDirectEdit,onScheduleTask,canonicalMaterials,semanticContent,onAdvanced,linkedEvent,eventTimeHint}:TaskDetailPanelProps&{onAdvanced:()=>void}){
  const initialDate=flowEditValue(task.deadline||task.directDate)
  const linked=sources.filter(s=>task.sourceIds.includes(s.id))
  const publicNotes=taskPublicDescription(task)
  const id=useId(),ref=useRef<HTMLElement>(null),[title,setTitle]=useState(editDraft?.title??task.title),[notes,setNotes]=useState(editDraft?.description??publicNotes),[dateOpen,setDateOpen]=useState(false),[date,setDate]=useState(initialDate.slice(0,10)),[time,setTime]=useState(initialDate.slice(11,16)),[durationOpen,setDurationOpen]=useState(false),[minutes,setMinutes]=useState(task.estimatedMinutesKnown?String(task.estimatedMinutes):''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  useDialogFocusTrap(ref,onClose)
  const materials=canonicalMaterials??task.materials
  const {location,channels}=taskPublicSummary(task,{channels:materials.flatMap(m=>m.submissionChannel?[m.submissionChannel]:[])})
  const sourceRequirements=[...new Set(task.description.split('\n').map(line=>line.trim()).filter(line=>line.length>0&&line.length<=500&&/(?:须为|必须|不得|不包括|不超过|至少|原创|任选|二选一|或者)/u.test(line)&&linked.some(s=>(s.rawText||s.content||s.contentPreview||'').includes(line))))]
  const durationHint=suggestedTaskDuration(task)
  const relativeHint=taskRelativeTimeHint(task)
  const savePatch=async(patch:Partial<typeof task>)=>{setError('');try{if(onSaveTaskPatch)await onSaveTaskPatch(task.id,patch);else onUpdate(task.id,patch);return true}catch(reason){setError(reason instanceof Error?reason.message:'更改未能保存，请重试。');return false}}
  const saveDate=async()=>{setBusy(true);setError('');try{const value=date?date+(time?'T'+time:''):'';if(onDirectEdit)await onDirectEdit({title:task.title,date:value,preserveTitle:true,expectedDate:task.deadline||task.directDate||''});else onUpdate(task.id,{deadline:value});setDateOpen(false)}catch(reason){setError(reason instanceof Error&&/^(?:更改已保存|日期已在)/u.test(reason.message)?reason.message:'日期未能保存，请重试。')}finally{setBusy(false)}}
  return <div className="modal-backdrop detail-backdrop" role="presentation"><aside className="detail-panel compact-detail-panel" ref={ref} role="dialog" aria-modal="true" aria-labelledby={id}>
    <header className="detail-header"><div><h2 id={id} className="sr-only">待办详情</h2><textarea rows={2} className="detail-title-input" aria-label="待办名称" value={title} maxLength={300} onChange={e=>{setTitle(e.target.value);onEditDraft?.('title',e.target.value===task.title?undefined:e.target.value)}} onBlur={()=>{const value=title.trim();if(!value){setError('请输入待办名称。');return}setTitle(value);onEditDraft?.('title',value===task.title?undefined:value);if(value!==task.title)void savePatch({title:value})}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur()}}}/></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭任务详情"><X size={20}/></button></header>
    <div className="detail-body">
      {error&&<p role="alert" className="inline-error">{error}</p>}
      <section className="detail-primary-section compact-time-section" aria-label="时间和地点"><h3>时间</h3><p className="detail-time-value">{linkedEvent&&flowTaskDate(task)==='未设日期'?flowEventDate(linkedEvent,eventTimeHint):flowTaskDate(task)}</p>
        {relativeHint&&<p>{relativeHint}</p>}
        {linkedEvent&&flowTaskDate(task)!=='未设日期'&&<p>{flowEventDate(linkedEvent,eventTimeHint)}</p>}
        {linkedEvent?.location&&<p>{linkedEvent.location}</p>}
        {location&&location!==linkedEvent?.location&&<p>地点：{location}</p>}
        <div className="compact-time-actions">{onScheduleTask&&<TaskScheduleButton task={task} onSchedule={onScheduleTask}/>} {(task.deadline||!onScheduleTask)&&<button type="button" className="text-button" onClick={()=>setDateOpen(v=>!v)}>{task.deadline?'修改原文截止':'设置日期'}</button>}</div>
        {channels.length>0&&<p className="compact-channel"><TextWithLinks text={channels.join(' · ')}/></p>}
        {(durationHint||task.estimatedMinutesKnown)&&<div className="compact-duration"><span>{task.estimatedMinutesKnown?`预计耗时 ${formatDuration(task.estimatedMinutes)}`:`建议约 ${durationHint}（估计，可修改）`}</span> <button type="button" className="text-button" onClick={()=>setDurationOpen(value=>!value)}>修改耗时</button>{durationOpen&&<form onSubmit={event=>{event.preventDefault();const value=Number(minutes);if(Number.isFinite(value)&&value>=5)void savePatch({estimatedMinutes:value,estimatedMinutesKnown:true}).then(saved=>{if(saved)setDurationOpen(false)})}}><label>预计耗时（分钟）<input type="number" min="5" step="5" value={minutes} onChange={event=>setMinutes(event.target.value)} required/></label><button className="primary-button" type="submit">保存耗时</button></form>}</div>}
        {dateOpen&&<form className="compact-date-editor" onSubmit={e=>{e.preventDefault();void saveDate()}}><label>{task.deadline?'原文截止日期':'日期'}<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>时间（可留空）<input type="time" value={time} onChange={e=>setTime(e.target.value)}/></label><button className="primary-button" disabled={busy} type="submit">保存日期</button></form>}
        {Boolean(task.directTags?.length)&&<div className="direct-inline-tags">{task.directTags!.map(tag=><span className="direct-tag" key={tag}>{tag}</span>)}</div>}
      </section>
      {materials.length>0&&<section className="detail-primary-section" aria-label="材料和要求"><h3>要准备的材料和要求</h3><MaterialFactsList materials={materials}/>{onSaveMaterial&&onEditMaterialDraft&&canonicalMaterials?.map(material=><MaterialEditor key={material.id} material={material} draft={materialEditDrafts?.[material.id]} onDraft={(value,expected)=>onEditMaterialDraft(material.id,value,expected)} onSave={onSaveMaterial}/>)}{sourceRequirements.length>0&&<div className="compact-material-notes"><strong>其他要求</strong>{sourceRequirements.map(value=><p key={value}>{value}</p>)}</div>}</section>}
      <UnassignedSourceMaterials task={task}/>
      <section className="detail-primary-section" aria-label="备注"><label className="compact-notes-label">备注<textarea aria-label="备注" placeholder="添加备注" value={notes} rows={notes?3:2} onChange={e=>{setNotes(e.target.value);onEditDraft?.('description',e.target.value===publicNotes?undefined:e.target.value)}} onBlur={()=>{if(notes!==publicNotes)void savePatch({description:notes})}}/></label></section>
      <details className="detail-more"><summary>更多 <ChevronDown size={15}/></summary><button type="button" className="text-button" onClick={onAdvanced}>提醒与导出到手机日历</button>{semanticContent}<section className="compact-source"><h3>查看原文</h3>{linked.map(s=><div key={s.id}><strong>{s.title}</strong><p>{s.rawText||s.content||s.contentPreview}</p></div>)}</section>{task.history.length>0&&<details><summary>修改记录</summary><ul>{task.history.slice(-8).map(h=><li key={h.id}>{h.field}：{h.after}</li>)}</ul></details>}</details>
    </div>
    <footer className="detail-footer"><button className="text-button danger-text" type="button" disabled={!onDelete||busy} onClick={()=>{setError('');void onDelete?.().catch(reason=>setError(reason instanceof Error&&reason.message.startsWith('更改已保存')?reason.message:'没有删除成功，请重试。'))}}><Trash2 size={16}/>删除</button><button className="primary-button" type="button" disabled={task.status==='已完成'||busy} onClick={()=>onComplete(task.id)}><CheckCircle2 size={17}/>{task.status==='已完成'?'已完成':'完成'}</button></footer>
  </aside></div>
}
