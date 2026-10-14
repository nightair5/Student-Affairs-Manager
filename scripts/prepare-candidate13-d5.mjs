import {createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {isDeepStrictEqual} from 'node:util'
import {build} from 'esbuild'
import {REFERENCE_CONTRACT_VERSION,stable,validateReferenceV3} from './candidate12-reference-contract.mjs'
import {compileReferenceV4,D5_COMPILER_VERSION,D5_SCORER_INPUT_VERSION} from './compile-candidate13-reference-v4.mjs'
import {D5_SCORER_VERSION} from './score-candidate13-contract-v4.mjs'
import {verifyProtectedFiles} from './verify-candidate11-analysis.mjs'
import {verifyCandidate13D4} from './freeze-candidate13-d4.mjs'

export const D5_DIRECTORY='docs/recognition-optimization/candidate13/d5-development'
export const D5_SOURCES_FILE=D5_DIRECTORY+'/SOURCES.json'
export const D5_REFERENCES_FILE=D5_DIRECTORY+'/REFERENCES.json'
export const D5_REQUESTS_FILE=D5_DIRECTORY+'/PREPARED_REQUEST_IDENTITIES.json'
export const D5_OVERLAP_FILE=D5_DIRECTORY+'/OVERLAP_REPORT.json'
export const D5_MANIFEST_FILE=D5_DIRECTORY+'/MANIFEST.json'
export const AUTHORITY_LEDGER='C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl'
const EXPECTED_LEDGER={rows:742,bytes:631869,sha256:'df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e',
  tail:'6812e1b072caeaa4fd3e6e8e55b485c57533bc0a0d9eaaff4dd84bbf48809922'}
const FIXED={model:'deepseek-flash',temperature:0,reasoning:{effort:'none'},maxOutputTokens:8192,
  referenceTime:'2026-09-22T09:00:00+08:00',timezone:'Asia/Shanghai',retry:false,repair:false,verifier:false,
  orderSeed:'D5R1-C13-20260922-A'}
const check=(condition,code)=>{if(!condition)throw Error('C13_D5_'+code)}
export const sha256=value=>createHash('sha256').update(value).digest('hex')
const fileHash=(root,path)=>sha256(readFileSync(resolve(root,path)))
const json=value=>JSON.stringify(value,null,2)+'\n'
const evidence=value=>[value]
const baseTask=(id,action,object,completion,overrides={})=>({referenceTaskId:id,actions:[action],objects:[object],
  actionObjectAliases:[{action,object}],taskBasis:'explicit_action_object',taskEvidence:{basis:'explicit_action_object',
    actionEvidence:evidence(action),objectEvidence:evidence(object)},semanticStatus:'pending',semanticValidity:'active',actionable:true,
  condition:{value:'not_applicable',evidence:[]},materials:[],timePoints:[],completionStandard:{accepted:[completion],evidence:evidence(completion)},
  dependencies:[],revisionRelations:[],cancellationRelations:[],replacementRelations:[],allowedMerges:[],forbiddenMerges:[],
  forbiddenInferences:[],requiredFields:['semanticStatus','semanticValidity','actionable','condition.value','completionStandard'],
  optionalFields:['materials','timePoints','dependencies'],ambiguityRules:[],...overrides})
const material=(id,name,taskIds,{required=true,formats=[],naming=[]}={})=>({materialId:id,names:[name],required,
  formatRequirements:formats,namingRequirements:naming,relatedReferenceTaskIds:taskIds,evidence:evidence(name)})
const time=(id,raw,taskIds,{type='deadline',precision='exact',normalized=[],actionable=true}={})=>({timePointId:id,rawTexts:[raw],
  type,normalizedValues:normalized,precision,actionable,relatedReferenceTaskIds:taskIds,evidence:evidence(raw)})
const cancel=(id,target,text)=>({relationId:id,type:'cancels',fromReferenceTaskId:null,targetReferenceTaskId:target,effective:true,evidence:evidence(text)})
const replace=(id,from,target,text)=>({relationId:id,type:'replaces',fromReferenceTaskId:from,targetReferenceTaskId:target,effective:true,evidence:evidence(text)})

function source(id,title,text,tags,tasks){
  const sourceText=`[D5匿名合成Development]\n${text}`
  const reference={contractVersion:REFERENCE_CONTRACT_VERSION,referenceVersion:`${id}-reference-v1`,sourceId:id,coverage:'complete',
    truthStatus:'PROVISIONAL_MODEL_AUTHORED',provenance:{labelerAStatus:'CODEX_MODEL_ASSISTED_AUTHOR',
      reviewerBStatus:'NOT_INDEPENDENT_NOT_REVIEWED',modelAssistanceUsed:true},tasks,
    checks:[{checkId:`${id}-task-count`,path:'tasks',operator:'countEquals',value:tasks.length}]}
  return {sourceId:id,sourceVersionId:`${id}-v1`,title,sourceText,referenceTime:FIXED.referenceTime,timezone:FIXED.timezone,
    coverageTags:tags,reference}
}

export function buildD5Development(){
  const rows=[]
  let tasks,m
  tasks=[baseTask('T1','归档','研究伦理声明','系统显示归档完成')]
  m=material('M1','研究伦理声明',['T1'],{formats:['PDF/A'],naming:['课题号-负责人']});tasks[0].materials=[m]
  tasks[0].timePoints=[time('TP1','2026年10月19日16:30前',['T1'],{normalized:['2026-10-19T16:30']})]
  rows.push(source('C13-D5R1-S01','单任务材料格式','请于2026年10月19日16:30前归档研究伦理声明。研究伦理声明须为PDF/A格式，文件名为课题号-负责人；系统显示归档完成即结束。',['single','exact_time','material_format'],tasks))

  tasks=[baseTask('T1','确认','竞赛队伍信息','页面显示确认完成'),baseTask('T2','上传','监护人知情书','平台显示知情书已接收')]
  tasks[0].timePoints=[time('TP1','10月20日前',['T1'],{normalized:['2026-10-20'],precision:'date_only'})]
  tasks[1].timePoints=[time('TP2','10月22日前',['T2'],{normalized:['2026-10-22'],precision:'date_only'})]
  tasks[1].materials=[material('M1','监护人知情书',['T2'],{formats:['JPG']})]
  rows.push(source('C13-D5R1-S02','两个独立义务','请在10月20日前确认竞赛队伍信息，页面显示确认完成；另于10月22日前上传监护人知情书，监护人知情书须为JPG，平台显示知情书已接收。两项分别办理。',['multi','date_only','material'],tasks))

  tasks=[baseTask('T1','领取','实验室门禁卡','在领取册签字',{condition:{value:'true',evidence:evidence('你的入场申请已获批准')}})]
  tasks[0].timePoints=[time('TP1','10月16日11:30前',['T1'],{normalized:['2026-10-16T11:30']})]
  rows.push(source('C13-D5R1-S03','条件为真','你的入场申请已获批准。获批准的同学须在10月16日11:30前领取实验室门禁卡，以在领取册签字为完成。',['condition_true','exact_time'],tasks))

  tasks=[baseTask('T1','参加','作品复评陈述','完成作品复评陈述',{condition:{value:'false',evidence:evidence('你的作品未进入复评名单')},actionable:false})]
  rows.push(source('C13-D5R1-S04','条件为假','进入复评名单的同学须参加作品复评陈述，以完成作品复评陈述为准。你的作品未进入复评名单，本通知不要求你参加。',['condition_false','inactive'],tasks))

  tasks=[baseTask('T1','提交','主持提纲','平台显示提纲已收取',{condition:{value:'unknown',evidence:evidence('主持人安排尚未确定')},actionable:false})]
  tasks[0].timePoints=[time('TP1','下周二下午',['T1'],{precision:'vague',normalized:[],actionable:false})]
  rows.push(source('C13-D5R1-S05','条件未知与模糊时间','若安排你担任主持人，请提交主持提纲，以平台显示提纲已收取为完成。暂定下周二下午办理，主持人安排尚未确定。',['condition_unknown','vague_time'],tasks))

  tasks=[baseTask('T1','补全','田野调查名册','名册必填栏均已填写'),baseTask('T2','报送','田野调查名册','办公室确认收到名册')]
  m=material('M1','田野调查名册',['T1','T2'],{formats:['XLSX']});tasks[0].materials=[m];tasks[1].materials=[m]
  tasks[1].dependencies=['T1']
  rows.push(source('C13-D5R1-S06','共享材料与依赖','请先补全田野调查名册，名册必填栏均已填写后，再报送田野调查名册；田野调查名册格式为XLSX，以办公室确认收到名册为完成。',['shared_material','dependency','multi'],tasks))

  tasks=[baseTask('T1','交付','展览海报初稿','策展组确认收到初稿')]
  tasks[0].timePoints=[time('TP1','月底前后',['T1'],{precision:'vague',normalized:[]})]
  rows.push(source('C13-D5R1-S07','仅有模糊期限','请在月底前后向策展组交付展览海报初稿，以策展组确认收到初稿为完成；确切日期稍后公布。',['vague_time','single'],tasks))

  tasks=[baseTask('T1','核验','报销银行卡信息','页面显示银行卡核验完成'),baseTask('T2','上传','差旅报销声明','系统显示声明上传成功',{dependencies:['T1']})]
  tasks[1].materials=[material('M1','差旅报销声明',['T2'],{formats:['PDF']})]
  rows.push(source('C13-D5R1-S08','前置依赖','请先核验报销银行卡信息，页面显示银行卡核验完成后，才能上传差旅报销声明。差旅报销声明须为PDF；系统显示声明上传成功即完成。',['dependency','material','multi'],tasks))

  rows.push(source('C13-D5R1-S09','禁止项与正确无任务','图书馆检索服务将在周三晚维护，原有预约记录不受影响。无需取消预约，不要上传说明，也不必给管理员发邮件。本通知仅说明维护安排。',['no_task','forbidden','background'],[]))

  tasks=[baseTask('OLD1','归还','实验室备用钥匙','完成备用钥匙归还',{semanticStatus:'cancelled',semanticValidity:'cancelled',actionable:false}),
    baseTask('OLD2','签署','旧版值班名册','完成旧版值班名册签署',{semanticStatus:'cancelled',semanticValidity:'cancelled',actionable:false})]
  tasks[0].cancellationRelations=[cancel('R1','OLD1','取消归还实验室备用钥匙')]
  tasks[1].cancellationRelations=[cancel('R2','OLD2','取消签署旧版值班名册')]
  rows.push(source('C13-D5R1-S10','两个取消端点','原通知要求归还实验室备用钥匙并签署旧版值班名册。现通知：取消归还实验室备用钥匙，同时取消签署旧版值班名册；两项都无需办理。',['multi_endpoint_cancellation','historical'],tasks))

  tasks=[baseTask('OLD1','打印','会议海报','打印会议海报',{semanticStatus:'historical',semanticValidity:'superseded',actionable:false}),
    baseTask('NEW1','上传','会议海报','平台显示电子海报上传成功'),
    baseTask('OLD2','登记','展示时段','登记现场展示时段',{semanticStatus:'historical',semanticValidity:'superseded',actionable:false}),
    baseTask('NEW2','预约','展示时段','页面保存线上展示时段')]
  tasks[1].replacementRelations=[replace('R1','NEW1','OLD1','会议海报改为上传电子版')]
  tasks[3].replacementRelations=[replace('R2','NEW2','OLD2','现场展示场地改为预约线上时段')]
  rows.push(source('C13-D5R1-S11','两个替代端点','原定打印会议海报，并登记现场展示场地。现调整为：会议海报改为上传电子版，平台显示电子海报上传成功；现场展示场地改为预约线上时段，页面保存线上展示时段。两项分别替代原要求。',['multi_endpoint_replacement','historical','multi'],tasks))

  tasks=[baseTask('T1','复核','项目成员资料','页面显示资料复核完成')]
  tasks[0].forbiddenInferences=[{code:'NO_EXTRA_APPROVAL',kind:'field',statement:'不得增加院长签字要求',evidence:evidence('无需院长签字'),
    assertion:{path:'completionStandard.accepted',operator:'contains',value:'必须另行获得院长签字'}}]
  rows.push(source('C13-D5R1-S12','完成标准边界','请复核项目成员资料，以页面显示资料复核完成为完成标准。无需院长签字，也不要创建“联系项目办”任务。',['completion_standard','forbidden'],tasks))
  return rows
}

function evidenceStrings(reference){
  const values=[]
  const visit=(value,key='')=>{
    if(Array.isArray(value)){if(key.toLowerCase().includes('evidence'))for(const item of value)if(typeof item==='string')values.push(item);else for(const item of value)visit(item,key);return}
    if(value&&typeof value==='object')for(const [childKey,child] of Object.entries(value))visit(child,childKey)
  }
  visit(reference)
  return values
}
export function validateD5Development(rows){
  check(rows.length===12,'SOURCE_COUNT');check(new Set(rows.map(row=>row.sourceId)).size===12,'SOURCE_ID_DUPLICATE')
  for(const row of rows){
    validateReferenceV3(row.reference);check(row.reference.sourceId===row.sourceId,'REFERENCE_SOURCE')
    check(row.reference.coverage==='complete'&&row.reference.truthStatus==='PROVISIONAL_MODEL_AUTHORED','REFERENCE_ROLE')
    for(const quote of evidenceStrings(row.reference))check(row.sourceText.includes(quote),'EVIDENCE_NOT_IN_SOURCE:'+row.sourceId+':'+quote)
    compileReferenceV4(row.reference)
  }
  const tags=new Set(rows.flatMap(row=>row.coverageTags))
  for(const required of ['single','multi','condition_true','condition_false','condition_unknown','shared_material','exact_time','vague_time',
    'completion_standard','dependency','forbidden','multi_endpoint_cancellation','multi_endpoint_replacement','no_task'])check(tags.has(required),'COVERAGE:'+required)
  return rows
}

const CORPUS_PATHS=['docs/recognition-optimization/candidate11/b1-preparation','docs/recognition-optimization/candidate11/b2-development-20260921a',
  'docs/recognition-optimization/candidate12/c2-provisional-development','docs/recognition-optimization/candidate12/d1-provisional-paired-preparation',
  'docs/recognition-optimization/candidate12/d2-provisional-development-20260921a','docs/recognition-optimization/candidate12/d3-scorer-contract',
  'docs/recognition-optimization/candidate13/d4-freeze','src/experiments/realInput01/candidate03.ts','src/experiments/realInput01/candidate12.ts',
  'src/experiments/realInput01/candidate13.ts']
const filesBelow=path=>statSync(path).isDirectory()?readdirSync(path,{withFileTypes:true}).flatMap(item=>filesBelow(resolve(path,item.name))):[path]
const normalized=value=>String(value).normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'').toLowerCase()
const grams=value=>{const text=normalized(value),set=new Set();for(let i=0;i<text.length-1;i++)set.add(text.slice(i,i+2));return set}
const similarity=(a,b)=>{const left=grams(a),right=grams(b);if(!left.size||!right.size)return 0;let same=0;for(const item of left)if(right.has(item))same++;return same/(left.size+right.size-same)}
function collectCorpus(root){
  const rows=[]
  for(const relative of CORPUS_PATHS){
    const path=resolve(root,relative);if(!existsSync(path))continue
    for(const file of filesBelow(path)){
      const text=readFileSync(file,'utf8')
      const fragments=text.split(/\r?\n|\\n/).map(value=>value.trim()).filter(value=>normalized(value).length>=20&&normalized(value).length<=2000)
      for(const fragment of fragments)rows.push({path:file.slice(resolve(root).length+1).replaceAll('\\','/'),fragment})
    }
  }
  return rows
}
export function buildOverlapReport(root,rows){
  const corpus=collectCorpus(root)
  const items=rows.map(row=>{
    let best={similarity:0,path:null,fragment:null}
    for(const candidate of corpus){const score=similarity(row.sourceText,candidate.fragment);if(score>best.similarity)best={similarity:score,path:candidate.path,fragment:candidate.fragment}}
    const sourceNorm=normalized(row.sourceText)
    const exact=corpus.filter(item=>normalized(item.fragment)===sourceNorm).map(item=>item.path)
    return {sourceId:row.sourceId,exactMatches:exact,maxBigramJaccard:Number(best.similarity.toFixed(6)),nearestPath:best.path,
      nearestFragmentSha256:best.fragment?sha256(best.fragment):null,decision:exact.length||best.similarity>=0.8?'REVIEW_REQUIRED':'PASS_LOCAL_SCREEN'}
  })
  check(items.every(item=>item.decision==='PASS_LOCAL_SCREEN'),'OVERLAP_REVIEW_REQUIRED')
  return {version:'candidate13-d5-overlap-1.0.0',method:'normalized character bigram Jaccard over frozen local corpus lines',threshold:0.8,
    corpusPaths:CORPUS_PATHS,corpusFragments:corpus.length,limitations:['Local deterministic screen only','No external embedding','Passing does not prove zero conceptual overlap'],items}
}

