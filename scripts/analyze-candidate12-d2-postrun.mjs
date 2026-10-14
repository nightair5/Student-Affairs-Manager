import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,readdirSync} from 'node:fs'
import {join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {isDeepStrictEqual} from 'node:util'
import {scoreCandidate11,currentActionable} from './score-candidate11-recognition.mjs'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'

const DIRECTORY='docs/recognition-optimization/candidate12/d2-provisional-development-20260921a'
const D1='docs/recognition-optimization/candidate12/d1-provisional-paired-preparation'
const LEDGER='C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'
const hash=value=>createHash('sha256').update(value).digest('hex')
const check=(value,code)=>{if(!value)throw Error('CANDIDATE12_D2_POSTRUN_'+code)}
const read=path=>JSON.parse(readFileSync(path,'utf8'))
const write=(name,value)=>writeFileSync(join(DIRECTORY,name),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'})
const normalize=value=>String(value??'').normalize('NFKC').replace(/[\s《》“”‘’「」『』【】()（）\-—_:：,，。；;、]/gu,'').replace(/^(?:该|本|这个)/u,'')
const equivalent=(left,right)=>{const a=normalize(left),b=normalize(right);return a===b||(Math.min(a.length,b.length)>=3&&(a.includes(b)||b.includes(a)))}

function validateLedger(binding){
  const bytes=readFileSync(LEDGER),rows=bytes.toString('utf8').trimEnd().split('\n').map(JSON.parse);let prior='0'.repeat(64)
  rows.forEach((row,sequence)=>{check(row.sequence===sequence&&row.previous===prior&&row.hash===hash(JSON.stringify({sequence,previous:prior,event:row.event})),'LEDGER_CHAIN');prior=row.hash})
  const events=rows.slice(693),reserves=events.filter(row=>row.event.kind==='candidate12D2Reserve'),settles=events.filter(row=>row.event.kind==='candidate12D2Settle')
  check(rows.length===742&&events.filter(row=>row.event.kind==='candidate12D2Grant').length===1&&reserves.length===24&&settles.length===24
    &&!events.some(row=>['candidate12D2Uncertain','candidate12D2Halt'].includes(row.event.kind)),'LEDGER_EVENTS')
  check(isDeepStrictEqual(reserves.map(row=>row.event.unitId),binding.units.map(unit=>unit.unitId)),'LEDGER_ORDER')
  return {rows,events,summary:{rows:rows.length,bytes:bytes.length,sha256:hash(bytes),tail:rows.at(-1).hash,nextSequence:rows.length}}
}

function frozenScorerCompatibility(references){
  const failures=[]
  for(const item of references)try{scoreCandidate11(item.reference.scorerReference,null,{schemaValid:false})}catch(error){failures.push({sourceId:item.sourceId,error:String(error.message).replace(/^.*?(C11_)/u,'$1')})}
  return {status:failures.length?'FAIL':'PASS',scorerVersion:'candidate11-scoring-2.0.0',referenceShapeVersion:'candidate12-provisional-r1',failures,
    impact:'The preregistered frozen scorer cannot consume the frozen scorerReference objects. No Expected value was changed; the official gate therefore fails closed.'}
}

function referenceValid(result,context){
  if(!result)return false
  const scopes=new Set(context.index.scopes.map(scope=>scope.id)),tasks=new Set(result.tasks.map(task=>task.id)),materials=new Set(result.materials.map(item=>item.tempId)),times=new Set(result.timePoints.map(item=>item.tempId)),scopeArrays=[]
  for(const task of result.tasks){scopeArrays.push(task.propositionScopeIds,task.condition.conditionScopeIds,task.condition.factScopeIds);if(task.detail.dependencyTempIds.some(id=>!tasks.has(id))||task.detail.materialTempIds.some(id=>!materials.has(id))||task.detail.timePointTempIds.some(id=>!times.has(id)))return false}
  for(const item of [...result.materials,...result.timePoints]){scopeArrays.push(item.scopeIds);if(item.relatedTaskTempIds.some(id=>!tasks.has(id)))return false}
  for(const revision of result.revisions){scopeArrays.push(revision.scopeIds);if(!tasks.has(revision.targetDirectiveId)||(revision.fromDirectiveId!==null&&!tasks.has(revision.fromDirectiveId)))return false}
  return scopeArrays.flat().every(id=>scopes.has(id))
}

function foreignScopes(result,context){
  if(!result)return []
  const current=new Set(context.index.scopes.map(scope=>scope.id)),serialized=JSON.stringify(result)
  return [...new Set((serialized.match(/scope-[0-9]{4}-[a-f0-9]{64}/gu)??[]).filter(id=>!current.has(id)))]
}

function taskPairCompatible(expected,predicted){
  if(equivalent(expected.action,predicted.action.surface)&&equivalent(expected.object,predicted.object.surface))return true
  const phrase=normalize(predicted.action.surface+predicted.object.surface)
  return expected.evidence.some(value=>normalize(value).includes(phrase))
}

function expectedEndpoint(expected){return ['superseded','cancelled'].includes(expected.status)?'historical':'current'}
function predictedEndpoint(predicted){return predicted.semantics.validity==='superseded'||predicted.semantics.status==='cancelled'?'historical':'current'}
function expectedState(expected){return expectedEndpoint(expected)==='historical'?{status:'cancelled',validity:'superseded'}:{status:'pending',validity:'active'}}

function pairFields(reference,expected,predicted,result){
  const state=expectedState(expected),actualMaterials=result.materials.filter(item=>item.relatedTaskTempIds.includes(predicted.id)).map(item=>item.name),expectedMaterials=reference.materials.filter(item=>expected.materialIds.includes(item.id)).map(item=>item.name)
  const actualTimes=result.timePoints.filter(item=>item.relatedTaskTempIds.includes(predicted.id)).map(item=>item.rawText),expectedTimes=reference.timePoints.filter(item=>expected.timePointIds.includes(item.id)).map(item=>item.rawText)
  const fields=[
    {path:'semantics.status',pass:predicted.semantics.status===state.status},
    {path:'semantics.validity',pass:predicted.semantics.validity===state.validity},
    {path:'condition.value',pass:predicted.condition.value===expected.condition.value},
    {path:'actionable',pass:currentActionable(predicted)===expected.actionable},
    {path:'materials',pass:expectedMaterials.length===actualMaterials.length&&expectedMaterials.every(value=>actualMaterials.some(actual=>equivalent(value,actual)))},
    {path:'timeRaw',pass:expectedTimes.length===actualTimes.length&&expectedTimes.every(value=>actualTimes.some(actual=>normalize(value)===normalize(actual)))},
  ]
  return fields
}

function bestAlignment(reference,result){
  const expected=reference.minimalObligations,predicted=result.tasks,best={matched:-1,fieldPass:-1,maps:[]},used=new Set(),mapping=[]
  function visit(index,matched,passed){
    if(index===expected.length){if(matched>best.matched||matched===best.matched&&passed>best.fieldPass){best.matched=matched;best.fieldPass=passed;best.maps=[mapping.slice()]}
      else if(matched===best.matched&&passed===best.fieldPass)best.maps.push(mapping.slice());return}
    for(let candidate=0;candidate<predicted.length;candidate++)if(!used.has(candidate)&&taskPairCompatible(expected[index],predicted[candidate])){
      used.add(candidate);mapping.push(candidate);visit(index+1,matched+1,passed+pairFields(reference,expected[index],predicted[candidate],result).filter(field=>field.pass).length);mapping.pop();used.delete(candidate)
    }
    mapping.push(-1);visit(index+1,matched,passed);mapping.pop()
  }
  visit(0,0,0)
  const signature=value=>value.join(','),unique=[...new Map(best.maps.map(value=>[signature(value),value])).values()]
  return {mapping:unique[0]??[],ambiguous:unique.length>1,alternatives:unique.length}
}

function revisionCheck(reference,result,alignment){
  if(!reference.revisions.length)return {status:'NOT_APPLICABLE',expected:0,actual:result.revisions.length}
  const mapped=Object.fromEntries(reference.minimalObligations.map((item,index)=>[item.id,alignment[index]===-1?null:result.tasks[alignment[index]].id]))
  const matched=reference.revisions.filter(item=>result.revisions.some(actual=>actual.type===item.type&&actual.effective===(item.effective?'true':'false')
    &&actual.targetDirectiveId===mapped[item.targetObligationId]&&actual.fromDirectiveId===(item.fromObligationId===null?null:mapped[item.fromObligationId]))).length
  return {status:matched===reference.revisions.length&&result.revisions.length===reference.revisions.length?'PASS':'FAIL',expected:reference.revisions.length,actual:result.revisions.length,matched,mapping:mapped}
}

function evaluate(referenceEntry,result,context){
  const reference=referenceEntry.reference
  if(!result.assembled||result.parseError)return {determinate:true,schemaValid:false,referenceValid:false,complete:false,criticalMajor:0,major:reference.minimalObligations.length,severe:1,forbidden:0,teachingLeak:[],ambiguity:[],task:{tp:0,fp:0,fn:reference.minimalObligations.length,precision:null,recall:0,f1:0},alignment:[],revision:{status:'NOT_SCORED'},completionStandard:'NOT_SCORABLE_FROM_FROZEN_SCORER_REFERENCE'}
  const assembled=result.assembled,valid=referenceValid(assembled,context),leaks=foreignScopes(assembled,context),match=bestAlignment(reference,assembled),rows=reference.minimalObligations.map((expected,index)=>{
    const predictedIndex=match.mapping[index],predicted=predictedIndex===-1?null:assembled.tasks[predictedIndex]
    return {goldId:expected.id,predictedId:predicted?.id??null,fields:predicted?pairFields(reference,expected,predicted,assembled):[],aligned:Boolean(predicted)}
  }),revision=revisionCheck(reference,assembled,match.mapping),tp=rows.filter(row=>row.aligned).length,fp=assembled.tasks.length-tp,fn=reference.minimalObligations.length-tp,precision=assembled.tasks.length?tp/assembled.tasks.length:null,recall=reference.minimalObligations.length?tp/reference.minimalObligations.length:(assembled.tasks.length?0:1)
  const fieldFailures=rows.flatMap(row=>row.fields.filter(field=>!field.pass).map(field=>({goldId:row.goldId,path:field.path}))),criticalMajor=fieldFailures.length+(revision.status==='FAIL'?1:0),severe=(valid?0:1)+(match.ambiguous?1:0)
  const complete=fn===0&&fp===0&&criticalMajor===0&&severe===0&&leaks.length===0
  return {determinate:true,schemaValid:true,referenceValid:valid,complete,criticalMajor,major:criticalMajor+fn+fp,severe,forbidden:fp+leaks.length,teachingLeak:leaks,ambiguity:match.ambiguous?['POSTRUN_MATCH_AMBIGUOUS']:[],
    task:{tp,fp,fn,precision,recall,f1:precision===null||precision+recall===0?0:2*precision*recall/(precision+recall)},alignment:rows,revision,completionStandard:'NOT_SCORABLE_FROM_FROZEN_SCORER_REFERENCE'}
}

function summarize(cases){
  const tp=cases.reduce((n,row)=>n+row.evaluation.task.tp,0),fp=cases.reduce((n,row)=>n+row.evaluation.task.fp,0),fn=cases.reduce((n,row)=>n+row.evaluation.task.fn,0),precision=tp+fp?tp/(tp+fp):null,recall=tp+fn?tp/(tp+fn):null
  return {sources:cases.length,determinate:cases.filter(row=>row.evaluation.determinate).length,schemaAndReferenceValid:cases.filter(row=>row.evaluation.schemaValid&&row.evaluation.referenceValid).length,completeSources:cases.filter(row=>row.evaluation.complete).length,
    criticalMajor:cases.reduce((n,row)=>n+row.evaluation.criticalMajor,0),major:cases.reduce((n,row)=>n+row.evaluation.major,0),severe:cases.reduce((n,row)=>n+row.evaluation.severe,0),forbidden:cases.reduce((n,row)=>n+row.evaluation.forbidden,0),teachingLeak:cases.reduce((n,row)=>n+row.evaluation.teachingLeak.length,0),
    task:{tp,fp,fn,precision,recall,f1:precision===null||recall===null||precision+recall===0?0:2*precision*recall/(precision+recall)}}
}

export function analyzeCandidate12D2Postrun({writeOutputs=true}={}){
  const bindingBytes=readFileSync(join(DIRECTORY,'BINDING.json')),binding=JSON.parse(bindingBytes),packets=read(join(D1,'PREPARED_REQUEST_IDENTITIES.json')).requests,references=read(join(D1,'PROVISIONAL_REFERENCES.json')).references
  check(binding.units.length===24&&hash(readFileSync('scripts/run-candidate12-d2.mjs'))===binding.dependencies.find(file=>file.path==='scripts/run-candidate12-d2.mjs').sha256,'FROZEN_RUNNER')
  check(hash(readFileSync(join(D1,'PREPARATION_MANIFEST.json')))==='e2a14c8a920613f8cdd44afa57699f674f266f102df28b2eb926e1b750b1e005','D1_MANIFEST')
  check(verifyProtectedFiles().count===84,'PROTECTED_FILES')
  const ledgerData=validateLedger(binding),compatibility=frozenScorerCompatibility(references),cases=[]
  check(readdirSync(join(DIRECTORY,'raw')).filter(name=>name.endsWith('.jsonl')).length===24&&readdirSync(join(DIRECTORY,'results')).filter(name=>name.endsWith('.json')).length===24,'RESULT_COUNTS')
  for(const unit of binding.units){const result=read(join(DIRECTORY,'results',unit.unitId+'.json')),packet=packets.find(item=>item.unitId===unit.unitId),reference=references.find(item=>item.sourceId===unit.sourceId),rawLines=readFileSync(join(DIRECTORY,'raw',unit.unitId+'.jsonl'),'utf8').trimEnd().split('\n').map(JSON.parse)
    check(rawLines.length===1&&rawLines[0].responseSha===hash(rawLines[0].rawHttpText)&&result.responseSha===rawLines[0].responseSha&&result.ledgerStatus==='settled','RAW_RESULT_BINDING')
    cases.push({unitId:unit.unitId,ordinal:unit.ordinal,sourceId:unit.sourceId,arm:unit.arm,candidateVersion:unit.candidateVersion,requestBytes:unit.requestBytes,responseSha:result.responseSha,usage:result.usage,costUpperMicroCny:result.costUpperMicroCny,waitingMs:result.waitingMs,evaluation:evaluate(reference,result,packet.prepared.context)})
  }
  const arms={A:summarize(cases.filter(row=>row.arm==='A')),B:summarize(cases.filter(row=>row.arm==='B'))},diagnosticGates={allDeterminate:cases.every(row=>row.evaluation.determinate&&!row.evaluation.ambiguity.length),bothArmsSchemaAndReferenceValid:arms.A.schemaAndReferenceValid===12&&arms.B.schemaAndReferenceValid===12,candidate12Safety:arms.B.severe===0&&arms.B.forbidden===0&&arms.B.teachingLeak===0,noRegression:arms.B.task.fn<=arms.A.task.fn&&arms.B.criticalMajor<=arms.A.criticalMajor,completeSourceGain:arms.B.completeSources>=arms.A.completeSources+2}
  const pairs=[...new Set(cases.map(row=>row.sourceId))].map(sourceId=>{const a=cases.find(row=>row.sourceId===sourceId&&row.arm==='A'),b=cases.find(row=>row.sourceId===sourceId&&row.arm==='B');return {sourceId,AComplete:a.evaluation.complete,BComplete:b.evaluation.complete,completeDelta:Number(b.evaluation.complete)-Number(a.evaluation.complete),taskFnDelta:b.evaluation.task.fn-a.evaluation.task.fn,criticalMajorDelta:b.evaluation.criticalMajor-a.evaluation.criticalMajor}})
  const totalCost=cases.reduce((n,row)=>n+row.costUpperMicroCny,0),executionUnits=binding.units.map(unit=>{const reserve=ledgerData.events.find(row=>row.event.kind==='candidate12D2Reserve'&&row.event.unitId===unit.unitId),settle=ledgerData.events.find(row=>row.event.kind==='candidate12D2Settle'&&row.event.unitId===unit.unitId),result=read(join(DIRECTORY,'results',unit.unitId+'.json'))
    return {unitId:unit.unitId,ordinal:unit.ordinal,sourceId:unit.sourceId,arm:unit.arm,requestSha:unit.requestSha,reserve:{sequence:reserve.sequence,nonce:reserve.event.nonce,reservedMicroCny:reserve.event.reservedMicroCny,ledgerHash:reserve.hash},raw:{path:`raw/${unit.unitId}.jsonl`,responseSha:result.responseSha,httpStatus:result.httpStatus},providerRequestId:settle.event.responseId,usage:settle.event.usage,settlement:{sequence:settle.sequence,status:'settled',costUpperMicroCny:settle.event.costUpperMicroCny,ledgerHash:settle.hash},providerBilledCny:'NOT_OBSERVABLE'}})
  const generatedAt=writeOutputs?new Date().toISOString():read(join(DIRECTORY,'ANALYSIS.json')).generatedAt
  const output={version:'candidate12-d2-postrun-analysis-1',status:'D2_EXECUTION_COMPLETE_SCORING_PACKAGE_INVALID',evaluationRole:'SEEN_SYNTHETIC_DEVELOPMENT',truthStatus:'PROVISIONAL_MODEL_AUTHORED',claimCeiling:'ENGINEERING_SCREENING_ONLY',bindingSha:hash(bindingBytes),requests:24,sources:12,
    frozenScorerCompatibility:compatibility,officialDecision:'REJECT_CANDIDATE12_ENGINEERING_SCREEN',officialDecisionReason:'FROZEN_SCORER_REFERENCE_CONTRACT_MISMATCH',diagnosticOnly:{method:'postrun-task-structure-diagnostic-1',notPreregistered:true,notPromotionEvidence:true,completionStandard:'NOT_SCORABLE_FROM_FROZEN_SCORER_REFERENCE',arms,pairs,gates:diagnosticGates},cases,
    operational:{actualCalls:24,settledCalls:24,retries:0,repairs:0,verifiers:0,providerBilledCny:'NOT_OBSERVABLE',localAuditableCostUpperMicroCny:totalCost,authorizedWorstMicroCny:51904512,usage:{inputTokens:cases.reduce((n,row)=>n+row.usage.input_tokens,0),outputTokens:cases.reduce((n,row)=>n+row.usage.output_tokens,0)}},
    ledger:{before:read(join(DIRECTORY,'BASELINE.json')).ledger,after:ledgerData.summary},boundaries:['Seen synthetic Development only','provisional model-authored reference','frozen scorer/reference interface mismatch fails the official gate closed','postrun diagnostic is descriptive and not preregistered','not a real accept-and-save conversion rate','no Holdout, human trial, deployment or production authorization'],generatedAt}
  const executionLedger={version:'candidate12-d2-execution-ledger-1',grantSequence:ledgerData.events[0].sequence,grantId:ledgerData.events[0].event.grant.grantId,units:executionUnits,ledgerBefore:output.ledger.before,ledgerAfter:output.ledger.after}
  const pct=value=>value===null?'NA':(value*100).toFixed(2)+'%',lines=['# Candidate12 D2 临时 Development 配对评测','',`状态：\`${output.status}\`。`,'','24 个冻结请求均一次发送并确定结算；没有重试、repair 或 verifier。','',
    '正式预注册结论：`REJECT_CANDIDATE12_ENGINEERING_SCREEN`。原因不是 Candidate12 已被证明较差，而是冻结的 `scorerReference` 结构与冻结评分器接口不兼容；为了不在看见结果后改 Expected 或评分门槛，本轮正式筛选按失败关闭。','',
    '下表是透明的事后任务结构诊断，只帮助定位方向，不能替代预注册评分、独立人工 Holdout 或真实转化率。完成标准在冻结 scorerReference 中没有可执行规则，因此标为 `NOT_SCORABLE`。','',
    '| 臂 | 候选 | Schema+引用有效 | 诊断完整来源 | TP / FP / FN | P / R / F1 | Critical Major | Severe | Forbidden |','|---|---|---:|---:|---:|---:|---:|---:|---:|',
    ...[['A','Candidate03'],['B','Candidate12']].map(([key,name])=>{const arm=arms[key];return `| ${key} | ${name} | ${arm.schemaAndReferenceValid}/12 | ${arm.completeSources}/12 | ${arm.task.tp} / ${arm.task.fp} / ${arm.task.fn} | ${pct(arm.task.precision)} / ${pct(arm.task.recall)} / ${pct(arm.task.f1)} | ${arm.criticalMajor} | ${arm.severe} | ${arm.forbidden} |`}),
    '',`诊断门槛：${Object.entries(diagnosticGates).map(([key,value])=>`${key}=${value?'PASS':'FAIL'}`).join('；')}。`,'',`实际调用：24；本地可审计费用上界：CNY ${(totalCost/1e6).toFixed(6)}；provider 实际扣费：NOT_OBSERVABLE。`,
    '',`账本：${ledgerData.summary.rows} 行，SHA-256 \`${ledgerData.summary.sha256}\`，tail \`${ledgerData.summary.tail}\`。`,'','数据边界：已见合成 Development、模型作者临时参照；不是独立人工 Holdout，不是用户接受并保存的真实识别转化率。','', '历史 RCO-5-007 保留：`FREEZE_HASH_MISMATCH:package-lock.json`。','']
  const report=lines.join('\n')
  if(writeOutputs){write('EXECUTION_LEDGER.json',executionLedger);write('ANALYSIS.json',output);write('REPORT.md',report)}
  else for(const [name,value] of [['EXECUTION_LEDGER.json',JSON.stringify(executionLedger,null,2)+'\n'],['ANALYSIS.json',JSON.stringify(output,null,2)+'\n'],['REPORT.md',report]])check(readFileSync(join(DIRECTORY,name),'utf8')===value,'OUTPUT_DRIFT:'+name)
  return output
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const args=process.argv.slice(2);check(args.length===0||args.length===1&&args[0]==='--verify','ARGUMENT');console.log(JSON.stringify(analyzeCandidate12D2Postrun({writeOutputs:args.length===0})))}
