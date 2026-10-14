import {readFileSync} from 'node:fs'
import {REFERENCE_V7, validateReferenceV7} from './recognition-semantic-v7.mjs'
import {normalize} from './candidate15-reference-contract.mjs'

const field = value=>({canonical:value,aliases:[]})
/** Explicitly provisional product adjudication, based on source obligations, not per-arm output. */
export function makeD13References() {
  const old=JSON.parse(readFileSync('docs/recognition-optimization/candidate15/d9-development/REFERENCES.json','utf8')).references
  const oracles=JSON.parse(readFileSync('docs/recognition-optimization/candidate15/d9-development/LEGAL_WIRE_ORACLES.json','utf8')).oracles
  return old.map(row=> {
    const base=structuredClone(row.reference), number=Number(row.sourceId.slice(-2)), scopes=base.scopeTextById, wire=oracles.find(o=>o.sourceId===row.sourceId).wire
    const supporting = f=>Object.keys(scopes).filter(id=>[f.canonical,...f.aliases].some(v=>normalize(scopes[id]).includes(normalize(v))))
    const policy=(requiredAnyOf,allowed)=>({requiredAnyOf,allowed:[...new Set(allowed)],contradictory:Object.keys(scopes).filter(id=>!allowed.includes(id)&&/不要|不要求|无需|取消|未进入/.test(scopes[id]))})
    for(const task of base.tasks) {
      const actions=supporting(task.action),objects=supporting(task.object)
      task.evidencePolicy={proposition:policy([actions,objects],[...task.scopeIds,...actions,...objects]),
        condition:policy(task.conditionScopeIds.length?[task.conditionScopeIds]:[],task.conditionScopeIds),
        fact:policy(task.factScopeIds.length?[task.factScopeIds]:[],task.factScopeIds)}
      const original=wire.tasks.find(t=>t.id===task.id)
      task.parentTaskId=original.detail.parentTempId
      task.hierarchyType=original.detail.hierarchyType
      task.materialDetails=wire.materials.filter(m=>original.detail.materialTempIds.includes(m.tempId)).map(m=>({...m,evidencePolicy:policy([m.scopeIds],m.scopeIds)}))
      task.timeEvidence=wire.timePoints.filter(t=>original.detail.timePointTempIds.includes(t.tempId)).map(t=>({rawText:t.rawText,type:t.type,relatedTaskTempIds:t.relatedTaskTempIds,evidencePolicy:policy([t.scopeIds],t.scopeIds)}))
    }
    base.relations=base.relations.map((r,i)=>({...r,evidencePolicy:policy([wire.revisions[i].scopeIds],wire.revisions[i].scopeIds)}))
    const representations=[base], forbiddenActions=base.tasks.filter(t=>t.actionability==='not_actionable').map(t=>({action:t.action,object:t.object,scopeIds:t.scopeIds,reason:'explicit_false_or_inactive'}))
    const decisions=['必要命题证据为动作和对象；独立属性各自验证，相关补充scope可接受。','条件前件与成立事实独立；同义/顺序不改变义务，跨对象拆合不合法。']
    if(number===4) {
      const info=structuredClone(base); info.tasks=[]
      info.noTaskFacts=Object.entries(scopes).map(([id,text],i)=>({id:'info'+i,kind:'information',value:text,sourceText:text,aliases:[],scopeIds:[id]}))
      representations.unshift(info)
      decisions.push('根据PRD 5.1/5.4，未入名单且明确不要求参加可tasks=[]；保留false事实同样合法，但不可执行。两个完整表示均预定义。')
    }
    if(number===9) for(const [action,object] of [['取消','预约'],['上传','说明'],['发','邮件']])forbiddenActions.push({action:field(action),object:field(object),scopeIds:Object.keys(scopes).filter(id=>scopes[id].includes(action)&&scopes[id].includes(object)),reason:'explicit_prohibition'})
    if(number===12)for(const [action,object] of [['联系','项目办'],['签字','院长']])forbiddenActions.push({action:field(action),object:field(object),scopeIds:Object.keys(scopes).filter(id=>scopes[id].includes(action)&&scopes[id].includes(object)),reason:'explicit_prohibition'})
    if(number===7){
      const compact=structuredClone(base),unknownScope=Object.keys(scopes).find(id=>scopes[id].includes('确切日期稍后公布'))
      compact.tasks[0].times=compact.tasks[0].times.filter(t=>t.rawText==='月底前后')
      compact.tasks[0].timeEvidence=compact.tasks[0].timeEvidence.filter(t=>t.rawText==='月底前后')
      compact.noTaskFacts.push({id:'date-not-announced',kind:'information',value:'确切日期稍后公布',sourceText:'确切日期稍后公布',aliases:[],scopeIds:[unknownScope]})
      representations.push(compact)
      decisions.push('月底前后保持null/vague/needsConfirmation；尚未公布可作为第二个null时间线索，也可作为原文信息保留。两种表示都不能生成两个确定截止，不强制节点数。')
    }
    return validateReferenceV7({version:REFERENCE_V7,sourceId:row.sourceId,sourceSha256:row.sourceSha256,completeness:'complete',truthStatus:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',author:'Codex / provisional engineering adjudication',seenDegree:'FULLY_SEEN_D5_D8_D9_D11_DEVELOPMENT',decisions,unresolved:[],representations,forbiddenActions})
  })
}