export async function loadD5Api(root=process.cwd()){
  const bundled=await build({absWorkingDir:root,stdin:{contents:`
    export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';
    export {prepareCandidate13D5,validateCandidate13D5Prepared,denyCandidate13D5Dispatch,D5_EVALUATION_ROLE,D5_TRUTH_STATUS} from './src/experiments/candidate13/preparedIdentity.ts';
    export {CANDIDATE03_VERSION} from './src/experiments/realInput01/candidate03.ts';
    export {CANDIDATE13_VERSION,CANDIDATE13_PROMPT_VERSION} from './src/experiments/realInput01/candidate13.ts';
    export {adaptModelWire,WIRE_VERSION} from './src/experiments/realInput01/modelWire.ts';
  `,resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'))
}
const forbiddenKeys=new Set(['reference','expected','scorerReference','forbiddenInferences','allowedMerges','minimalObligations'])
function assertNoExpected(value){
  if(Array.isArray(value)){for(const item of value)assertNoExpected(item);return}
  if(!value||typeof value!=='object')return
  for(const [key,child] of Object.entries(value)){check(!forbiddenKeys.has(key),'EXPECTED_IN_REQUEST:'+key);assertNoExpected(child)}
}
function sameNonPrompt(left,right){const a=structuredClone(left.request),b=structuredClone(right.request);a.input[0].content[0].text='__PROMPT__';b.input[0].content[0].text='__PROMPT__';return isDeepStrictEqual(a,b)}

export async function buildD5Outputs(root=process.cwd(),generatedAt=new Date().toISOString()){
  const d4=await verifyCandidate13D4(root),rows=validateD5Development(buildD5Development()),overlap=buildOverlapReport(root,rows)
  const api=await loadD5Api(root),compiled=new Map(rows.map(row=>[row.sourceId,compileReferenceV4(row.reference)]))
  const sources={version:'candidate13-d5r1-sources-1.1.0',status:'FROZEN_SYNTHETIC_DEVELOPMENT',generatedAt,
    evaluationRole:'SYNTHETIC_DEVELOPMENT',truthStatus:'PROVISIONAL_MODEL_AUTHORED',eligibleForIndependentHoldout:false,
    sources:rows.map(({reference,...row})=>({...row,sourceSha256:sha256(row.sourceText)}))}
  const references={version:'candidate13-d5r1-references-1.1.0',status:'FROZEN_MODEL_ASSISTED_REFERENCES',generatedAt,
    evaluationRole:'SYNTHETIC_DEVELOPMENT',truthStatus:'PROVISIONAL_MODEL_AUTHORED',eligibleForIndependentHoldout:false,
    references:rows.map(row=>({sourceId:row.sourceId,referenceSha256:sha256(stable(row.reference)),compiledSha256:compiled.get(row.sourceId).compiledSha256,
      reference:row.reference,compiledReference:compiled.get(row.sourceId)}))}
  const requests=[];let ordinal=0
  for(const [index,row] of rows.entries()){
    const context={index:await api.indexImmutableScopesV11(row.sourceId,row.sourceVersionId,row.sourceText),referenceTime:row.referenceTime,timezone:row.timezone}
    const order=index%2===0?['A','B']:['B','A'],pair=[]
    for(const arm of order){
      const prepared=await api.prepareCandidate13D5(context,arm);await api.validateCandidate13D5Prepared(prepared);assertNoExpected(prepared.request)
      check(prepared.dispatchAuthorized===false&&prepared.resultStatus==='NOT_RUN','DISPATCH_STATE')
      const core={unitId:`D5R1-${row.sourceId.slice(-3)}-${arm}`,ordinal:++ordinal,sourceId:row.sourceId,sourceVersionId:row.sourceVersionId,
        arm,position:order.indexOf(arm)+1,candidateVersion:prepared.identity.candidateVersion,promptVersion:prepared.identity.promptVersion,
        sourceSha256:sha256(row.sourceText),referenceSha256:sha256(stable(row.reference)),compiledReferenceSha256:compiled.get(row.sourceId).compiledSha256,
        identitySha256:prepared.identitySha,requestSha256:prepared.identity.requestSha,promptSha256:prepared.identity.promptSha,
        exampleSha256:prepared.identity.exampleSha,schemaSha256:prepared.identity.schemaSha,adapterSha256:d4.binding.adapterSha,
        scorerVersion:D5_SCORER_VERSION,compilerVersion:D5_COMPILER_VERSION,requestBytes:Buffer.byteLength(JSON.stringify(prepared.request))}
      const entry={...core,unitIdentitySha256:sha256(stable(core)),dispatchAuthorized:false,status:'NOT_RUN',request:prepared.request,prepared}
      requests.push(entry);pair.push(entry)
    }
    check(sameNonPrompt(pair[0],pair[1]),'NON_PROMPT_DRIFT:'+row.sourceId)
  }
  check(requests.length===24&&requests.filter(row=>row.arm==='A').length===12&&requests.filter(row=>row.arm==='B').length===12,'REQUEST_COUNT')
  check(new Set(requests.map(row=>row.unitIdentitySha256)).size===24,'REQUEST_IDENTITY_DUPLICATE')
  const prepared={version:'candidate13-d5r1-prepared-identities-1.1.0',status:'D5_ZERO_CALL_IDENTITIES_READY',generatedAt,
    evaluationRole:'SYNTHETIC_DEVELOPMENT',truthStatus:'PROVISIONAL_MODEL_AUTHORED',eligibleForIndependentHoldout:false,
    dispatchAuthorized:false,resultStatus:'NOT_RUN',requestCount:24,modelCalls:0,fixedConfig:FIXED,requests}
  const sourceText=json(sources),referenceText=json(references),requestText=json(prepared),overlapText=json(overlap)
  const ledgerBytes=readFileSync(AUTHORITY_LEDGER),ledgerRows=ledgerBytes.toString('utf8').trimEnd().split(/\r?\n/).map(JSON.parse)
  const ledger={path:AUTHORITY_LEDGER,rows:ledgerRows.length,bytes:ledgerBytes.length,sha256:sha256(ledgerBytes),tail:ledgerRows.at(-1)?.hash??null,writerOpened:false}
  check(isDeepStrictEqual(ledger,{...EXPECTED_LEDGER,path:AUTHORITY_LEDGER,writerOpened:false}),'AUTHORITY_LEDGER_DRIFT')
  const protection=verifyProtectedFiles(root);check(protection.count===84,'PROTECTED_FILES_DRIFT')
  const manifest={version:'candidate13-d5r1-manifest-1.1.0',dataRevision:'D5-R1',status:'CANDIDATE13_V4_DEVELOPMENT_READY_FOR_NEW_AUTHORIZATION',generatedAt,
    preDataFreezeCommit:'ee6ee45caa4e1bd258237ccb4c6bc9792d0c9e34',invalidatedDraft:{status:'NEVER_DISPATCHED_NEVER_SCORED',reason:'v4.0 timePoint.actionable was not expressible by the frozen production output Schema'},candidate13Freeze:{candidateVersion:d4.candidate.candidateVersion,
      promptVersion:d4.candidate.promptVersion,promptSha256:d4.candidate.promptSha256,candidateBundleSha256:d4.candidate.candidateBundleSha256,
      originalScorerVersion:d4.binding.scorerVersion,originalBindingSha256:d4.binding.bindingSha},
    evaluationBinding:{referenceContractVersion:REFERENCE_CONTRACT_VERSION,compilerVersion:D5_COMPILER_VERSION,
      preparationVersion:'candidate13-d5r1-preparation-1.1.0',preparationSha256:fileHash(root,'scripts/prepare-candidate13-d5.mjs'),
      compilerSha256:fileHash(root,'scripts/compile-candidate13-reference-v4.mjs'),scorerInputVersion:D5_SCORER_INPUT_VERSION,
      scorerVersion:D5_SCORER_VERSION,scorerSha256:fileHash(root,'scripts/score-candidate13-contract-v4.mjs'),
      schemaSha256:d4.candidate.schemaSha256,adapterSha256:d4.binding.adapterSha,
      measurementVersion:'candidate13-product-metrics-1.0.0',measurementSha256:fileHash(root,'src/experiments/candidate13/measurement.ts'),
      preparedIdentitySha256:fileHash(root,'src/experiments/candidate13/preparedIdentity.ts'),
      observationSha256:fileHash(root,'src/experiments/candidate13/observation.ts')},
    data:{sources:12,references:12,completeReferences:12,modelAssistedReferences:12,independentHumanReferences:0,
      eligibleForIndependentHoldout:false,sourceSetSha256:sha256(sourceText),referenceSetSha256:sha256(referenceText),overlapSha256:sha256(overlapText)},
    experiment:{arms:{A:api.CANDIDATE03_VERSION,B:api.CANDIDATE13_VERSION},requests:24,order:'6 AB / 6 BA alternating',fixedConfig:FIXED,
      dispatchAuthorized:false,resultStatus:'NOT_RUN',retry:false,repair:false,verifier:false,
      advancementGate:{determinateUnits:24,schemaAndEvidenceValidPerArm:12,candidate13Severe:0,candidate13Forbidden:0,
        teachingLeak:0,noTaskFnIncrease:true,noCriticalFieldMajorIncrease:true,completeSourceNetGainAtLeast:2}},
    metricStatus:{firstWholeSuggestionAccuracy:'NOT_RUN',correctDispositionRate:'NOT_OBSERVABLE',
      lowModificationCorrectDispositionRate:'NOT_OBSERVABLE',activeEditTime:'NOT_OBSERVABLE'},
    hashes:{[D5_SOURCES_FILE]:sha256(sourceText),[D5_REFERENCES_FILE]:sha256(referenceText),[D5_REQUESTS_FILE]:sha256(requestText),[D5_OVERLAP_FILE]:sha256(overlapText)},
    protection,authorityLedger:ledger,operations:{modelCalls:0,connectivityProbes:0,secretReads:0,grants:0,reserves:0,settlements:0,
      receipts:0,ledgerWrites:0,humanTrials:0,defaultCandidateChanges:0,merges:0,deploys:0},
    humanGateStatus:'WAITING_FOR_INDEPENDENT_HUMAN_LABELS_AND_TRIAL',historicalFailure:{id:'RCO-5-007',status:'PRESERVED_FAILING',error:'FREEZE_HASH_MISMATCH:package-lock.json'}}
  return {sources,references,prepared,overlap,manifest,sourceText,referenceText,requestText,overlapText,manifestText:json(manifest)}
}
function freezeWrite(root,path,text){const target=resolve(root,path);mkdirSync(dirname(target),{recursive:true});if(existsSync(target))check(readFileSync(target,'utf8')===text,'FROZEN_OUTPUT_DRIFT:'+path);else writeFileSync(target,text,{flag:'wx'})}
export async function writeD5Outputs(root=process.cwd()){const output=await buildD5Outputs(root);freezeWrite(root,D5_SOURCES_FILE,output.sourceText);freezeWrite(root,D5_REFERENCES_FILE,output.referenceText);freezeWrite(root,D5_REQUESTS_FILE,output.requestText);freezeWrite(root,D5_OVERLAP_FILE,output.overlapText);freezeWrite(root,D5_MANIFEST_FILE,output.manifestText);return output}
export async function verifyD5Outputs(root=process.cwd()){check(existsSync(resolve(root,D5_MANIFEST_FILE)),'MANIFEST_MISSING');const generatedAt=JSON.parse(readFileSync(resolve(root,D5_MANIFEST_FILE),'utf8')).generatedAt,output=await buildD5Outputs(root,generatedAt);for(const [path,text] of [[D5_SOURCES_FILE,output.sourceText],[D5_REFERENCES_FILE,output.referenceText],[D5_REQUESTS_FILE,output.requestText],[D5_OVERLAP_FILE,output.overlapText],[D5_MANIFEST_FILE,output.manifestText]])check(readFileSync(resolve(root,path),'utf8')===text,'OUTPUT_DRIFT:'+path);return output}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const mode=process.argv[2];check(['--write','--verify'].includes(mode),'USAGE');const output=mode==='--write'?await writeD5Outputs():await verifyD5Outputs();console.log(JSON.stringify({status:output.manifest.status,sources:12,references:12,requests:24,modelCalls:0,dispatchAuthorized:false,manifestSha256:sha256(output.manifestText),ledger:output.manifest.authorityLedger,protectedFiles:output.manifest.protection.count}))}
