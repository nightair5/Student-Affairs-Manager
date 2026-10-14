import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {resolve,dirname,relative} from 'node:path'
import {pathToFileURL} from 'node:url'
import {D13,readJson,d13Components,d13Oracles} from './candidate16-d13-support.mjs'
import {makeD13References} from './candidate16-d13-reference.mjs'
import {scoreSemanticV7,SCORER_V7} from './recognition-semantic-v7.mjs'
import {canonical,sha256} from './candidate15-reference-contract.mjs'
import {loadD11DiagnosticInputs} from './diagnose-recognition-d12.mjs'
import {verifyRecognitionHistory} from './verify-recognition-history.mjs'
const check=(v,c)=>{if(!v)throw Error('D13_'+c)}
const encode=v=>JSON.stringify(v,null,2)+'\n'
const roots=['src/experiments/realInput01/candidate03.ts','src/experiments/realInput01/candidate16.ts','src/experiments/candidate14/commonAdapter.ts','src/recognition/scopeIndexV11.ts','scripts/recognition-semantic-v7.mjs','scripts/candidate16-d13-reference.mjs','scripts/prepare-candidate16-d13.mjs',D13+'/PRE_REGISTRATION.json',D13+'/SEMANTIC_CONTRACT.md']
export function componentClosure(){
  const found=new Set()
  const visit=path=>{path=path.replaceAll('\\','/');if(found.has(path))return;found.add(path)
    const text=readFileSync(path,'utf8')
    for(const match of text.matchAll(/(?:from\s+|import\s*\()['"](\.[^'"\s]+)['"]/g)){
      const stem=resolve(path.startsWith('scripts/')&&match[1].startsWith('./src/')?process.cwd():dirname(path),match[1]),target=[stem,stem+'.ts',stem+'.tsx',stem+'.mjs',stem+'.json',resolve(stem,'index.ts')].find(existsSync)
      check(target,'COMPONENT_IMPORT_MISSING:'+path+':'+match[1]);visit(relative(process.cwd(),target))
    }
  }
  roots.forEach(visit)
  return [...found].sort().map(path=>({path,hashMode:'UTF8_LF',sha256:sha256(readFileSync(path,'utf8').replaceAll('\r\n','\n'))}))
}
export function assertD13DispatchAuthorized(){throw Error('D13_DISPATCH_NOT_AUTHORIZED_NEW_BATCH_REQUIRED')}
export function guardD13Unit(prepared,unit,state={status:'NOT_RUN'}){
  const frozen=prepared.requests.find(r=>r.unitIdentitySha256===unit.unitIdentitySha256)
  check(frozen&&canonical(frozen)===canonical(unit)&&sha256(JSON.stringify(unit.body))===unit.requestSha256,'IDENTITY_DRIFT')
  check(state.status==='NOT_RUN','ALREADY_RUN_OR_UNCERTAIN')
  assertD13DispatchAuthorized()
}
export function selectD13Development(cases){
  if(cases.length!==24||cases.some(r=>!r.determinate))return 'INCOMPLETE_NO_SELECTION'
  const arm=name=>cases.filter(r=>r.arm===name),a=arm('A'),b=arm('B')
  if(a.length!==12||b.length!==12)return 'INCOMPLETE_NO_SELECTION'
  if(b.some(r=>!r.score||r.score.status!=='SCORED'||r.score.severity.forbidden>0))return 'NEEDS_TARGETED_FIXES'
  for(const y of b){const x=a.find(r=>r.sourceId===y.sourceId);if(!x?.score||x.score.status!=='SCORED')return 'INCOMPARABLE_RISK_DIAGNOSIS_REQUIRED'
    if(y.score.currentTaskRisk.fn>x.score.currentTaskRisk.fn||y.score.currentTaskRisk.unsupportedActionable>x.score.currentTaskRisk.unsupportedActionable||y.score.severity.severe>x.score.severity.severe||y.score.severity.keyMajor>x.score.severity.keyMajor)return 'MIXED_PROGRESS_RISK_REGRESSION'
  }
  if(b.some(r=>r.score.severity.severe>0))return 'NEEDS_TARGETED_FIXES'
  return b.filter(r=>r.score.complete).length>a.filter(r=>r.score.complete).length?'DEVELOPMENT_IMPROVEMENT_OBSERVED':'NO_WHOLE_SOURCE_IMPROVEMENT'
}
export async function buildD13Package(){
  const history=verifyRecognitionHistory(),x=await d13Components(),oracles=await d13Oracles(),references=makeD13References(),components=componentClosure()
  check(references.length===12&&references.every(r=>r.completeness==='complete'),'REFERENCE_COVERAGE')
  const roundtrip=oracles.map((o,i)=>({sourceId:o.source.sourceId,status:scoreSemanticV7(references[i],o.result).complete?'PASS':'FAIL'}));check(roundtrip.every(r=>r.status==='PASS'),'UNREACHABLE_ORACLE')
  const refsSha=sha256(encode({references})),componentsSha=sha256(canonical(components)),requests=[]
  for(let i=0;i<oracles.length;i++)for(const arm of (i%2===0?['A','B']:['B','A'])){
    const o=oracles[i],candidate=arm==='A'?'Candidate03':'Candidate16',request=await (arm==='A'?x.buildCandidate03Request:x.buildCandidate16Request)(o.context)
    const body=structuredClone(request.body);body.model='deepseek-flash'
    const ordinal=requests.length+1,requestSha256=sha256(JSON.stringify(body))
    const identity={batch:'D13-C03-C16-DEVELOPMENT-R1',ordinal,sourceId:o.source.sourceId,sourceSha256:o.source.sourceSha256,arm,candidate,requestSha256,referencesSha256:refsSha,componentsSha256:componentsSha,scorer:SCORER_V7}
    check(!/"(?:Expected|expected|answerKey|referenceAnswers)"\s*:/.test(JSON.stringify(body)),'EXPECTED_IN_REQUEST')
    requests.push({...identity,unitIdentitySha256:sha256(canonical(identity)),dispatchAuthorized:false,status:'NOT_RUN',body})
  }
  validateD13Requests({requests})
  const inputs=await loadD11DiagnosticInputs(),cases=inputs.map(r=>({ordinal:r.unit.ordinal,sourceId:r.unit.sourceId,arm:r.unit.arm,referenceCompleteness:'complete',referenceValid:r.referenceValid,rawSha256:r.rawSha256,responseSha256:r.responseSha256,score:scoreSemanticV7(references.find(v=>v.sourceId===r.unit.sourceId),r.result,{referenceValid:r.referenceValid})}))
  const arms=Object.fromEntries(['A','B'].map(arm=>{const rows=cases.filter(r=>r.arm===arm);return [arm==='A'?'Candidate03':'Candidate15',{denominator:12,complete:rows.filter(r=>r.score.complete).length,referenceValid:rows.filter(r=>r.referenceValid).length,measurementErrors:rows.filter(r=>r.score.status==='MEASUREMENT_ERROR').length,taskPresence:['tp','fp','fn'].reduce((a,k)=>({...a,[k]:rows.reduce((n,r)=>n+(r.score.taskPresence?.[k]??0),0)}),{unscored:rows.filter(r=>!r.score.taskPresence).length}),severity:['severe','major','forbidden'].reduce((a,k)=>({...a,[k]:rows.reduce((n,r)=>n+(r.score.severity?.[k]??0),0)}),{})}]}))
  const pairwise=oracles.map(o=>{const [a,b]=['A','B'].map(arm=>cases.find(r=>r.sourceId===o.source.sourceId&&r.arm===arm));return {sourceId:o.source.sourceId,candidate03Complete:a.score.complete,candidate15Complete:b.score.complete,wholeResult:b.score.complete===a.score.complete?'tie':b.score.complete?'Candidate15_win':'Candidate03_win'}})
  const prepared={version:'candidate16-d13-prepared-1',dispatchAuthorized:false,status:'NOT_RUN',requests}
  const diagnostic={version:'d13-v7-posthoc-1',role:'POSTHOC_SEEN_SYNTHETIC_PROVISIONAL',newModelCalls:0,originalD11Decision:'REJECT_CANDIDATE15_DEVELOPMENT',originalDecisionChanged:false,candidate16ModelResult:'NOT_RUN',denominator:24,arms,pairwise,cases}
  const artifacts={'REFERENCES.json':{references},'SOURCES.json':{sources:oracles.map(o=>o.source)},'LEGAL_WIRE_ORACLES.json':{role:'ENGINEERING_ORACLE_NOT_MODEL_OUTPUT',oracles:oracles.map(o=>({sourceId:o.source.sourceId,wire:o.wire}))},'ROUNDTRIP_RESULTS.json':{roundtrip},'PREPARED_REQUEST_IDENTITIES.json':prepared,'POSTHOC_DIAGNOSTIC.json':diagnostic}
  const files=Object.entries(artifacts).map(([path,value])=>({path,sha256:sha256(encode(value))}))
  const manifest={version:'candidate16-d13-manifest-1',batch:'D13-C03-C16-DEVELOPMENT-R1',status:'ZERO_CALL_REVIEWABLE_BUDGET_NOT_AUTHORIZED',role:'FULLY_SEEN_SYNTHETIC_DEVELOPMENT',truthStatus:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',dispatchAuthorized:false,modelCalls:0,actualRequestIdentities:requests.map(r=>r.unitIdentitySha256),order:{AB:6,BA:6},requestCount:24,requestBytes:requests.map(r=>Buffer.byteLength(JSON.stringify(r.body))),tokenCount:'NOT_MEASURED_BYTES_ARE_NOT_TOKENS',artifacts:files,components,history,referenceCoverage:{complete:12,partial:0,unresolved:0},candidate16Quality:'NOT_EVALUATED',schemaChange:false,defaultCandidateChanged:false,authorizationRequired:true}
  return {...artifacts,'MANIFEST.json':manifest}
}
export function validateD13Requests(prepared){
  check(prepared.requests.length===24,'REQUEST_COUNT');const ids=new Set(),pairs=new Map()
  for(const [i,r] of prepared.requests.entries()){
    check(r.ordinal===i+1&&!r.dispatchAuthorized&&r.status==='NOT_RUN'&&!ids.has(r.unitIdentitySha256),'STATE_OR_DUPLICATE');ids.add(r.unitIdentitySha256)
    check(r.body.model==='deepseek-flash'&&r.body.temperature===0&&r.body.reasoning.effort==='none'&&r.body.max_output_tokens===8192&&r.body.stream===false,'PARAMETERS')
    check(sha256(JSON.stringify(r.body))===r.requestSha256,'BODY_DRIFT')
    const {unitIdentitySha256,dispatchAuthorized,status,body,...identity}=r;check(sha256(canonical(identity))===unitIdentitySha256,'IDENTITY_HASH')
    const rows=pairs.get(r.sourceId)??[];rows.push(r);pairs.set(r.sourceId,rows)
  }
  check(pairs.size===12,'SOURCE_COUNT');let ab=0,ba=0
  for(const rows of pairs.values()){
    const order=rows.map(r=>r.arm).join('');if(order==='AB')ab++;else if(order==='BA')ba++;else throw Error('D13_PAIR')
    const bodies=rows.map(r=>{const b=structuredClone(r.body);b.input[0].content[0].text='CANDIDATE_COMPONENT';return b})
    check(canonical(bodies[0])===canonical(bodies[1]),'NON_CANDIDATE_DRIFT')
  }
  check(ab===6&&ba===6,'ORDER_BALANCE');return {requests:24,AB:ab,BA:ba}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const action=process.argv[2];check(['--write','--verify'].includes(action),'ARGUMENT')
  const artifacts=await buildD13Package()
  if(action==='--write')check(Object.keys(artifacts).every(name=>!existsSync(D13+'/'+name)),'FROZEN_PACKAGE_ALREADY_EXISTS')
  mkdirSync(D13,{recursive:true})
  for(const [name,value] of Object.entries(artifacts)){const path=D13+'/'+name,bytes=encode(value);if(action==='--write')writeFileSync(path,bytes,{flag:'wx'});else check(readFileSync(path,'utf8')===bytes,'PACKAGE_DRIFT_'+name)}
  console.log(JSON.stringify({status:artifacts['MANIFEST.json'].status,requests:24,references:12,dispatchAuthorized:false,diagnostic:artifacts['POSTHOC_DIAGNOSTIC.json'].arms}))
}
