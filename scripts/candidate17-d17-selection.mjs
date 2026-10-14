// Applies D16 PRE_REGISTRATION.json without changing the frozen v7 scorer.
const criticalFields=new Set(['times','materials','materialDetails','currentness','condition','actionability','dependencies'])
const countField=(score,field)=>score.fieldErrors?.filter(error=>error.field===field).length??0
const errorKey=error=>`${error.expectedId??'UNKNOWN'}:${error.field}`
const finite=(value)=>Number.isSafeInteger(value)&&value>=0

export function selectD16Development(cases){
  if(!Array.isArray(cases)||cases.length!==24||cases.some(row=>row.determinate!==true))return {status:'INSUFFICIENT_EVIDENCE',reason:'INCOMPLETE_OR_UNCERTAIN'}
  const pairs=new Map()
  for(const row of cases){
    if(!row.sourceId||!['A','B'].includes(row.arm)||!row.schemaValid||!row.referenceValid||row.score?.status!=='SCORED'||row.adjudication==='UNRESOLVED_IMPACTING_COMPARISON')return {status:'INSUFFICIENT_EVIDENCE',reason:'INVALID_OR_UNRESOLVED'}
    const pair=pairs.get(row.sourceId)??{}
    if(pair[row.arm])return {status:'INSUFFICIENT_EVIDENCE',reason:'DUPLICATE_ARM'}
    pair[row.arm]=row;pairs.set(row.sourceId,pair)
  }
  if(pairs.size!==12||[...pairs.values()].some(pair=>!pair.A||!pair.B))return {status:'INSUFFICIENT_EVIDENCE',reason:'UNBALANCED_PAIRS'}
  const risk=[],wins=[],losses=[]
  for(const [sourceId,{A:a,B:b}] of pairs){
    const x=a.score,y=b.score,why=[]
    if(!finite(x.currentTaskRisk?.fn)||!finite(y.currentTaskRisk?.fn)||!finite(x.currentTaskRisk?.unsupportedActionable)||!finite(y.currentTaskRisk?.unsupportedActionable)||!finite(y.severity?.severe)||!finite(y.severity?.forbidden))return {status:'INSUFFICIENT_EVIDENCE',reason:'MISSING_RISK_FIELDS'}
    if(y.currentTaskRisk.fn>x.currentTaskRisk.fn)why.push('NEW_CRITICAL_FN')
    const aMatched=new Set(x.matches?.map(match=>match.expectedId)??[]),bMatched=new Set(y.matches?.map(match=>match.expectedId)??[])
    if([...aMatched].some(id=>!bMatched.has(id)))why.push('NEW_MATCHED_TASK_LOSS')
    if(y.currentTaskRisk.unsupportedActionable>x.currentTaskRisk.unsupportedActionable)why.push('NEW_UNSUPPORTED_ACTION')
    const aErrors=new Set((x.fieldErrors??[]).filter(error=>criticalFields.has(error.field)).map(errorKey))
    for(const field of criticalFields)if(countField(y,field)>countField(x,field)||(y.fieldErrors??[]).some(error=>error.field===field&&!aErrors.has(errorKey(error))))why.push('NEW_'+field.toUpperCase()+'_ERROR')
    if(y.relationsPass===false&&x.relationsPass!==false)why.push('NEW_REVISION_RELATION_ERROR')
    if(y.severity.severe>0)why.push('CANDIDATE17_SEVERE')
    if(y.severity.forbidden>0)why.push('CANDIDATE17_FORBIDDEN')
    if(why.length)risk.push({sourceId,reasons:[...new Set(why)]})
    if(y.complete&&!x.complete)wins.push(sourceId)
    if(x.complete&&!y.complete)losses.push(sourceId)
  }
  const aWhole=[...pairs.values()].filter(pair=>pair.A.score.complete).length
  const bWhole=[...pairs.values()].filter(pair=>pair.B.score.complete).length
  let status='NO_WHOLE_SOURCE_IMPROVEMENT'
  if(risk.length)status=bWhole>aWhole?'MIXED_PROGRESS':'RISK_REGRESSION'
  else if(wins.length&&losses.length)status='MIXED_PROGRESS'
  else if(bWhole>aWhole)status='DEVELOPMENT_IMPROVEMENT_OBSERVED'
  return {status,candidate03WholeCorrect:aWhole,candidate17WholeCorrect:bWhole,wins,losses,ties:12-wins.length-losses.length,risk}
}
