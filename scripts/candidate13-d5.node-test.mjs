import test from 'node:test'
import assert from 'node:assert/strict'
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs'
import {resolve} from 'node:path'
import {compileReferenceV4} from './compile-candidate13-reference-v4.mjs'
import {scoreCandidate13V4} from './score-candidate13-contract-v4.mjs'
import {buildD5Development,buildOverlapReport,loadD5Api,sha256,validateD5Development,verifyD5Outputs,D5_DIRECTORY} from './prepare-candidate13-d5.mjs'

const filesBelow=path=>readdirSync(path,{withFileTypes:true}).flatMap(item=>item.isDirectory()?filesBelow(resolve(path,item.name)):[resolve(path,item.name)])
const normalizedBodies=pair=>pair.map(item=>{const body=structuredClone(item.request);body.input[0].content[0].text='__PROMPT__';return body})

test('D5 package is deterministic, synthetic and not an independent Holdout',async()=>{
  const first=await verifyD5Outputs(),second=await verifyD5Outputs()
  assert.equal(first.manifestText,second.manifestText)
  assert.equal(first.sources.sources.length,12);assert.equal(first.references.references.length,12)
  assert.equal(first.manifest.data.completeReferences,12);assert.equal(first.manifest.data.independentHumanReferences,0)
  assert.equal(first.manifest.data.eligibleForIndependentHoldout,false)
  assert.equal(first.manifest.metricStatus.correctDispositionRate,'NOT_OBSERVABLE')
})

test('every evidence quote binds to source and all required scenario families exist',()=>{
  const rows=validateD5Development(buildD5Development())
  const tags=new Set(rows.flatMap(row=>row.coverageTags))
  for(const tag of ['single','multi','condition_true','condition_false','condition_unknown','shared_material','exact_time','vague_time',
    'completion_standard','dependency','forbidden','multi_endpoint_cancellation','multi_endpoint_replacement','no_task'])assert.ok(tags.has(tag),tag)
})

test('local overlap screen is deterministic and flags exact copied sources',()=>{
  const rows=buildD5Development(),report=buildOverlapReport(process.cwd(),rows)
  assert.equal(report.items.every(item=>item.decision==='PASS_LOCAL_SCREEN'),true)
  assert.throws(()=>buildOverlapReport(process.cwd(),[{...rows[0],sourceText:readFileSync('src/experiments/realInput01/candidate13.ts','utf8').split(/\r?\n/).find(line=>line.length>100)}]),/OVERLAP_REVIEW_REQUIRED/)
})

test('24 identities are balanced, Expected-free, same-route and closed to dispatch',async()=>{
  const output=await verifyD5Outputs(),api=await loadD5Api()
  assert.equal(output.prepared.requests.length,24)
  for(let i=0;i<12;i++){
    const pair=output.prepared.requests.slice(i*2,i*2+2)
    assert.deepEqual(pair.map(item=>item.arm),i%2===0?['A','B']:['B','A'])
    assert.deepEqual(...normalizedBodies(pair));assert.equal(pair[0].sourceId,pair[1].sourceId)
    for(const item of pair){
      assert.equal(item.dispatchAuthorized,false);assert.equal(item.status,'NOT_RUN')
      const serialized=JSON.stringify(item.request)
      assert.doesNotMatch(serialized,/"(?:reference|expected|scorerReference|forbiddenInferences|allowedMerges)"\s*:/i)
    }
  }
  await assert.rejects(api.denyCandidate13D5Dispatch(output.prepared.requests[0].prepared),/D5_MODEL_CALL_NOT_AUTHORIZED/)
  const changed=structuredClone(output.prepared.requests[0].prepared);changed.request.model='different'
  await assert.rejects(api.validateCandidate13D5Prepared(changed),/D5_PREPARED_IDENTITY_CHANGED/)
})

test('wire adapter, schema parser and v4 scorer form one executable engineering chain',async()=>{
  const output=await verifyD5Outputs(),api=await loadD5Api(),source=output.sources.sources[0],reference=output.references.references[0].reference
  const context={index:await api.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
  const scope=context.index.scopes.find(item=>item.text.includes('归档研究伦理声明'))
  assert.ok(scope)
  const wire={schemaVersion:api.WIRE_VERSION,tasks:[{id:'T1',propositionScopeIds:[scope.id],
    semantics:{actor:'addressee',speechAct:'directive',polarity:'affirmative',tense:'future',status:'pending',validity:'active',modality:'required'},
    inferenceLevel:'explicit',actionType:'submit',action:{scopeId:scope.id,surface:'归档'},object:{scopeId:scope.id,surface:'研究伦理声明'},effect:'external_transfer',
    detail:{parentTempId:null,hierarchyType:'task',title:'归档研究伦理声明',description:'',completionCriteria:['系统显示归档完成'],estimatedMinutes:null,
      statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:['M1'],timePointTempIds:['TP1'],confidence:1,userConfirmationRequired:true},
    condition:{value:'not_applicable',conditionScopeIds:[],factScopeIds:[]},coverage:{time:'present',material:'present',event:'not_stated'},eventTempIds:[]}],
    materials:[{tempId:'M1',name:'研究伦理声明',required:true,formatRequirements:['PDF/A'],namingRequirements:['课题号-负责人'],quantity:null,submissionChannel:null,
      relatedTaskTempIds:['T1'],scopeIds:[scope.id],confidence:1}],
    timePoints:[{tempId:'TP1',type:'submission_deadline',rawText:'2026年10月19日16:30前',relatedTaskTempIds:['T1'],relatedMaterialTempIds:['M1'],scopeIds:[scope.id],confidence:1}],
    events:[],revisions:[],conflicts:[],informationScopeIds:[],unresolvedScopeIds:[]}
  const adapted=api.adaptModelWire(wire,context).adapted
  const score=scoreCandidate13V4(compileReferenceV4(reference),adapted,{schemaValid:true})
  assert.equal(score.status,'SCORED');assert.equal(score.complete,true,JSON.stringify({score,timePoints:adapted.timePoints,expected:reference.tasks[0].timePoints}))
})

test('frozen directory has no result, raw, receipt or authority artifacts',()=>{
  const names=filesBelow(resolve(D5_DIRECTORY)).map(path=>path.toLowerCase())
  assert.equal(names.some(path=>/(?:\\|\/)(?:raw|results?)(?:\\|\/)|(?:grant|reserve|settle|receipt|authorization)\.json/.test(path)),false)
  const manifest=JSON.parse(readFileSync(resolve(D5_DIRECTORY,'MANIFEST.json'),'utf8'))
  assert.deepEqual(manifest.operations,{modelCalls:0,connectivityProbes:0,secretReads:0,grants:0,reserves:0,settlements:0,receipts:0,ledgerWrites:0,humanTrials:0,defaultCandidateChanges:0,merges:0,deploys:0})
  assert.equal(manifest.hashes['docs/recognition-optimization/candidate13/d5-development/SOURCES.json'],sha256(readFileSync(resolve(D5_DIRECTORY,'SOURCES.json'))))
  assert.ok(existsSync(resolve(D5_DIRECTORY,'MANIFEST.json'))&&statSync(resolve(D5_DIRECTORY,'MANIFEST.json')).isFile())
})
