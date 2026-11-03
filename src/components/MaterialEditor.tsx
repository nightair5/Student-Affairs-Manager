import {useState} from 'react'
import type {Material} from '../domain/v2/types'
import type {MaterialCommandValues} from '../domain/v2/materialCommand'

export interface MaterialEditDraft {name:string;quantity:string;formats:string;naming:string;requirements:string;channel:string;base:MaterialCommandValues;ownerIds:string[]}
const makeInitial=(material:Material):MaterialEditDraft=>({name:material.name,quantity:material.quantity===null?'':String(material.quantity),formats:material.formatRequirements.join('\n'),naming:material.namingRequirements.join('\n'),requirements:material.requirements.join('\n'),channel:material.submissionChannel??'',base:{name:material.name,quantity:material.quantity,formatRequirements:material.formatRequirements,namingRequirements:material.namingRequirements,requirements:material.requirements,submissionChannel:material.submissionChannel},ownerIds:[...material.relatedTaskIds]})
export function MaterialEditor({material,draft,onDraft,onSave}:{material:Material;draft?:MaterialEditDraft;onDraft:(value:MaterialEditDraft|undefined,expected?:MaterialEditDraft)=>void;onSave:(material:Material,values:MaterialCommandValues,base:MaterialCommandValues,ownerIds:string[])=>Promise<void>}){
 const initial=makeInitial(material)
 const [open,setOpen]=useState(Boolean(draft)),[values,setValues]=useState(draft??initial),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const change=(field:'name'|'quantity'|'formats'|'naming'|'requirements'|'channel',value:string)=>{const next={...values,[field]:value};setValues(next);onDraft(next)}
 const lines=(value:string)=>value.split('\n').map(line=>line.trim()).filter(Boolean)
 const save=async()=>{
  const quantity=values.quantity.trim()?Number(values.quantity):null
  if(!values.name.trim()){setError('请输入材料名称。');return}
  if(quantity!==null&&(!Number.isSafeInteger(quantity)||quantity<0)){setError('数量请输入非负整数。');return}
  setBusy(true);setError('')
  const all:MaterialCommandValues={name:values.name.trim(),quantity,formatRequirements:lines(values.formats),namingRequirements:lines(values.naming),requirements:lines(values.requirements),submissionChannel:values.channel.trim()||null}
  const changes=Object.fromEntries(Object.entries(all).filter(([field,value])=>JSON.stringify(value)!==JSON.stringify(values.base[field as keyof MaterialCommandValues]))) as MaterialCommandValues
  if(!Object.keys(changes).length){onDraft(undefined,values);setOpen(false);setBusy(false);return}
  try{await onSave(material,changes,values.base,values.ownerIds);onDraft(undefined,values);setOpen(false)}catch(reason){setError(reason instanceof Error?reason.message:'材料要求未能保存，请重试。')}finally{setBusy(false)}
 }
 return <div className="compact-material-editor"><button type="button" className="text-button" onClick={()=>{if(!open&&!draft)setValues(makeInitial(material));setOpen(value=>!value)}} aria-expanded={open}>编辑{material.name}的要求</button>{open&&<form onSubmit={event=>{event.preventDefault();void save()}}>
  {material.relatedTaskIds.length>1&&<p>此材料关联 {material.relatedTaskIds.length} 项待办，修改会同步到这些待办。</p>}
  <fieldset disabled={busy}>
  <label>材料名称<input value={values.name} onChange={event=>change('name',event.target.value)} required/></label>
  <label>数量<input type="number" min="0" step="1" value={values.quantity} onChange={event=>change('quantity',event.target.value)}/></label>
  <label>格式（每行一条）<textarea rows={2} value={values.formats} onChange={event=>change('formats',event.target.value)}/></label>
  <label>命名要求（每行一条）<textarea rows={2} value={values.naming} onChange={event=>change('naming',event.target.value)}/></label>
  <label>其他要求（每行一条）<textarea rows={3} value={values.requirements} onChange={event=>change('requirements',event.target.value)}/></label>
  <label>提交渠道<input value={values.channel} onChange={event=>change('channel',event.target.value)}/></label>
  </fieldset>
  {error&&<p role="alert" className="inline-error">{error}</p>}
  <button type="submit" className="primary-button" disabled={busy}>{busy?'正在保存…':'保存材料要求'}</button> <button type="button" className="text-button" disabled={busy} onClick={()=>{setValues(initial);onDraft(undefined);setError('');setOpen(false)}}>取消修改</button>
 </form>}</div>
}
