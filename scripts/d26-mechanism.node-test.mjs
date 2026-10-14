import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {makeD26ReferenceData} from './d26-reference-data.mjs'
import {d26Components} from './d26-components.mjs'
import {scoreD26,selectD26} from './d26-scoring.mjs'
import {scoreD25} from './d25-scoring.mjs'

const x=await d26Components(),data=await makeD26ReferenceData(),sources=data['SOURCES.json'].sources,refs=data['REFERENCES.json'].references,oracles=data['LEGAL_WIRE_ORACLES.json'].oracles
const context=async i=>({index:await x.indexImmutableScopesV11(sources[i].sourceId,sources[i].sourceVersionId,sources[i].sourceText),referenceTime:sources[i].referenceTime,timezone:sources[i].timezone})
const first=async i=>x.adaptModelWireD26(oracles[i].wire,await context(i))

test('eight independent source references are reachable through unchanged C18 graph and new common layer',async()=>{
  for(let i=0;i<8;i++){const c=await context(i),assembly=x.assembleSourceFacts(oracles[i].rawFacts,c),actual=x.adaptModelWireD26(assembly.assembledWire,c)
    assert.equal(assembly.conversion.inferredFacts,0)
    const score=scoreD26(refs[i],actual.adapted)
    assert.equal(score.completeStatus,true,JSON.stringify({i,score}))
    assert.equal(score.structuredCompleteStatus,true)
  }
})

test('event presence, value, evidence and supported description are separate; no silent description bypass',async()=>{
  const a=(await first(0)).originalAdapted,reference=refs[0],scope=reference.representations[0].scopeTextById[a.events[0].scopeIds[0]]
  assert.equal(scoreD26(reference,a).completeStatus,true)
  const legal=structuredClone(a);legal.events[0].description=scope
  assert.equal(scoreD25(reference,legal).completeStatus,false,'frozen old failure remains visible')
  const legalScore=scoreD26(reference,legal);assert.equal(legalScore.completeStatus,true);assert.equal(legalScore.eventChecks[0].description,'SUPPORTED')
  const bad=structuredClone(a);bad.events[0].description='图书借阅门户不会停机，将正常运行。'
  assert.equal(scoreD26(reference,bad).completeStatus,false);assert.ok(scoreD26(reference,bad).risks.some(row=>row.kind==='EVENT_DESCRIPTION_CONTRADICTORY'))
  bad.events[0].description='系统运行状态值得期待';assert.equal(scoreD26(reference,bad).completeStatus,'UNKNOWN')
  bad.events=[];assert.ok(scoreD26(reference,bad).risks.some(row=>row.kind==='EVENT_MISSING'))
  const object=structuredClone(a);object.events[0].title='食堂门户';assert.ok(scoreD26(reference,object).risks.some(row=>row.kind==='EVENT_VALUE_WRONG'))
  const timing=structuredClone(a);timing.timePoints[0].normalizedValue='1900-01-01T00:00';assert.equal(scoreD26(reference,timing).completeStatus,false)
  const evidence=structuredClone(a);evidence.events[0].scopeIds=[];assert.ok(scoreD26(reference,evidence).risks.some(row=>row.kind==='EVENT_EVIDENCE_MISSING'))
})

test('time assertions are explicit independent values; tentative afternoon cannot pass as confirmed all-day',async()=>{
  const expected=[['2026-09-29','下午'],['2026-10-01','上午']]
  for(const [j,i] of [4,5].entries()){
    const a=await first(i),p=a.adapted.timePoints[0]
    assert.equal(p.normalizedValue,expected[j][0]);assert.equal(p.precision,'vague');assert.equal(p.isAllDay,false);assert.equal(p.needsConfirmation,true)
    assert.equal(a.audit.times[0].interpretation.dayPeriod,expected[j][1]);assert.equal(a.audit.times[0].interpretation.certainty,'tentative')
    assert.equal(scoreD26(refs[i],a.originalAdapted).completeStatus,false,'old shared-parser error rejected by independent source assertions')
    const bad=structuredClone(a.adapted);bad.timePoints[0].normalizedValue=null;assert.equal(scoreD26(refs[i],bad).completeStatus,false,'cannot erase the known date')
  }
  const code=readFileSync('scripts/d26-reference-data.mjs','utf8');assert.equal(code.includes('adaptModelWire('),false);assert.equal(code.includes('interpretTimeD26('),false)
})

