import {createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs'
import {join,resolve,relative} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {build} from 'esbuild'
import {CANDIDATE14_REFERENCE_VERSION,CANDIDATE14_SCORER_VERSION,canonical,legalWireOracle,validateCandidate14Reference} from './candidate14-reference-contract.mjs'
import {scoreCandidate14} from './score-candidate14-contract-v5.mjs'

export const D7_DEVELOPMENT_DIRECTORY='docs/recognition-optimization/candidate14/d7-development'
export const D7_AUTHORING_MODULE='scripts/candidate14-d7-r5-authoring.mjs'
const FREEZE='docs/recognition-optimization/candidate14/d7-freeze/FREEZE_MANIFEST.json',ORDER=['AB','BA','BA','AB','BA','AB','AB','BA','AB','BA','BA','AB']
const hash=value=>createHash('sha256').update(value).digest('hex'),check=(v,c)=>{if(!v)throw Error('CANDIDATE14_D7_DEVELOPMENT_'+c)},json=value=>JSON.stringify(value,null,2)+'\n'
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trim(),file=path=>({path:path.replaceAll('\\','/'),bytes:readFileSync(path).length,sha256:hash(readFileSync(path))})
export const d7Field=(canonical,...aliases)=>({canonical,aliases})
export const d7Task=(id,action,object,over={})=>({id,action:d7Field(action),object:d7Field(object),actor:'addressee',currentness:'current',condition:'not_applicable',actionability:'actionable',defaultSelection:'selected',confirmation:'required',materials:'N/A',times:'N/A',completionStandards:'N/A',dependencies:'N/A',actionScopeIds:[],objectScopeIds:[],conditionScopeIds:[],factScopeIds:[],scopeIds:[],...over})
export const d7Fact=(id,kind,value,sourceText,scopeIds,over={})=>({id,kind,value,aliases:[],sourceText,scopeIds,...over})
export const d7Time=(type,rawText,normalizedValue,precision,isAllDay,needsConfirmation)=>({type,rawText,normalizedValue,timezone:'Asia/Shanghai',precision,isAllDay,needsConfirmation})
export function d7Reference(index,tasks,relations=[],noTaskFacts=[]){return {version:CANDIDATE14_REFERENCE_VERSION,sourceId:index.sourceId,completeness:'complete',referenceTime:'2026-09-22T00:00:00.000Z',timezone:'Asia/Shanghai',truthStatus:'PROVISIONAL_MODEL_AUTHORED',provenance:'single-author-synthetic-development',scopeTextById:Object.fromEntries(index.scopes.map(scope=>[scope.id,scope.text])),allowedAliases:[],tasks,relations,noTaskFacts}}
async function api(){const output=await build({stdin:{contents:`export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';export {buildCandidate03Request,CANDIDATE03_VERSION} from './src/experiments/realInput01/candidate03.ts';export {buildCandidate14Request,CANDIDATE14_VERSION,CANDIDATE14_PROMPT_VERSION} from './src/experiments/realInput01/candidate14.ts';export {adaptCandidate14CommonWire,CANDIDATE14_COMMON_ADAPTER_VERSION} from './src/experiments/candidate14/commonAdapter.ts';export {MODEL_JSON_SCHEMA} from './src/experiments/realInput01/modelWire.ts';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'});return import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64'))}
const actionType=action=>({上传:'upload',提交:'submit',领取:'collect',签署:'sign',完成:'complete',核验:'review',归还:'submit',打印:'print',登记:'register',预约:'register',保存:'save'}[action]??'other')
function oracleWire(reference,index){
  const scope=index.scopes[0].id,materials=[],timePoints=[],tasks=reference.tasks.map((t,i)=>{const mids=t.materials==='N/A'?[]:t.materials.map((name,j)=>{const id=`m${i}_${j}`;materials.push({tempId:id,name,required:true,formatRequirements:[],namingRequirements:[],quantity:null,submissionChannel:null,relatedTaskTempIds:[t.id],scopeIds:t.scopeIds,confidence:1});return id}),tids=t.times==='N/A'?[]:t.times.map((value,j)=>{const id=`p${i}_${j}`;timePoints.push({tempId:id,type:value.type,rawText:value.rawText,relatedTaskTempIds:[t.id],relatedMaterialTempIds:[],scopeIds:t.scopeIds,confidence:1});return id}),cancelled=t.currentness==='cancelled',superseded=t.currentness==='superseded';return {id:t.id,propositionScopeIds:t.scopeIds,semantics:{actor:t.actor,speechAct:'directive',polarity:t.actionability==='not_actionable'?'negative':'affirmative',tense:cancelled||superseded?'past':'future',status:cancelled?'cancelled':superseded?'pending':'pending',validity:superseded?'superseded':'active',modality:t.actionability==='actionable'?'required':'informational'},inferenceLevel:'explicit',actionType:actionType(t.action.canonical),action:{scopeId:t.actionScopeIds[0],surface:t.action.canonical},object:{scopeId:t.objectScopeIds[0],surface:t.object.canonical},effect:'physical_action',detail:{parentTempId:null,hierarchyType:'task',title:t.action.canonical+t.object.canonical,description:'',completionCriteria:t.completionStandards==='N/A'?[]:t.completionStandards,estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:t.dependencies==='N/A'?[]:t.dependencies,materialTempIds:mids,timePointTempIds:tids,confidence:1,userConfirmationRequired:true},condition:{value:t.condition,conditionScopeIds:t.conditionScopeIds,factScopeIds:t.factScopeIds},coverage:{time:tids.length?'present':'not_stated',material:mids.length?'present':'not_stated',event:'not_stated'},eventTempIds:[]}})
  const standaloneTimes=reference.noTaskFacts.filter(f=>f.kind==='time').map(fact=>({tempId:`info-time-${fact.id}`,type:'event_start',rawText:fact.value,relatedTaskTempIds:[],relatedMaterialTempIds:[],scopeIds:fact.scopeIds,confidence:1}));timePoints.push(...standaloneTimes)
  const factsById=new Map(reference.noTaskFacts.map(fact=>[fact.id,fact])),events=reference.noTaskFacts.filter(f=>f.kind==='event').map((fact,i)=>{const timeId=fact.timeFactIds[0],locationId=fact.locationFactIds[0],location=locationId?factsById.get(locationId):null;return {tempId:`info-event-${i}`,title:fact.value,description:'',startTimePointTempId:timeId?`info-time-${timeId}`:null,endTimePointTempId:null,location:location?.value??null,scopeIds:[...new Set([...fact.scopeIds,...(location?.scopeIds??[])])],confidence:1,inferenceLevel:'explicit',relatedTaskTempIds:[]}})
  const informationScopeIds=[...new Set(reference.noTaskFacts.filter(f=>f.kind==='information').flatMap(f=>f.scopeIds))]
  return {schemaVersion:'real-input-model-wire-1',tasks,materials,timePoints,events,revisions:reference.relations.map(r=>({type:r.type,targetDirectiveId:r.targetTaskId,scopeIds:[scope],fromDirectiveId:r.fromTaskId,effective:r.effective})),conflicts:[],informationScopeIds,unresolvedScopeIds:[]}
}
const normalize=value=>value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,''),grams=(value,n=3)=>{const s=normalize(value),out=new Set();for(let i=0;i<=s.length-n;i++)out.add(s.slice(i,i+n));return out},jac=(a,b)=>{const x=grams(a),y=grams(b),inter=[...x].filter(v=>y.has(v)).length;return x.size||y.size?inter/(x.size+y.size-inter):0}
function oldCorpus(){
  const out=[],add=(path,id,text,kind)=>{if(typeof text==='string'&&/[\p{Script=Han}]/u.test(text)&&normalize(text).length>=8)out.push({path,id,text,kind})}
  function strings(value,path,keyPath=[]){if(typeof value==='string'){add(path,keyPath.join('.'),value,'historical_json_string');return}if(Array.isArray(value)){value.forEach((row,index)=>strings(row,path,[...keyPath,String(index)]));return}if(value&&typeof value==='object')for(const [key,child] of Object.entries(value))strings(child,path,[...keyPath,key])}
  function walkJson(dir){if(!existsSync(dir))return;for(const name of readdirSync(dir)){const path=join(dir,name),s=statSync(path);if(s.isDirectory()){if(!path.includes(`${join('candidate14')}`))walkJson(path)}else if(name.endsWith('.json'))try{strings(JSON.parse(readFileSync(path,'utf8')),path)}catch{}}}
  function walkCode(dir){if(!existsSync(dir))return;for(const name of readdirSync(dir)){const path=join(dir,name),s=statSync(path);if(s.isDirectory())walkCode(path);else if(/\.(?:ts|tsx|mjs)$/u.test(name)){for(const [index,line] of readFileSync(path,'utf8').split(/\r?\n/u).entries())add(path,`line-${index+1}`,line,'prompt_or_engineering_fixture')}}}
  walkJson('docs/recognition-optimization');walkCode('src/experiments/realInput01');walkCode('src/recognition');return out
}
const priorR4SourceHashes=new Set([
  'a72e17388f73fb936217bf03786b34f8c333ac56a7ec97a0000aa03f6be1ab5a',
  'dfe2e4c192c6e3e19a0f819a1d13b56fd98966199ae436b8cb225dc48ea9acf8',
  'e136b6888f70254a2f15dd47b811af9ed32e119668163ba93b9207763ed4151c',
  'f8c9039026edccdadc180865911a5be30da2432b694dce9d51089a0819800ba9',
  'f4a2654b699d5349bd9e88493a8299674fd28bd1acd5fadfc63286a85cab0952',
  '2a55bd93cccbba3301a9ac516ffe8febe468986fc71f22e24dac51af3763e724',
  'bc8005b7bb966250540c603165c32407b3b8045efe5a03a2a3a42d83c10429a1',
  'e56cf5a129d17d14393355b4aa766b88f3696efec577a97cd8c39ec0530bb721',
  '8bbc13c32f7af89082592572967b47db2ef5b2fac98ac0b83811af2dca508e71',
  '8a88a7e714c64abdfc757f7685497de7556805e1245f348c048c30296ceeda69',
  '35ab133450cbfba0156a52c28d14f746c7ce3a8f31b88ec194841e9d06ef766b',
  'ccc48fca07b9cb324698f827cb9ca70c9ad9e1ba7792e6c0739b68330c476ced'
])
// Frozen exclusion corpus from the invalidated R4 package. It contains no R5 source or reference.
const priorR4Texts=[
  '请在10月6日17:30前将创新训练申请书上传至实践平台。申请书须为PDF/A格式，文件名为“学院-组号”，以页面显示“提交成功”为完成。',
  '请于10月8日中午12点前提交器材借用清单；另请于10月9日下午4点前领取门禁卡。清单使用XLSX格式，门禁卡凭学生证领取，两项可独立办理。',
  '志愿者名单已经公布，你在入选名单中。请在本周五前签署服务承诺书。咨询电话仅供疑问联系。',
  '若实验室安全测验通过，需领取白色门卡。系统记录显示本次测验未通过，因此当前无需领取门卡，后续安排另行通知。',
  '如复核结果确认你进入答辩环节，请提交主持提纲。复核结果尚未发布；答辩暂定下周二下午举行。',
  '先完成社团年审表，再提交社团年审材料包。两步共同使用盖章版经费说明，只有前一步完成后才能办理后一步。',
  '请分别上传实验室巡检照片和消防演练照片。两类照片均为JPG格式，顺序可调换，但不得合并为一个文件。',
  '请核验报销银行卡信息，并在系统页面显示“核验完成”后提交差旅报销单。材料须为PDF，地点为行政楼201室，咨询方式见群公告。',
  '图书馆西区将于周三晚进行闭馆维护，地点在二层阅览区。维护期间禁止进入施工围挡区域，也不要移动现场标识；本通知无需办理任何事项。',
  '此前要求归还摄影棚钥匙并签署设备交接单。现通知：取消归还钥匙的安排，同时取消签署设备交接单的安排，没有替代事项。',
  '原安排为打印纸质海报并登记现场展示场地。现改为上传电子海报，并改为预约线上展示时段；两项新安排分别替代对应旧安排。',
  '请保存讲座签到原始记录。通知中引用场地方要求：“工作人员须检查消防通道”，该要求由场地方工作人员执行。签到记录的提交日期稍后公布。'
]
const content=value=>typeof value==='string'?value:json(value)
const freezeCommit=()=>git(['log','-1','--format=%H','--',FREEZE])
const gitContains=(commit,path)=>{try{execFileSync('git',['cat-file','-e',`${commit}:${path}`],{stdio:'ignore'});return true}catch{return false}}
const stripSystemPrompt=body=>{const copy=structuredClone(body);copy.input[0].content[0].text='<SYSTEM_PROMPT>';return copy}
export async function buildPackage(generatedAt=new Date().toISOString()){
  check(priorR4Texts.length===priorR4SourceHashes.size&&priorR4Texts.every(text=>priorR4SourceHashes.has(hash(text))),'R4_EXCLUSION_CORPUS_DRIFT')
  check(existsSync(FREEZE),'FREEZE_MANIFEST_MISSING')
  const commit=freezeCommit();check(commit&&git(['merge-base','--is-ancestor',commit,'HEAD'])==='', 'FREEZE_COMMIT_NOT_ANCESTOR')
  const frozen=JSON.parse(readFileSync(FREEZE,'utf8'))
  check(frozen.status==='FROZEN_PRE_DATA','FREEZE_STATUS')
  check(frozen.components.some(row=>row.path==='scripts/prepare-candidate14-d7-development.mjs'),'GENERATOR_NOT_FROZEN')
  check(!gitContains(commit,D7_AUTHORING_MODULE),'AUTHORING_FILE_PRECEDES_FREEZE')
  const componentNow=frozen.components.map(row=>file(row.path));check(JSON.stringify(componentNow)===JSON.stringify(frozen.components),'FREEZE_DRIFT')
  check(existsSync(D7_AUTHORING_MODULE),'AUTHORING_FILE_MISSING')
  const authoredFile=file(D7_AUTHORING_MODULE)
  const authoring=await import(pathToFileURL(resolve(D7_AUTHORING_MODULE)).href+'?sha256='+authoredFile.sha256)
  check(Array.isArray(authoring.SOURCES)&&authoring.SOURCES.length===12,'AUTHORING_SOURCE_COUNT')
  const x=await api(),sources=[],references=[]
  for(let i=0;i<authoring.SOURCES.length;i++){
    const authored=authoring.SOURCES[i];check(typeof authored.text==='string'&&authored.text.trim()&&typeof authored.reference==='function','AUTHORING_SOURCE_SHAPE')
    check(!priorR4SourceHashes.has(hash(authored.text)),'R4_SOURCE_REUSE')
    const id=`C14-D7DEV-S${String(i+1).padStart(2,'0')}`,versionId=id+'-v1',index=await x.indexImmutableScopesV11(id,versionId,authored.text)
    const reference=authored.reference(index,{d7Task,d7Fact,d7Time,d7Reference})
    check(reference.sourceId===id,'REFERENCE_SOURCE_ID');validateCandidate14Reference(reference)
    const context={index,referenceTime:'2026-09-22T00:00:00.000Z',timezone:'Asia/Shanghai'},wire=oracleWire(reference,index),adapted=x.adaptCandidate14CommonWire(wire,context).adapted,score=scoreCandidate14(reference,adapted)
    if(!score.complete)throw Error('CANDIDATE14_D7_DEVELOPMENT_ORACLE_'+id+':'+JSON.stringify(score))
    sources.push({sourceId:id,sourceVersionId:versionId,text:authored.text,sourceSha256:hash(authored.text),referenceTime:context.referenceTime,timezone:context.timezone,index})
    references.push({...reference,referenceSha256:hash(canonical(reference)),oracle:{status:'PASS',wireProjection:legalWireOracle(reference),scoreVersion:CANDIDATE14_SCORER_VERSION}})
  }
  check(new Set(sources.map(v=>v.sourceSha256)).size===12,'DUPLICATE_SOURCE')
  const corpus=[...oldCorpus(),...priorR4Texts.map((text,index)=>({path:'invalidated-r4/SOURCES.json',id:`C14-D7DEV-S${String(index+1).padStart(2,'0')}`,text,kind:'invalidated_r4_source'}))],overlap=[]
  for(const source of sources){let best={similarity:0,path:null,id:null};for(const old of corpus){const similarity=jac(source.text,old.text);if(similarity>best.similarity)best={similarity,path:relative('.',old.path).replaceAll('\\','/'),id:old.id}}overlap.push({sourceId:source.sourceId,...best,exact:corpus.some(old=>normalize(old.text)===normalize(source.text))})}
  check(overlap.every(row=>!row.exact&&row.similarity<0.65),'OVERLAP')
  const requests=[];let ordinal=1
  for(let i=0;i<sources.length;i++){
    const source=sources[i],reference=references[i],context={index:source.index,referenceTime:source.referenceTime,timezone:source.timezone},builders={A:await x.buildCandidate03Request(context),B:await x.buildCandidate14Request(context)}
    for(let position=0;position<2;position++){
      const arm=ORDER[i][position],built=structuredClone(builders[arm]);built.body.model='deepseek-flash'
      const serialized=JSON.stringify(built.body),unitId=`D7DEV-S${String(i+1).padStart(2,'0')}-${arm}`
      const core={unitId,ordinal,sourceId:source.sourceId,sourceVersionId:source.sourceVersionId,arm,position:position+1,candidateVersion:arm==='A'?x.CANDIDATE03_VERSION:x.CANDIDATE14_VERSION,promptVersion:arm==='A'?x.CANDIDATE03_VERSION:x.CANDIDATE14_PROMPT_VERSION,sourceSha256:source.sourceSha256,referenceSha256:reference.referenceSha256,requestSha256:hash(serialized),promptSha256:hash(built.body.input[0].content[0].text),schemaSha256:hash(canonical(built.body.text.format.schema)),adapterAggregateSha256:frozen.aggregateSha256,referenceVersion:CANDIDATE14_REFERENCE_VERSION,scorerVersion:CANDIDATE14_SCORER_VERSION,model:'deepseek-flash',temperature:0,reasoning:'none',maxOutputTokens:8192}
      requests.push({...core,unitIdentitySha256:hash(canonical(core)),dispatchAuthorized:false,status:'NOT_RUN',request:built.body,context});ordinal++
    }
  }
  check(requests.length===24&&requests.filter(r=>r.arm==='A').length===12&&requests.filter(r=>r.arm==='B').length===12,'REQUEST_COUNT')
  for(const source of sources){const pair=requests.filter(r=>r.sourceId===source.sourceId);check(JSON.stringify(stripSystemPrompt(pair[0].request))===JSON.stringify(stripSystemPrompt(pair[1].request)),'PAIR_DRIFT')}
  const freezeCommittedAt=git(['show','-s','--format=%cI',commit]);check(Number.isFinite(Date.parse(generatedAt))&&Date.parse(generatedAt)>Date.parse(freezeCommittedAt),'FREEZE_TIME_ORDER')
  const base={generatedAt,freezeCommittedAt,freezeCommit:commit,freezeAggregateSha256:frozen.aggregateSha256,authoringFile:authoredFile,evaluationRole:'SYNTHETIC_DEVELOPMENT',truthStatus:'PROVISIONAL_MODEL_AUTHORED',eligibleForIndependentHoldout:false,modelCalls:0,dispatchAuthorized:false,resultStatus:'NOT_RUN',invalidatedPredecessorManifestSha256:'00cf591998b6396ca4bbbbca61b4a0594cdb88f86b8879f02391bdea350a8866'}
  const files={
    'SOURCES.json':{version:'candidate14-d7-sources-r5',...base,sources},
    'REFERENCES.json':{version:'candidate14-d7-references-r5',...base,references},
    'PREPARED_REQUEST_IDENTITIES.json':{version:'candidate14-d7-prepared-identities-r5',...base,fixedConfig:{model:'deepseek-flash',temperature:0,reasoning:'none',maxOutputTokens:8192,referenceTime:'2026-09-22T00:00:00.000Z',timezone:'Asia/Shanghai'},requestCount:24,requests},
    'OVERLAP_REPORT.json':{version:'candidate14-d7-overlap-r5',...base,threshold:0.65,corpusFiles:new Set(corpus.map(v=>v.path)).size,corpusKinds:Object.fromEntries([...new Set(corpus.map(v=>v.kind))].sort().map(kind=>[kind,corpus.filter(v=>v.kind===kind).length])),coverage:['B1_B2_AND_HISTORICAL_JSON_STRINGS','HISTORICAL_EXPECTED_AND_REFERENCES','REAL_INPUT_PROMPTS_AND_ENGINEERING_FIXTURES','R4_SOURCE_SHA256_AND_3GRAM_SIMILARITY'],results:overlap,status:'PASS'},
    'README.md':'# Candidate14 D7 Development R5\n\n零模型调用准备包。参照均为单作者合成工程参照，不能作为独立人工真值；请求均为 `dispatchAuthorized=false / NOT_RUN`。\n',
    'EXPERIMENT_DESIGN.md':`# Candidate03 vs Candidate14 D7 Development R5 预注册\n\n12份全新匿名合成 Development，文本表面未见但错误族已见。顺序固定为6组AB与6组BA。两臂仅 Prompt 不同，共用 Candidate14 common adapter/time policy、Reference/Scorer ${CANDIDATE14_SCORER_VERSION}。每个逻辑单元一次发送、零重试、零 repair、零 verifier；transport或结算不确定立即停止。24个结局全部保留分母。\n\n晋级门槛：24个确定结局；两臂12/12 Schema与引用有效；Candidate14 Severe=0、Forbidden=0；教学例为N/A；Candidate14不增加任务FN或关键字段Major；完整正确来源净增至少2。任一失败固定拒绝。\n`,
    'BUDGET_AUTHORIZATION_CARD_DRAFT.md':'# 未来 D7 Development R5 预算授权卡草案\n\n当前没有授权、grant、reserve、settle或账本写入。未来仅可申请 R5 Manifest 冻结的24次 deepseek-flash 请求，硬上限建议 US$1.00，零重试、零 repair、零 verifier。真正调用前必须重新联网核验 DeepSeek 官方价格、重新计算24个冻结请求最坏费用、只读核验权威账本与远端 HEAD，并由用户给出新的明确授权。价格未知或路由漂移时停止。\n',
    'CORRECTIONS_LOG.md':'# D7 Development R5 追加式订正日志\n\nR1、R2、R3、R4均在派发前失效。Manifest SHA-256 依次为 `8e3775dfcd9e2c30d1d7de1a53181306c0810c9ac9494c6f033e57e407c49887`、`7da51e3710a5682d8c24db95b0c67321c3c93dbabe7e5170da15ee6b0f5dc554`、`96760f25fab7cce9b78068aea38bd571737baa3925ac6815f80ea8a312d7de30`、`00cf591998b6396ca4bbbbca61b4a0594cdb88f86b8879f02391bdea350a8866`。四批均未授权、未调用。R5冻结后订正只能追加新条目并产生新版本。\n',
    'VALIDATION.md':`# D7 Development R5 准备验证\n\n- 12份来源、12份完整参照、24个请求身份。\n- 6组AB、6组BA；两臂除系统 Prompt 外完全相同。\n- 每份参照通过合法 wire、公共 adapter 和 ${CANDIDATE14_SCORER_VERSION} oracle。\n- 未把 Expected 或参照内容放入请求。\n- 重合检查通过；错误族已见，文本表面未见。\n- dispatchAuthorized=false，NOT_RUN，modelCalls=0。\n`
  }
  const manifests=Object.entries(files).map(([name,value])=>({path:`${D7_DEVELOPMENT_DIRECTORY}/${name}`,bytes:Buffer.byteLength(content(value)),sha256:hash(content(value))}))
  files['MANIFEST.json']={version:'candidate14-d7-development-manifest-r5',...base,status:'READY_FOR_NEW_AUTHORIZATION',sources:12,requests:24,order:ORDER,files:manifests,components:frozen.components,teachingLeak:{status:'NOT_APPLICABLE_NO_TEACHING_EXAMPLES',count:null},authorizationId:null,grantId:null,budgetReserved:false,ledgerWritten:false}
  return files
}
export async function writePackage(){check(!existsSync(D7_DEVELOPMENT_DIRECTORY),'OUTPUT_EXISTS');const files=await buildPackage();mkdirSync(D7_DEVELOPMENT_DIRECTORY,{recursive:true});for(const [name,value] of Object.entries(files))writeFileSync(join(D7_DEVELOPMENT_DIRECTORY,name),content(value),{flag:'wx'});return {status:'PASS',directory:D7_DEVELOPMENT_DIRECTORY,requests:24,modelCalls:0}}
export async function verifyPackage(){const manifest=JSON.parse(readFileSync(join(D7_DEVELOPMENT_DIRECTORY,'MANIFEST.json'),'utf8')),expected=await buildPackage(manifest.generatedAt);for(const [name,value] of Object.entries(expected))check(readFileSync(join(D7_DEVELOPMENT_DIRECTORY,name),'utf8')===content(value),'DRIFT_'+name);return {status:'PASS',sources:12,references:12,requests:24,modelCalls:0,dispatchAuthorized:false,manifestSha256:hash(readFileSync(join(D7_DEVELOPMENT_DIRECTORY,'MANIFEST.json')))}}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){if(process.argv[2]==='--write')console.log(JSON.stringify(await writePackage()));else if(process.argv[2]==='--verify')console.log(JSON.stringify(await verifyPackage()));else throw Error('CANDIDATE14_D7_DEVELOPMENT_ARGUMENT')}
