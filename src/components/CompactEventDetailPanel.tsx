import {useId,useRef,useState} from 'react'
import {CalendarDays,MapPin,Trash2,X} from 'lucide-react'
import {useDialogFocusTrap} from '../lib/useDialogFocusTrap'
import {flowEditValue,flowEventDate} from '../lib/flowPresentation'
import {eventDescriptionSections,eventDurationLabel} from '../lib/eventPresentation'
import type {EventDetailPanelProps} from './EventDetailPanel'
import {TextWithLinks} from './TextWithLinks'

export function CompactEventDetailPanel({event,evidenceQuotes,sourceTitles,sourceSupplement=[],onClose,onEdit,onDelete,onDirtyChange,onSetCompletion}:EventDetailPanelProps){
  const id=useId(),ref=useRef<HTMLElement>(null),[title,setTitle]=useState(event.title),[location,setLocation]=useState(event.location??''),[open,setOpen]=useState(false),[start,setStart]=useState(flowEditValue(event.startAt)),[end,setEnd]=useState(flowEditValue(event.endAt)),[startEdited,setStartEdited]=useState(false),[endEdited,setEndEdited]=useState(false),[description,setDescription]=useState(event.description),[minutes,setMinutes]=useState(event.estimatedMinutesKnown&&event.estimatedMinutes?String(event.estimatedMinutes):''),[durationEdited,setDurationEdited]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const baseline=useRef(event),[dirty,setDirty]=useState(false)
  const sections=eventDescriptionSections(event.description).filter(section=>(section.label!=='活动说明'||section.content.trim()!==event.title.trim())&&!(section.label==='时间说明'&&section.content===flowEventDate(event))),duration=eventDurationLabel(event)
  // A short, source-backed biography is useful alongside the speaker. Longer
  // biographies remain available in one disclosure, without changing saved data.
  const biographies=sections.filter(section=>section.label==='嘉宾简介')
  const speakers=sections.filter(section=>section.label==='主讲人'||section.label==='主持人')
  // A biography without a name cannot safely be assigned to one of several
  // guests. Named descriptions can still be shown without guessing ownership.
  const speakerNames=speakers.flatMap(section=>section.content.replace(/^(?:主讲嘉宾|主讲人|报告人|主持人)[：:]\s*/u,'').split(/[、；;]|(?:和|与)(?=.{1,12}$)/u).flatMap(part=>{
    const commaParts=part.split(/[，,]/u).map(name=>name.trim()).filter(Boolean)
    // A comma before a second name may list another guest. A comma followed
    // by a standalone role such as “教授” is instead a single person's title.
    const anotherGuest=commaParts.slice(1).some(name=>/^[\p{Script=Han}A-Za-z·. ]{2,12}$/u.test(name)&&!/^(?:教授|副教授|研究员|记者|博士|讲师|教师|老师|编辑|主持人)$/u.test(name))
    return anotherGuest?commaParts:[part.trim()]
  }).filter(Boolean))
  const previewIndex=speakerNames.length===1?0:biographies.findIndex(section=>speakerNames.some(name=>name.length>=2&&section.content.includes(name)))
  const biography=previewIndex>=0?biographies[previewIndex]?.content:undefined
  const firstSentence=biography?.split(/(?<=[。；;])/u)[0]?.trim()
  const preview=biography&&biography.length<=100?biography:firstSentence&&firstSentence.length<=100&&/[。；;]$/u.test(firstSentence)?firstSentence:undefined
  const remainingBiographies=preview&&preview===biography?biographies.filter((_,index)=>index!==previewIndex):biographies
  const contentSections=sections.filter(section=>section.label!=='主讲人'&&section.label!=='主持人'&&section.label!=='嘉宾简介')
  const markDirty=()=>{setDirty(true);onDirtyChange?.(true)}
  const requestClose=()=>{if(dirty||busy){setError('还有未保存的修改，请先保存或取消修改。');return}onClose()}
  const reset=()=>{setTitle(event.title);setLocation(event.location??'');setStart(flowEditValue(event.startAt));setEnd(flowEditValue(event.endAt));setDescription(event.description);setMinutes(event.estimatedMinutesKnown&&event.estimatedMinutes?String(event.estimatedMinutes):'');setStartEdited(false);setEndEdited(false);setDurationEdited(false);setDirty(false);onDirtyChange?.(false);setError('');setOpen(false)}
  useDialogFocusTrap(ref,requestClose)
  const save=async()=>{if(!onEdit||busy)return;const original=baseline.current;setBusy(true);setError('');try{await onEdit({title:title.trim()||original.title,date:startEdited?start:original.startAt??'',end:endEdited?end:original.endAt??'',...(title.trim()===original.title?{preserveTitle:true}:{}),...(location!==(original.location??'')?{location}:{}),...(description!==original.description?{description}:{}),...(!startEdited?{preserveStart:true}:{}),...(!endEdited?{preserveEnd:true}:{}),...(!startEdited&&!endEdited?{preserveTimes:true}:{}),...(durationEdited?{estimatedMinutes:minutes?Number(minutes):null}:{}),expectedEvent:{title:original.title,description:original.description,location:original.location??'',start:original.startAt??'',end:original.endAt??'',estimateKnown:Boolean(original.estimatedMinutesKnown),estimate:original.estimatedMinutes??null}});setDurationEdited(false);setStartEdited(false);setEndEdited(false);setDirty(false);onDirtyChange?.(false);setOpen(false)}catch(caught){const message=caught instanceof Error?caught.message:'';setError(/已保存|尚未读回|其他页面修改/u.test(message)?message:'未能保存，当前输入保留，请检查后重试。')}finally{setBusy(false)}}
  const setCompletion=async()=>{if(!onSetCompletion||busy||dirty)return;setBusy(true);setError('');try{await onSetCompletion(!event.personalCompleted)}catch(caught){setError(caught instanceof Error?caught.message:'日程状态未能保存，请重试。')}finally{setBusy(false)}}
  return <div className="modal-backdrop detail-backdrop" role="presentation"><aside ref={ref} className="detail-panel compact-detail-panel event-detail-panel" role="dialog" aria-modal="true" aria-labelledby={id}>
    <header className="detail-header"><div><h2 id={id}>{event.title}</h2></div><button className="icon-button" type="button" onClick={requestClose} aria-label="关闭事件详情"><X size={20}/></button></header>
    <div className="detail-body">{error&&<p role="alert">{error}</p>}
      <section className="detail-primary-section" aria-label="时间和地点"><h3><CalendarDays size={16}/>时间</h3><p>{flowEventDate(event)}</p>{duration&&<p>{duration}</p>}{event.location&&<p><MapPin size={15}/>{event.location}</p>}{Boolean(event.directTags?.length)&&<div className="direct-inline-tags">{event.directTags!.map(t=><span className="direct-tag" key={t}>{t}</span>)}</div>}{onEdit&&!open&&<button className="text-button" type="button" onClick={()=>{baseline.current=event;setTitle(event.title);setLocation(event.location??'');setStart(flowEditValue(event.startAt));setEnd(flowEditValue(event.endAt));setDescription(event.description);setMinutes(event.estimatedMinutesKnown&&event.estimatedMinutes?String(event.estimatedMinutes):'');setOpen(true)}}>修改</button>}
        {open&&<form className="compact-date-editor" onSubmit={e=>{e.preventDefault();void save()}}><label>名称<input disabled={busy} value={title} onChange={e=>{setTitle(e.target.value);markDirty()}} required/></label><label>开始<input disabled={busy} type={/^\d{4}-\d{2}-\d{2}$/u.test(start)?'date':'datetime-local'} value={start.slice(0,16)} onChange={e=>{setStart(e.target.value);setStartEdited(true);markDirty()}}/></label><label>结束（可留空）<input disabled={busy} type={/^\d{4}-\d{2}-\d{2}$/u.test(end)?'date':'datetime-local'} value={end.slice(0,16)} onChange={e=>{setEnd(e.target.value);setEndEdited(true);markDirty()}}/></label><label>地点<input disabled={busy} value={location} onChange={e=>{setLocation(e.target.value);markDirty()}}/></label><label>个人预计用时（分钟，可留空）<input disabled={busy} type="number" min="1" max="1440" value={minutes} onChange={e=>{setMinutes(e.target.value);setDurationEdited(true);markDirty()}}/></label><label className="compact-notes-label">活动内容与须知<textarea disabled={busy} value={description} onChange={e=>{setDescription(e.target.value);markDirty()}}/></label><button type="submit" className="primary-button" disabled={busy}>{busy?'正在保存…':'保存修改'}</button><button type="button" className="text-button" disabled={busy} onClick={reset}>取消修改</button></form>}
      </section>
      {speakers.map((section,index)=><section className="detail-primary-section" aria-label={section.label} key={`${section.label}-${index}`}><h3>{section.label}</h3><p>{section.content}</p></section>)}
      {preview&&<section className="detail-primary-section" aria-label="嘉宾简介"><h3>嘉宾简介</h3><p>{preview}</p></section>}
      {contentSections.map((section,index)=><section className="detail-primary-section" aria-label={section.label} key={`${section.label}-${index}`}><h3>{section.label}</h3><p><TextWithLinks text={section.content}/></p></section>)}
      {sourceSupplement.length>0&&<section className="detail-primary-section" aria-label="这条通知还提到"><h3>这条通知还提到（所属事项待确认）</h3>{sourceSupplement.map((text,index)=><p key={`${index}-${text}`}>{text}</p>)}</section>}
      {remainingBiographies.length>0&&<details className="detail-more"><summary>更多嘉宾简介</summary>{remainingBiographies.map((section,index)=><p key={index}>{section.content}</p>)}</details>}
      <details className="detail-more"><summary>更多</summary><section><h3>查看原文</h3>{evidenceQuotes.map(q=><p key={q}>{q}</p>)}{sourceTitles.length>0&&<small>{sourceTitles.join('、')}</small>}</section></details>
    </div><footer className="detail-footer">{onDelete&&<button className="text-button danger-text" type="button" disabled={busy||dirty} onClick={()=>{void onDelete().catch(caught=>setError(caught instanceof Error&&/已保存|尚未读回/u.test(caught.message)?caught.message:'没有删除成功，请重试。'))}}><Trash2 size={16}/>删除</button>}{onSetCompletion&&<button type="button" className="primary-button" disabled={busy||dirty} onClick={()=>void setCompletion()}>{busy?'保存中…':event.personalCompleted?'恢复未完成':'完成日程'}</button>}<button type="button" className="secondary-button" onClick={requestClose}>关闭</button></footer>
  </aside></div>
}