test('time policy covers exact, date-only, vague, unannounced and corrected time without invented clocks',()=>{
  const opts={referenceTime:'2026-09-22T09:00:00+08:00',timezone:'Asia/Shanghai',type:'event_start'}
  const fixtures=[
    ['2026年10月12日14:00','2026-10-12T14:00','exact',false,false],
    ['10月12日','2026-10-12','date_only',true,false],
    ['暂定10月12日下午','2026-10-12','vague',false,true],
    ['下午',null,'vague',false,true],
    ['时间尚未公布',null,'vague',false,true],
    ['原定10月12日14:00，改为10月13日15:00','2026-10-13T15:00','exact',false,false],
  ]
  for(const [rawText,normalizedValue,precision,isAllDay,needsConfirmation] of fixtures){const p=x.interpretTimeD26(rawText,opts).point;assert.deepEqual({normalizedValue:p.normalizedValue,precision:p.precision,isAllDay:p.isAllDay,needsConfirmation:p.needsConfirmation},{normalizedValue,precision,isAllDay,needsConfirmation},rawText)}
})

test('opposite model prose is not a whole-display pass, while grounded product assembly preserves it in audit',async()=>{
  const c=await context(6),wire=structuredClone(oracles[6].wire)
  wire.tasks[0].detail.title='删除已保存记录';wire.tasks[0].detail.description='不用提交表格，改为删除记录。'
  const raw=x.adaptModelWire(wire,c).adapted,before=scoreD26(refs[6],raw)
  assert.equal(before.structuredCompleteStatus,true);assert.equal(before.completeStatus,false)
  const first=x.assembleSemanticFirstSuggestionD26(raw,c)
  assert.equal(first.result.tasks[0].detail.title,'提交实验物资核对表');assert.equal(first.audit.originalProse[0].description,wire.tasks[0].detail.description)
  assert.equal(scoreD26(refs[6],first.result).completeStatus,true)
  assert.equal(raw.tasks[0].detail.title,'删除已保存记录','raw is unchanged')
  const corrupt=structuredClone(first.result);corrupt.tasks[0].detail.description='无须提交';assert.notEqual(scoreD26(refs[6],corrupt).completeStatus,true)
})

test('C18 prerequisite evidence, false conditions and graph endpoint errors are not weakened',async()=>{
  const c=await context(2),bad=structuredClone(oracles[2].rawFacts);bad.prerequisiteStates[0].completion='true'
  assert.throws(()=>x.assembleSourceFacts(bad,c),/PROOF_REQUIRED/)
  const wire=structuredClone(oracles[4].wire);wire.tasks[0].condition.value='false'
  assert.equal(scoreD26(refs[4],x.adaptModelWireD26(wire,await context(4)).adapted).completeStatus,false)
  const graph=structuredClone(oracles[4].wire);graph.tasks[0].detail.timePointTempIds=[]
  assert.equal(scoreD26(refs[4],x.adaptModelWireD26(graph,await context(4)).adapted).completeStatus,false)
})

test('semantic ordinary bridge retains full sidecar, maps dependencies, blocks only unrepresentable semantic facts',async()=>{
  const prerequisite=await first(2),c=await context(2),bridge=x.bridgeSemanticToRecognitionD26(prerequisite.originalAdapted,c)
  assert.deepEqual(bridge.sidecar.originalSemantic,prerequisite.originalAdapted)
  assert.deepEqual(bridge.result.standaloneTasks[1].dependencyTempIds,['T1'])
  assert.equal(bridge.representationGaps.length,0)
  const unknown=await first(4),b=x.bridgeSemanticToRecognitionD26(unknown.originalAdapted,await context(4))
  assert.equal(b.sidecar.originalSemantic.tasks[0].condition.value,'unknown');assert.ok(b.representationGaps.some(gap=>gap.kind==='condition'));assert.equal(b.result.standaloneTasks[0].selected,false)
  const revision=structuredClone(prerequisite.originalAdapted);revision.revisions=[{type:'supersedes',targetDirectiveId:'T1',fromDirectiveId:'T2',effective:'unknown',scopeIds:revision.tasks[0].propositionScopeIds}]
  const r=x.bridgeSemanticToRecognitionD26(revision,c);assert.deepEqual(r.sidecar.originalSemantic.revisions,revision.revisions);assert.equal(r.result.standaloneTasks.every(t=>t.selected===false),true)
  const events=await first(0),e=x.bridgeSemanticToRecognitionD26(events.originalAdapted,await context(0));assert.equal(e.result.events.length,1);assert.equal(e.result.standaloneTasks.length,0);assert.equal(e.result.projectSuggestion,null)
})

