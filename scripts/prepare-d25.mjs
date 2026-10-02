import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {d25Components} from './d25-components.mjs'
import {scoreD25,D25_SCORER,D25_SELECTOR} from './d25-scoring.mjs'
import {validateReferenceV7} from './recognition-semantic-v7.mjs'
import {build} from 'esbuild'
export const D25_ROOT='docs/recognition-optimization/d25-accuracy'
export const sha=v=>createHash('sha256').update(v).digest('hex')
const json=v=>JSON.stringify(v,null,2)+'\n'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const check=(ok,code)=>{if(!ok)throw Error('D25_PREPARE_'+code)}
const variants=[
  {template:9,target:'S09_EVENT',pairs:[['校车预约平台','图书借阅门户'],['已保存行程','既有借阅记录'],['删除行程','删除记录']]},
  {template:9,target:'S09_EVENT',pairs:[['校车预约平台','实验预约系统'],['将在周三晚停机','将于周四晚维护'],['周三晚','周四晚'],['已保存行程','已有预约'],['删除行程','取消预约'],['停机','维护']]},
  {template:6,target:'S06_PREREQUISITE',pairs:[['校友访谈记录表','社团设备登记表'],['记录表','登记表'],['秘书处','器材室'],['CSV','XLSX']]},
  {template:6,target:'S06_PREREQUISITE',pairs:[['校友访谈记录表','志愿服务汇总表'],['记录表','汇总表'],['请先填写','请先补全'],['填写','补全'],['均已补全后','全部补全后'],['秘书处','活动组'],['CSV','PDF']]},
  {template:5,target:'S05_GRAPH',pairs:[['摄影志愿者','场地协调员'],['摄影岗位安排','场地岗位安排'],['机位安排表','场地安排单'],['安排表','安排单']]},
  {template:5,target:'S05_GRAPH',pairs:[['若安排你担任','如果安排你担任'],['摄影志愿者','签到志愿者'],['摄影岗位安排','签到岗位安排'],['机位安排表','签到安排表'],['下周二下午','下周四上午'],['递交','提交']]},
  {template:1,target:'CONTROL_MATERIAL_PRECISE',pairs:[['社团器材盘点表','实验物资核对表'],['社团编号-经办人','实验编号-负责人']]},
  {template:2,target:'CONTROL_MULTI_DATE',pairs:[['迎新志愿者分组','校园接待岗位'],['场地使用承诺函','接待安排确认单'],['PNG','PDF']]},
]
const rewrite=(value,pairs)=>pairs.reduce((s,[a,b])=>s.replaceAll(a,b),value)
function remap(value,pairs,ids,marker){
  if(Array.isArray(value))return value.filter(v=>v!==marker).map(v=>remap(v,pairs,ids,marker))
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>k!==marker).map(([k,v])=>[ids.get(k)??k,remap(v,pairs,ids,marker)]))
  return typeof value==='string'?ids.get(value)??rewrite(value,pairs):value
}
export async function makeD25(){
  const root='docs/recognition-optimization/candidate17/d16-development',oldS=read(root+'/SOURCES.json').sources,oldR=read(root+'/REFERENCES.json').references,oldO=read(root+'/LEGAL_WIRE_ORACLES.json').oracles,x=await d25Components()
  const sources=[],references=[],oracles=[],roundtrip=[]
  for(const [i,v] of variants.entries()){
    const prior=oldS[v.template-1],oldIndex=await x.indexImmutableScopesV11(prior.sourceId,prior.sourceVersionId,prior.sourceText),id='D25-S'+String(i+1).padStart(2,'0'),sourceText=rewrite(prior.sourceText.slice(prior.sourceText.indexOf('\n')+1),v.pairs),sourceVersionId=id+'-v1'
    const index=await x.indexImmutableScopesV11(id,sourceVersionId,sourceText),marker=oldIndex.scopes[0].id
    check(index.scopes.length===oldIndex.scopes.length-1,'SCOPE_COUNT_'+id)
    const ids=new Map(oldIndex.scopes.slice(1).map((s,j)=>[s.id,index.scopes[j].id])),wire=remap(oldO[v.template-1].wire,v.pairs,ids,marker),reference=remap(oldR[v.template-1],v.pairs,ids,marker)
    reference.sourceId=id;reference.sourceSha256=sha(sourceText);reference.seenDegree='SEEN_TEMPLATE_DERIVED_DEVELOPMENT';reference.author='Codex / single-author model-assisted provisional D25'
    for(const rep of reference.representations){
      rep.sourceId=id;rep.scopeTextById=Object.fromEntries(index.scopes.map(s=>[s.id,s.text]));rep.noTaskFacts=rep.noTaskFacts.filter(f=>f.id!=='SYNTHETIC_SOURCE_MARKER')
    }
    // Correct new prohibitions from this source, without touching the old wrong template labels.
    if(v.template===9)reference.forbiddenActions=index.scopes.filter(s=>/无需|不要|不必/.test(s.text)).map(s=>{const action=s.text.includes('删除')?'删除':s.text.includes('取消')?'取消':s.text.includes('提交')?'提交':'发',object=s.text.includes('记录')?'记录':s.text.includes('预约')?'预约':s.text.includes('说明')?'说明':'消息';return {action:{canonical:action,aliases:[]},object:{canonical:object,aliases:[]},scopeIds:[s.id],reason:'explicit_prohibition'}})
    const context={index,referenceTime:prior.referenceTime,timezone:prior.timezone},adapted=x.adaptModelWire(wire,context).adapted
    // Both arms and the product use the same existing wire->time adapter; record its values before outputs.
    for(const rep of reference.representations){
      for(const t of rep.tasks){if(t.times!=='N/A')t.times=t.times.map(p=>({...p,...adapted.timePoints.find(a=>a.rawText===p.rawText&&a.type===p.type)}))}
      for(const f of rep.noTaskFacts)if(f.kind==='time')f.time={...f.time,...adapted.timePoints.find(p=>p.rawText===f.value&&p.type===f.time.type)}
    }
    validateReferenceV7(reference)
    const rawFacts=x.projectSourceFacts(wire,context),assembly=x.assembleSourceFacts(rawFacts,context),positive=scoreD25(reference,x.adaptModelWire(assembly.assembledWire,context).adapted)
    check(positive.completeStatus===true,'POSITIVE_'+id+'_'+JSON.stringify(positive.disputes)+'_'+JSON.stringify(positive.risks))
    const negative=structuredClone(wire)
    if(v.template===9){negative.events=[];negative.timePoints=[]}
    else if(v.template===6)negative.tasks[1].condition={value:'true',conditionScopeIds:[index.scopes[1].id],factScopeIds:[]}
    else if(v.template===5)negative.tasks[0].detail.timePointTempIds=[]
    else if(v.template===1)negative.materials[0].formatRequirements=['DOCX']
    else negative.tasks.pop()
    const bad=scoreD25(reference,x.adaptModelWire(negative,context).adapted)
    check(bad.completeStatus===false,'NEGATIVE_'+id)
    const permuted=structuredClone(wire);permuted.tasks.reverse();permuted.informationScopeIds.reverse()
    check(scoreD25(reference,x.adaptModelWire(permuted,context).adapted).completeStatus===true,'ORDER_'+id)
    sources.push({sourceId:id,sourceVersionId,sourceText,sourceSha256:sha(sourceText),referenceTime:prior.referenceTime,timezone:prior.timezone,target:v.target,templateSourceId:prior.sourceId,seenDegree:'SEEN_TEMPLATE_DERIVED_DEVELOPMENT',metadata:'Test labels are external provenance, never stripped from arbitrary user text'})
    references.push(reference);oracles.push({sourceId:id,wire,rawFacts,role:'ENGINEERING_ORACLE_NOT_MODEL_OUTPUT'})
    roundtrip.push({sourceId:id,positive:'PASS',negative:'DETECTED',negativeRisks:bad.risks,orderInvariant:'PASS'})
  }
  const refSha=sha(json({references})),requests=[]
  for(const [i,source] of sources.entries())for(const arm of i%2===0?['A','B']:['B','A']){
    const context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone},a=await x.buildCandidate17Request(context),b=await x.buildCandidate18Request(context),body={...(arm==='A'?a:b).body,model:'deepseek-flash'}
    const ordinal=requests.length+1,identity={batch:'D25-C17-C18-DEVELOPMENT-R1',ordinal,sourceId:source.sourceId,sourceSha256:source.sourceSha256,arm,candidate:arm==='A'?'Candidate17':'Candidate18',requestSha256:sha(JSON.stringify(body)),referenceSha256:refSha,model:'deepseek-flash',scorer:D25_SCORER}
    check(!/\bexpected\b/i.test(JSON.stringify(body)),'ANSWER_LEAK')
    const parameterView=r=>({...r,input:[r.input[1]],text:undefined})
    check(JSON.stringify(parameterView({...a.body,model:'deepseek-flash'}))===JSON.stringify(parameterView(b.body)),'PARAMETERS')
    requests.push({...identity,unitIdentitySha256:sha(JSON.stringify(identity)),body,dispatchAuthorized:false,status:'NOT_RUN'})
  }
  const artifacts={'SOURCES.json':{sources},'REFERENCES.json':{references},'LEGAL_WIRE_ORACLES.json':{oracles},'ROUNDTRIP_RESULTS.json':{role:'ZERO_CALL_CONTRACT_TEST_NOT_MODEL_QUALITY',roundtrip},'PREPARED_REQUEST_IDENTITIES.json':{version:'d25-identities-1',dispatchAuthorized:false,status:'NOT_RUN',requests},'PRE_REGISTRATION.json':{version:D25_SELECTOR,baseline:'Candidate17 original frozen prompt and wire',challenger:'Candidate18 source-facts-3 / one-way assembly',comparison:'TWO_COMPLETE_GENERATION_PIPELINES_COMMON_FINAL_SEMANTICS; not prompt-only',sources:8,units:16,order:'4 AB / 4 BA',fixed:['source','referenceTime','timezone','model','temperature=0','reasoning=none','output=8192','common wire adapter','scorer'],experimental:['prompt','wire schema','explicit-edge assembly; original raw preserved'],selector:D25_SELECTOR,scorer:D25_SCORER,denominatorPolicy:'8 per arm; transport/parse/schema/semantic failures stay; unresolved=UNKNOWN; never pass rejected output',manualProse:'NOT_ADJUDICATED until real review',thresholds:{developmentImprovement:'whole-correct net>0 and no new determinate key risk',targetedProgress:'target risks decrease without whole net gain and no new key risk',mixed:'gains with regressions or new key risks',noImprovement:'no demonstrated gain',incomplete:'missing/unknown can reverse conclusion'},forbidden:['retry','repair','verifier','paid probe','answer-based source selection'],dispatchAuthorized:false}}
  // Bind actual local transitive inputs, not just the visible prompt/scorer files.
  // Bundling is offline and never evaluates the executor or reads an env file.
  const graph=await build({entryPoints:['scripts/d25-components.mjs','scripts/run-d25.mjs','scripts/score-d25.mjs','scripts/serve-d25.mjs','src/experiments/candidate18/d25-browser.tsx','src/experiments/realInput01/candidate17.ts','src/experiments/realInput01/candidate18.ts','src/recognition/scopeIndexV11.ts','src/experiments/realInput01/modelWire.ts','src/experiments/mainline04/semanticComposer.ts'],bundle:true,packages:'external',write:false,metafile:true,outdir:'memory',platform:'node',format:'esm',jsx:'automatic',logLevel:'silent'})
  const components=[...new Set([...Object.keys(graph.metafile.inputs),'scripts/d25-ledger-append.ps1','package-lock.json','package.json'])].sort()
  artifacts['MANIFEST.json']={version:'d25-development-freeze-1',batch:'D25-C17-C18-DEVELOPMENT-R1',status:'NOT_RUN',dispatchAuthorized:false,modelCalls:0,sourceCount:8,requestCount:16,order:{AB:4,BA:4},scorer:D25_SCORER,components:components.map(path=>({path,sha256:sha(readFileSync(path))})),artifacts:Object.entries(artifacts).map(([path,value])=>({path,sha256:sha(json(value))}))}
  return artifacts
}
export function verifyD25(){const m=read(join(D25_ROOT,'MANIFEST.json'));for(const f of [...m.components,...m.artifacts.map(a=>({...a,path:join(D25_ROOT,a.path)}))])check(sha(readFileSync(f.path))===f.sha256,'FROZEN_DRIFT_'+f.path);const requests=read(join(D25_ROOT,'PREPARED_REQUEST_IDENTITIES.json')).requests;check(requests.length===16&&new Set(requests.map(r=>r.unitIdentitySha256)).size===16,'COUNT');for(const [i,r] of requests.entries()){const {unitIdentitySha256,body,status,dispatchAuthorized,...identity}=r;check(r.ordinal===i+1&&status==='NOT_RUN'&&dispatchAuthorized===false&&sha(JSON.stringify(identity))===unitIdentitySha256&&sha(JSON.stringify(body))===r.requestSha256,'IDENTITY')}return {status:'FROZEN_NOT_RUN',units:16,manifestSha256:sha(readFileSync(join(D25_ROOT,'MANIFEST.json'))),identitiesSha256:sha(readFileSync(join(D25_ROOT,'PREPARED_REQUEST_IDENTITIES.json')))}}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.argv[2]==='--write'){const data=await makeD25();mkdirSync(D25_ROOT,{recursive:true});for(const [name,value] of Object.entries(data)){const path=join(D25_ROOT,name);check(!existsSync(path),'ALREADY_FROZEN');writeFileSync(path,json(value),{flag:'wx'})}console.log(JSON.stringify(verifyD25()))}else if(process.argv[2]==='--verify')console.log(JSON.stringify(verifyD25()));else throw Error('D25_MODE')}
