import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {diagnoseRecordedFacts,RECORDED_FACT_REFERENCES,type FactReference} from './recordedFactDiagnostic'
import {decodeCurrentSourceRecording,projectConditionalNonAction} from './conditionalNonActionProduct'
import {assembleSemanticFirstSuggestionD26} from './firstSuggestionD26'
import {indexImmutableScopesV11} from './scopeIndexV11'
import type {SourceContractV4} from './sourceContractV4'
const root='docs/recognition-optimization/candidate19-development/'
const sources=JSON.parse(readFileSync(root+'SOURCES.json','utf8')).sources as Array<{sourceId:string;sourceVersionId:string;sourceText:string;referenceTime:string;timezone:string}>
const ordinals=[[1,0,'Candidate17'],[2,0,'Candidate19'],[3,1,'Candidate19'],[4,1,'Candidate17'],[5,2,'Candidate17'],[6,2,'Candidate19'],[7,3,'Candidate19'],[8,3,'Candidate17'],[9,4,'Candidate17'],[10,4,'Candidate19'],[11,5,'Candidate19'],[12,5,'Candidate17']] as const
const raw=(n:number)=>(JSON.parse(readFileSync(root+'paid-evidence/'+(n<3?'':'completed/')+`raw-${String(n).padStart(2,'0')}.json`,'utf8')) as {rawHttpText:string}).rawHttpText
async function sample(n:number){const row=ordinals[n-1],s=sources[row[1]],context={index:await indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone},p=decodeCurrentSourceRecording(raw(n),row[2],context)
  return {context,input:assembleSemanticFirstSuggestionD26(projectConditionalNonAction(p.originalAdapted,context).result,context).result,ref:RECORDED_FACT_REFERENCES[row[1]]}
}
describe('provisional source facts, separated from v11 quotation/format scoring',()=>{
  it('evaluates all twelve recordings with fixed denominators and preserves real omissions/type errors and the channel dispute',async()=>{
    const statuses=[]
    for(let n=1;n<=12;n++){const s=await sample(n);statuses.push(diagnoseRecordedFacts(s.ref,s.input,s.context).completeStatus)}
    expect(statuses).toEqual(['FACT_ERROR','PROVISIONAL_STRUCTURED_PASS','PROVISIONAL_STRUCTURED_PASS','FACT_ERROR','PROVISIONAL_STRUCTURED_PASS','PROVISIONAL_STRUCTURED_PASS','PROVISIONAL_STRUCTURED_PASS','PROVISIONAL_STRUCTURED_PASS','PROVISIONAL_STRUCTURED_PASS','UNKNOWN','PROVISIONAL_STRUCTURED_PASS','PROVISIONAL_STRUCTURED_PASS'])
    const q=await sample(4),r=diagnoseRecordedFacts(q.ref,q.input,q.context)
    expect(r.risks.map(x=>x.kind)).toContain('TIME_VALUE_TYPE_PRECISION_WRONG');expect(r.risks.map(x=>x.kind)).toContain('TIME_MISSING_OR_ENDPOINT_WRONG')
    const s=await sample(10);expect(diagnoseRecordedFacts(s.ref,s.input,s.context).disputes[0].kind).toBe('MATERIAL_CHANNEL_NOT_EXPLICITLY_RESOLVED')
  })
  it('same-object lossless time truncation, punctuation, literal short material name and order do not change facts',async()=>{
    const s=await sample(9),input=structuredClone(s.input)
    input.timePoints[2].rawText='15:35';input.materials[0].name='统计表';input.materials[0].namingRequirements=['文件名称含小组编号']
    input.tasks[0].detail.completionCriteria=['平台显示接收成功后办结'];input.timePoints.reverse();input.events.reverse();input.materials.reverse()
    expect(diagnoseRecordedFacts(s.ref,input,s.context).completeStatus).toBe('PROVISIONAL_STRUCTURED_PASS')
  })
  it('rejects minimal semantic date, type, unknown certainty, precision, endpoint, wrong object/scope and material changes',async()=>{
    const s=await sample(9),mutations:Array<(x:typeof s.input)=>void>=[
      x=>{x.timePoints[0].normalizedValue='2026-11-14T09:25'},x=>{x.timePoints[0].type='planned_start'},
      x=>{x.timePoints[2].precision='date_only'},x=>{x.events[0].endTimePointTempId=x.timePoints[0].tempId},
      x=>{x.timePoints[2].rawText='15:36'},x=>{x.timePoints[2].scopeIds=x.timePoints[0].scopeIds},
      x=>{x.materials[0].relatedTaskTempIds=['scope-not-an-entity']},x=>{x.materials[0].formatRequirements=['Word']},
      x=>{x.materials[0].namingRequirements=[]},x=>{x.tasks[0].object.surface='另一份统计表'},
      x=>{x.tasks[0].detail.completionCriteria=['上传后自动办结']},x=>{x.sourceId='foreign'},
      x=>{x.events[0].location='本通知未提供的礼堂'},x=>{x.tasks[0].propositionScopeIds.push(x.events[0].scopeIds[0])},
      x=>{x.tasks[0].detail.timePointTempIds.push(x.events[0].startTimePointTempId!)},x=>{x.tasks[0].semantics.modality='optional'},
      x=>{x.tasks[0].eventTempIds=[x.events[0].tempId]},x=>{x.tasks[0].coverage.time='not_stated'},
    ]
    for(const mutate of mutations){const x=structuredClone(s.input);mutate(x);expect(diagnoseRecordedFacts(s.ref,x,s.context).completeStatus).toBe('FACT_ERROR')}
    const t=await sample(3),x=structuredClone(t.input);x.timePoints[3].normalizedValue='2026-11-13T18:00';expect(diagnoseRecordedFacts(t.ref,x,t.context).completeStatus).toBe('FACT_ERROR')
  })
  it('missing events/time/material/required information, extra actions, dependency rewiring and invented completion cannot pass',async()=>{
    const s=await sample(9)
    for(const mutate of [(x:typeof s.input)=>{x.events=[]},(x:typeof s.input)=>{x.timePoints=[]},(x:typeof s.input)=>{x.materials=[]},(x:typeof s.input)=>{x.tasks.push({...structuredClone(x.tasks[0]),id:'extra'})}]){const x=structuredClone(s.input);mutate(x);expect(diagnoseRecordedFacts(s.ref,x,s.context).completeStatus).toBe('FACT_ERROR')}
    const t=await sample(5)
    for(const mutate of [(x:typeof t.input)=>{x.tasks[1].detail.dependencyTempIds=[]},(x:typeof t.input)=>{x.tasks[0].semantics.status='completed'},(x:typeof t.input)=>{x.tasks[2].condition.value='true'}]){const x=structuredClone(t.input);mutate(x);expect(diagnoseRecordedFacts(t.ref,x,t.context).completeStatus).toBe('FACT_ERROR')}
    const q=await sample(11),x=structuredClone(q.input);x.informationScopeIds=[];expect(diagnoseRecordedFacts(q.ref,x,q.context).completeStatus).toBe('FACT_ERROR')
    expect(diagnoseRecordedFacts({...q.ref,completeness:'PARTIAL'},q.input,q.context).completeStatus).toBe('UNKNOWN')
  })
  it('a different source, dates, object and names passes real Schema/adapter with an independently authored reference; minimal wrong time fails',async()=>{
    const old=await sample(10),text='请在2027年5月6日08:15前上传设备借用清单。清单须为PDF，文件名包含班级编号。看到平台显示接收成功才算办结。安全说明会2027年5月7日13:20开始，14:35结束。'
    const context={...old.context,index:await indexImmutableScopesV11('independent-wording','v1',text)}
    let http=raw(10)
    for(let i=0;i<old.context.index.scopes.length;i++)http=http.replaceAll(old.context.index.scopes[i].id,context.index.scopes[i].id)
    for(const [a,b] of [['志愿服务统计表','设备借用清单'],['统计表','清单'],['小组编号','班级编号'],['培训说明会','安全说明会'],['2026年11月13日09:25','2027年5月6日08:15'],['2026年11月14日14:20','2027年5月7日13:20'],['15:35','14:35']])http=http.replaceAll(a,b)
    const envelope=JSON.parse(http),wire=JSON.parse(envelope.output[0].content[0].text) as SourceContractV4;wire.materials[0].submissionChannel=null;wire.scopeAccounting.reverse();envelope.output[0].content[0].text=JSON.stringify(wire)
    const p=decodeCurrentSourceRecording(JSON.stringify(envelope),'EngineeringFixture',context),input=assembleSemanticFirstSuggestionD26(projectConditionalNonAction(p.originalAdapted,context).result,context).result
    const ref:FactReference=JSON.parse(JSON.stringify(RECORDED_FACT_REFERENCES[4]).replaceAll('C19-DEV-S05','independent-wording').replaceAll('志愿服务统计表','设备借用清单').replaceAll('统计表','清单').replaceAll('小组编号','班级编号').replaceAll('培训说明会','安全说明会').replaceAll('2026年11月13日09:25','2027年5月6日08:15').replaceAll('2026年11月14日14:20','2027年5月7日13:20').replaceAll('15:35','14:35'))
    // Independent explicit expected values, never ask the parser to generate its own oracle.
    ref.times[0].value='2027-05-06T08:15';ref.times[1].value='2027-05-07T13:20';ref.times[2].value='2027-05-07T14:35'
    expect(diagnoseRecordedFacts(ref,input,context).completeStatus).toBe('PROVISIONAL_STRUCTURED_PASS')
    input.timePoints[2].normalizedValue='2027-05-06T14:35';expect(diagnoseRecordedFacts(ref,input,context).completeStatus).toBe('FACT_ERROR')
  })
})
