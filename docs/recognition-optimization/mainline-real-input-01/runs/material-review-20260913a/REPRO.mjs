// Zero-call diagnostic only. No Vite/Vitest, dotenv, browser, file-backed database or writes.
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const compiled=await build({stdin:{contents:`
export {validateMaterialDecision,materialStatusLabels} from './src/experiments/realInput01/factCorrections';
export {validateWorkspaceShape} from './src/domain/v2/validators/shapeValidator';
export {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from './src/domain/v2/repository';
export {emptyRealInputWorkspace,HTTPS_PREVIEW_DATABASE,openHttpsPreviewExample,recordedA02Identity} from './src/experiments/realInput01/runtime';
export {SemanticRepository} from './src/experiments/mainline05/semanticRepository';
export {reviewSemanticMaterial,reviewSemanticFact,confirmSemantic} from './src/experiments/mainline05/semanticConfirmation';
export {semanticRevision,stateOfRuntime,effectiveStateFacts} from './src/experiments/mainline05/semanticState';
`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',metafile:true})
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].contents).toString('base64'))
const dependencies=Object.keys(compiled.metafile.inputs).filter(p=>p!=='<stdin>').map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))
const output={label:'Current limitation reproduced; expected rejection is NOT feature acceptance',modelCalls:0,browserActions:0,persistentWrites:0,dependencies,checks:[]}
function observed(name,action){try{action();output.checks.push({name,rejected:false})}catch(e){output.checks.push({name,rejected:true,error:e.message})}}
observed('explicit unverified material decision',()=>api.validateMaterialDecision({required:true,status:'unverified'}))
assert.equal(output.checks.at(-1).rejected,true)
observed('requirement unknown remains invalid',()=>api.validateMaterialDecision({required:null,status:'ready'}))
assert.equal(output.checks.at(-1).rejected,true)
const w=api.emptyRealInputWorkspace(api.HTTPS_PREVIEW_DATABASE,'2026-09-13T09:00:00Z')
const m={id:'memory-material-only',projectId:null,name:'匿名工程材料',required:true,status:'ready',requirements:[],formatRequirements:[],namingRequirements:[],quantity:null,submissionChannel:null,relatedTaskIds:[],deadlineTimePointId:null,createdAt:'2026-09-13T09:00:00Z',updatedAt:'2026-09-13T09:00:00Z',version:1}
w.materials=[m]
assert.deepEqual(api.validateWorkspaceShape(w),[])
for(const status of Object.keys(api.materialStatusLabels)){
  assert.deepEqual(api.validateWorkspaceShape({...w,materials:[{...m,status}]}),[])
  api.validateMaterialDecision({required:status!=='not_required',status})
}
output.checks.push({name:'six old statuses',passed:6})
const memory=new api.MemoryWorkspaceRecordStore(),canonical=new api.CanonicalWorkspaceRepository(memory)
await canonical.save(w)
const unknown={...w,materials:[{...m,status:'unverified'}]},shape=api.validateWorkspaceShape(unknown)
assert(shape.some(i=>i.path==='materials[0].status'))
output.checks.push({name:'canonical unknown status shape',issues:shape})
let rejected=false;try{await canonical.save(unknown)}catch(e){rejected=true;output.checks.push({name:'canonical save unverified rejected',error:e.message})}
assert(rejected);assert.deepEqual(await canonical.load(),w)
output.checks.push({name:'failed save leaves memory record unchanged',passed:true})
const p='docs/recognition-optimization/mainline-real-input-01/runs/candidate07-20260913a/'
const b=JSON.parse(readFileSync(p+'BINDING_FINAL.json')),raw=JSON.parse(readFileSync(p+'R11-07_RAW.jsonl')),item=b.items.find(i=>i.id==='R11')
const record={version:'recorded-paired07-1',unitId:'R11-07',name:api.recordedA02Identity.name,operationId:item.operationId,title:item.title,context:item.context,requestSha:raw.requestSha,responseSha:raw.responseSha,rawHttpText:raw.rawHttpText}
const store=Object.assign(new api.MemoryWorkspaceRecordStore(),{name:api.HTTPS_PREVIEW_DATABASE})
const repo=await api.SemanticRepository.open(store.name,store,api.emptyRealInputWorkspace(store.name),'real-input-01')
const draftId=await api.openHttpsPreviewExample(repo,{unitId:record.unitId,requestSha:record.requestSha,responseSha:record.responseSha},async()=>record,async()=>{})
const before=await repo.load(),state=api.stateOfRuntime(before,draftId),facts=api.effectiveStateFacts(state).facts
const task=facts.tasks.find(t=>t.id==='task-fill-registration-form'),material=facts.materials.find(m=>m.relatedTaskTempIds.includes(task.id))
rejected=false;try{await api.reviewSemanticMaterial(repo,{draftId,materialId:material.tempId,revision:api.semanticRevision(before),operationId:'memory-unverified',value:{required:true,status:'unverified'}})}catch(e){rejected=true;output.checks.push({name:'R11 public material review unverified',error:e.message})}
assert(rejected);assert.deepEqual(await repo.load(),before)
await api.reviewSemanticMaterial(repo,{draftId,materialId:material.tempId,revision:api.semanticRevision(before),operationId:'memory-ready-control',value:{required:true,status:'ready'}})
await api.reviewSemanticFact(repo,{draftId,taskId:task.id,revision:api.semanticRevision(await repo.load()),operationId:'memory-fact-control'})
await api.confirmSemantic(repo,{draftId,taskTempIds:[task.id],revision:api.semanticRevision(await repo.load())})
const saved=await repo.load(),independent=await api.SemanticRepository.open(store.name,store,undefined,'real-input-01')
assert.deepEqual(await independent.load(),saved);assert.equal(saved.tasks.length,1);assert.equal(saved.materials[0].status,'ready')
assert.equal(api.stateOfRuntime(saved,draftId).rawHttpText,state.rawHttpText)
output.checks.push({name:'R11 explicit simulated ready control',taskCount:saved.tasks.length,materialStatus:saved.materials[0].status,independentMemoryRead:true,rawPreserved:true,notActualUserPreparation:true})
console.log(JSON.stringify(output,null,2))