test('ordinary time and event end use only a supported same-event date; unrelated dates never become anchors',async()=>{
  const c=await context(0),base=x.bridgeSemanticToRecognitionD26((await first(0)).originalAdapted,c).result
  const sourceText='资料讲解会于2026年10月12日14:00开始，15:00结束。'
  base.evidence=[{id:'start',sourceId:'s',quote:'资料讲解会于2026年10月12日14:00开始，',field:'event'},{id:'end',sourceId:'s',quote:'15:00结束。',field:'event'}]
  base.events=[{...base.events[0],title:'资料讲解会',evidenceIds:['start','end'],startTimePointTempId:'start-time',endTimePointTempId:'end-time'}]
  const p=base.timePoints[0];base.timePoints=[{...p,tempId:'start-time',rawText:'2026年10月12日14:00',evidenceIds:['start'],normalizedValue:'2026-10-12T14:00'},{...p,tempId:'end-time',type:'event_end',rawText:'15:00',evidenceIds:['end'],normalizedValue:'2026-10-12T15:00'}]
  const a=x.assembleRecognitionFirstSuggestionD26(base,{sourceText,referenceTime:'2026-10-02T10:00:00+08:00',timezone:'Asia/Shanghai'})
  assert.equal(a.result.timePoints[1].normalizedValue,'2026-10-12T15:00');assert.equal(a.result.timePoints[1].precision,'exact');assert.equal(a.audit.times[1].before.normalizedValue,'2026-10-12T15:00')
  base.events[0].startTimePointTempId=null
  const no=x.assembleRecognitionFirstSuggestionD26(base,{sourceText,referenceTime:'2026-10-02T10:00:00+08:00',timezone:'Asia/Shanghai'})
  assert.equal(no.result.timePoints[1].normalizedValue,null)
})

test('risk identity still catches changed omissions and selection retains all unknown denominators',async()=>{
  const c=await context(7),remove=id=>{const wire=structuredClone(oracles[7].wire);wire.tasks=wire.tasks.filter(t=>t.id!==id);wire.materials=wire.materials.filter(m=>!m.relatedTaskTempIds.includes(id));wire.timePoints=wire.timePoints.filter(p=>!p.relatedTaskTempIds.includes(id));return scoreD26(refs[7],x.adaptModelWireD26(wire,c).adapted)}
  const A=remove('T1'),B=remove('T2');assert.equal(A.taskPresence.fn,1);assert.equal(B.taskPresence.fn,1);assert.notDeepEqual(A.riskUnits,B.riskUnits)
  assert.equal(selectD26([{sourceId:'S',A,B}],1).status,'MIXED_PROGRESS');assert.equal(selectD26([{sourceId:'S',A,B}]).status,'EVIDENCE_INCOMPLETE')
})

test('ordinary browser fake transport fixtures retain false/unknown and revision endpoints with local blocks',async()=>{
  const c=await x.createD26SemanticFixture('conditions')
  x.parseSemanticInput(c.sidecar.originalSemantic)
  assert.deepEqual(c.result.standaloneTasks[1].dependencyTempIds,['T1'])
  assert.equal(c.sidecar.originalSemantic.tasks[2].condition.value,'unknown');assert.equal(c.sidecar.originalSemantic.tasks[3].condition.value,'false')
  assert.deepEqual(c.result.standaloneTasks.map(t=>t.selected),[true,true,false,false])
  const r=await x.createD26SemanticFixture('revision');x.parseSemanticInput(r.sidecar.originalSemantic)
  assert.equal(r.sidecar.originalSemantic.revisions[0].targetDirectiveId,'T1');assert.equal(r.sidecar.originalSemantic.revisions[0].fromDirectiveId,'T2')
  assert.deepEqual(r.result.standaloneTasks.map(t=>t.selected),[false,false,true]);assert.ok(r.result.conflicts.every(conflict=>!conflict.entityTempIds.includes('T3')))
  const bound=await x.createD26SemanticFixture('conditions','2026-10-02T10:00:00+08:00',{sourceId:'captured-source',sourceVersionId:'captured-version'})
  assert.ok(bound.result.evidence.every(e=>e.sourceId==='captured-source'));assert.equal(bound.sidecar.originalSemantic.sourceVersionId,'captured-version')
})
