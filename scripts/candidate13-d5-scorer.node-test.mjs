import test from 'node:test'
import assert from 'node:assert/strict'
import {buildContractFixtures, makeReference, makeTask, perfectResult} from './candidate12-d3-fixtures.mjs'
import {compileReferenceV4, validateScorerInputV4} from './compile-candidate13-reference-v4.mjs'
import {aggregateCandidate13V4, scoreCandidate13V4} from './score-candidate13-contract-v4.mjs'

const clone=value=>structuredClone(value)
const fixture=id=>clone(buildContractFixtures().find(item=>item.id===id).valid)
const perfect=reference=>{
  const result=perfectResult(reference)
  for(const material of result.materials){
    const expected=reference.tasks.flatMap(task=>task.materials).find(item=>item.materialId===material.tempId)
    material.formatRequirements=expected?.formatRequirements??[]
    material.namingRequirements=expected?.namingRequirements??[]
  }
  for(const relation of result.revisions)relation.effective=true
  return result
}

test('v4 compiled input is deterministic and tamper evident',()=>{
  const first=compileReferenceV4(fixture('shared-material')),second=compileReferenceV4(fixture('shared-material'))
  assert.deepEqual(first,second);assert.equal(validateScorerInputV4(first),first)
  const changed=clone(first);changed.tasks[0].expected.actionable=false
  assert.throws(()=>validateScorerInputV4(changed),/D5_COMPILED_SHA_MISMATCH/)
})

test('v4 detects wrong material format and required flag',()=>{
  const reference=fixture('shared-material')
  for(const task of reference.tasks){task.materials[0].formatRequirements=['PDF']}
  const compiled=compileReferenceV4(reference),result=perfect(reference)
  result.materials[0].formatRequirements=['DOCX'];result.materials[0].required=false
  const score=scoreCandidate13V4(compiled,result,{schemaValid:true})
  assert.equal(score.complete,false);assert.ok(score.severity.major>0)
  assert.equal(score.alignment.some(row=>row.fields.some(field=>field.path==='materials'&&!field.pass)),true)
})

test('v4 detects unsupported material and unsupported dependency',()=>{
  const single=fixture('single-task'),extraMaterial=perfect(single)
  extraMaterial.materials.push({tempId:'M-X',name:'无据必交材料',required:true,formatRequirements:[],namingRequirements:[],relatedTaskTempIds:['T1']})
  const materialScore=scoreCandidate13V4(compileReferenceV4(single),extraMaterial,{schemaValid:true})
  assert.equal(materialScore.complete,false);assert.ok(materialScore.severity.major>0)

  const multi=fixture('multi-task'),extraDependency=perfect(multi)
  extraDependency.tasks[0].detail.dependencyTempIds=['T2']
  const dependencyScore=scoreCandidate13V4(compileReferenceV4(multi),extraDependency,{schemaValid:true})
  assert.equal(dependencyScore.complete,false);assert.ok(dependencyScore.severity.major>0)
})

test('v4 executes structured forbidden assertions against predictions',()=>{
  const reference=fixture('single-task')
  reference.tasks[0].forbiddenInferences=[{code:'NO_EXTRA_APPROVAL',kind:'field',statement:'不得增加审批通过要求',
    evidence:['无需另行审批'],assertion:{path:'completionStandard.accepted',operator:'contains',value:'必须另行获得审批通过'}}]
  const result=clone(perfect(reference));result.tasks[0].detail.completionCriteria.push('必须另行获得审批通过')
  const score=scoreCandidate13V4(compileReferenceV4(reference),result,{schemaValid:true})
  assert.equal(score.complete,false);assert.equal(score.severity.forbidden,1)
  assert.equal(score.issues[0].rule,'NO_EXTRA_APPROVAL')
})

test('v4 refuses optimistic scoring when maximum identity matching is ambiguous',()=>{
  const left=makeTask('T1','提交','同名对象'),right=makeTask('T2','提交','同名对象')
  const reference=makeReference('D5-AMBIGUOUS',[left,right]),result=perfect(reference)
  const score=scoreCandidate13V4(compileReferenceV4(reference),result,{schemaValid:true})
  assert.equal(score.status,'AMBIGUOUS_MATCH');assert.equal(score.complete,null);assert.equal(score.promotionEligible,false)
})

test('v4 requires explicit schema validation and keeps failures in denominators',()=>{
  const reference=compileReferenceV4(fixture('multi-task'))
  const score=scoreCandidate13V4(reference,perfectResult(fixture('multi-task')))
  assert.equal(score.status,'PARSE_OR_SCHEMA_FAILURE');assert.equal(score.taskMetrics.fn,2);assert.equal(score.severity.severe,1)
  const aggregate=aggregateCandidate13V4([score])
  assert.equal(aggregate.sources,1);assert.equal(aggregate.determinate,true);assert.equal(aggregate.taskMetrics.fn,2)
})

test('v4 accepts a complete exact engineering result and correct no-task disposition',()=>{
  for(const reference of [fixture('single-task'),fixture('no-task-information')]){
    const score=scoreCandidate13V4(compileReferenceV4(reference),perfect(reference),{schemaValid:true})
    assert.equal(score.status,'SCORED');assert.equal(score.complete,true);assert.equal(score.promotionEligible,true)
  }
})
