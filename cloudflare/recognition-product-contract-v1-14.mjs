// Opt-in experiment: a typed task applicability decision replaces the wire
// selection bit. Canonical Workspace and the ordinary1.5 contract do not change.
import {recognitionOutputSchema as previous,productGenerationContract as previousContract} from './recognition-product-contract-v1-5.mjs'

export const PRODUCT_CONTRACT_PROMPT_VERSION='recognition-product-contract-1.14.0'
export const TASK_APPLICABILITY=['unconditional','applies','unknown','optional']
export const recognitionOutputSchema=structuredClone(previous)
recognitionOutputSchema.properties.promptVersion.const=PRODUCT_CONTRACT_PROMPT_VERSION
function replaceTaskSelection(node){
  if(!node||typeof node!=='object')return
  if(node.properties?.actionVerb&&node.properties?.actionObject&&node.properties?.selected){
    node.properties=Object.fromEntries(Object.entries(node.properties).map(([key,value])=>key==='selected'
      ?['applicability',{type:'string',enum:TASK_APPLICABILITY,description:'此已声明行动对当前用户的适用状态：unconditional=原文明示无个人条件的当前行动；applies=原文条件明确成立；unknown=原文有真实条件义务但个人适用性未知；optional=原文允许自愿选择。明确取消或个人不适用仍按原规则保留说明，不造当前任务。'}]:[key,value]))
    node.required=node.required.map(key=>key==='selected'?'applicability':key)
  }
  for(const value of Object.values(node))if(value&&typeof value==='object')replaceTaskSelection(value)
}
replaceTaskSelection(recognitionOutputSchema)
export function productGenerationContract(){
  const base=previousContract(),old=JSON.stringify(previous)
  if(base.split(old).length!==2||base.split('任务，selected=false；').length!==2)throw Error('TASK_APPLICABILITY_SCHEMA_AUTHORITY_NOT_UNIQUE')
  return base.replace(old,JSON.stringify(recognitionOutputSchema)).replace('任务，selected=false；','任务，applicability="optional"；')
}

/** Mechanical one-field projection only. No action, material, time, condition,
 * evidence or owner is created; an empty task array stays empty. A missing or
 * competing decision blocks that task instead of defaulting it executable. */
export function projectTaskApplicability(input){
  const result=structuredClone(input),rows=[]
  const visit=node=>{
    if(!node||typeof node!=='object')return
    if(typeof node.actionVerb==='string'&&typeof node.actionObject==='string'&&typeof node.tempId==='string'){
      const value=node.applicability,valid=TASK_APPLICABILITY.includes(value)&&!Object.hasOwn(node,'selected')
      node.selected=valid&&['unconditional','applies'].includes(value)
      delete node.applicability
      rows.push({taskId:node.tempId,wireValue:value??null,selected:node.selected,status:valid?'EXACT_ENUM_PROJECTION':'INVALID_OR_COMPETING_DECISION'})
      if(!valid){result.conflicts??=[];result.conflicts.push({id:'task-applicability:'+node.tempId,type:'other',message:'这项行动的适用状态未能可靠读取，请核对；其他有依据的事项仍可单独确认。',entityTempIds:[node.tempId],evidenceIds:Array.isArray(node.evidenceIds)?node.evidenceIds:[],requiresDecision:true})}
    }
    for(const child of Object.values(node))if(child&&typeof child==='object')visit(child)
  }
  visit(result)
  return {result,audit:{version:'task-applicability-wire-1.0.0',role:'MECHANICAL_SELECTION_PROJECTION_NOT_FACT_INFERENCE',inferredFacts:0,rows}}
}
