import {createHash} from 'node:crypto'
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import {d13Oracles,readJson} from './candidate16-d13-support.mjs'
import {makeD13References} from './candidate16-d13-reference.mjs'
import {scoreSemanticV7,SCORER_V7,validateReferenceV7} from './recognition-semantic-v7.mjs'

const ROOT='docs/recognition-optimization/candidate17/d16-development'
const encode=value=>JSON.stringify(value,null,2)+'\n'
const sha=value=>createHash('sha256').update(value).digest('hex')
const check=(v,code)=>{if(!v)throw Error('D16_'+code)}

// Each new notice uses a previous structural pattern only as provisional annotation scaffolding.
// Wording, actors' objects, formats and completion standards are newly authored before any new output.
const replacements=[
  [['研究伦理声明','社团器材盘点表'],['PDF/A格式','PDF格式'],['课题号-负责人','社团编号-经办人'],['归档','提交'],['系统显示提交完成','门户提示收件成功']],
  [['竞赛队伍信息','迎新志愿者分组'],['监护人知情书','场地使用承诺函'],['JPG','PNG'],['确认完成','核对完成'],['知情书已接收','承诺函已收妥'],['确认','核对']],
  [['入场申请','设备借用申请'],['实验室门禁卡','演播室通行证'],['领取册','签收单'],['领取','领用'],['获批准','获核准']],
  [['作品复评陈述','辩论决赛彩排'],['复评名单','决赛彩排名单'],['你的作品','你的队伍'],['复评','彩排'],['作品','辩论'],['参加','出席'],['进入','列入']],
  [['主持人安排','摄影岗位安排'],['担任主持人','担任摄影志愿者'],['主持提纲','机位安排表'],['提纲已收取','安排表已收取'],['提交','递交']],
  [['田野调查名册','校友访谈记录表'],['名册必填栏','记录表必填栏'],['收到名册','收妥记录表'],['XLSX','CSV'],['办公室','秘书处'],['补全','填写'],['报送','提交']],
  [['展览海报初稿','摄影作品说明稿'],['策展组','宣传组'],['交付','提交'],['确认收到初稿','确认收妥说明稿']],
  [['报销银行卡信息','培训证件信息'],['差旅报销声明','志愿服务签到证明'],['银行卡核验完成','证件核对完成'],['声明上传成功','证明提交成功'],['核验','核对'],['上传','提交'],['PDF','PNG']],
  [['图书馆检索服务','校车预约平台'],['原有预约记录','已保存行程'],['取消预约','删除行程'],['上传说明','提交说明'],['给管理员发邮件','向值班员发消息'],['维护安排','停机消息'],['维护','停机']],
  [['归还实验室备用钥匙','交回操场器材卡'],['签署旧版值班名册','填写旧版训练签到表'],['实验室备用钥匙','操场器材卡'],['旧版值班名册','旧版训练签到表'],['归还','交回'],['签署','填写']],
  [['打印会议海报','张贴迎新路线图'],['登记现场展示场地','登记线下宣讲教室'],['电子海报上传成功','数字路线图提交成功'],['线上展示时段','线上说明会时段'],['会议海报','迎新路线图'],['现场展示场地','线下宣讲教室'],['电子版','数字版'],['打印','张贴'],['上传','提交'],['预约','预订']],
  [['项目成员资料','活动志愿者名单'],['资料复核完成','名单校对完成'],['院长签字','辅导员盖章'],['联系项目办','致电秘书处'],['复核','校对']]
]
const marker=[['[D5匿名合成Development]','[D16新编匿名Development]']]
const rewrite=(s,pairs)=>pairs.reduce((v,[a,b])=>v.replaceAll(a,b),s)
const grams=s=>{const n=s.replace(/\[[^\]]+\]/g,'').replace(/\s+/g,'');return new Set([...Array(Math.max(0,n.length-3))].map((_,i)=>n.slice(i,i+4)))}
const overlap=(a,b)=>{const x=grams(a),y=grams(b),hits=[...x].filter(k=>y.has(k)).length;return hits/Math.max(1,Math.min(x.size,y.size))}
const priorPaths=[
  'docs/recognition-optimization/candidate13/d5-development/SOURCES.json',
  'docs/recognition-optimization/candidate15/d8-development/SOURCES.json',
  'docs/recognition-optimization/candidate16/d13-development/SOURCES.json',
  'docs/recognition-optimization/candidate11/b1-preparation/SOURCES.json',
  'docs/recognition-optimization/candidate12/d1-provisional-paired-preparation/PROVISIONAL_SOURCES.json',
  'src/experiments/realInput01/candidate03.ts',
  'src/experiments/realInput01/candidate16.ts',
  'src/experiments/mainline01/fixtures.ts'
]
const collectTexts=(value,out)=>{
  if(typeof value==='string'){if(value.length>=40)out.push(value);return}
  if(Array.isArray(value)){for(const row of value)collectTexts(row,out);return}
  if(value&&typeof value==='object')for(const row of Object.values(value))collectTexts(row,out)
}
const priorCorpus=()=>priorPaths.flatMap(path=>{if(!existsSync(path))return [];const content=readFileSync(path,'utf8'),texts=[];if(path.endsWith('.json'))collectTexts(JSON.parse(content),texts);else texts.push(content);return texts.map(text=>({path,text}))})
const mutate=(value,pairs,ids,sourceId,versionId)=>{
  if(Array.isArray(value))return value.map(v=>mutate(v,pairs,ids,sourceId,versionId))
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[ids.get(k)??k,mutate(v,pairs,ids,sourceId,versionId)]))
  if(typeof value==='string')return value===sourceId?versionId.split('-v1')[0]:ids.get(value)??rewrite(value,pairs)
  return value
}
async function loadComponents(){
  const output=await build({stdin:{contents:"export {indexImmutableScopesV11} from './src/recognition/scopeIndexV11.ts';export {adaptCandidate14CommonWire} from './src/experiments/candidate14/commonAdapter.ts';export {buildCandidate03Request} from './src/experiments/realInput01/candidate03.ts';export {buildCandidate17Request} from './src/experiments/realInput01/candidate17.ts';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64'))
}
export async function buildD16Package(){
  const old=await d13Oracles(),refs=makeD13References(),x=await loadComponents(),sources=[],references=[],oracles=[],roundtrip=[],similarity=[],corpus=priorCorpus()
  check(old.length===12&&refs.length===12&&replacements.length===12,'SOURCE_COUNT')
  for(let i=0;i<12;i++){
    const template=old[i],prior=template.source,priorRef=refs[i],pairs=[...marker,...replacements[i]],id='C17-D16-S'+String(i+1).padStart(2,'0'),versionId=id+'-v1'
    const sourceText=rewrite(prior.sourceText,pairs),index=await x.indexImmutableScopesV11(id,versionId,sourceText)
    check(template.context.index.scopes.length===index.scopes.length,'SCOPE_SHAPE_'+id)
    const ids=new Map(template.context.index.scopes.map((row,j)=>[row.id,index.scopes[j].id]))
    const wire=mutate(template.wire,pairs,ids,prior.sourceId,versionId),ref=mutate(priorRef,pairs,ids,prior.sourceId,versionId)
    const sourceSha256=sha(sourceText)
    const source={sourceId:id,sourceVersionId:versionId,sourceText,sourceSha256,referenceTime:prior.referenceTime,timezone:prior.timezone,coverageTags:prior.coverageTags,sourcePath:ROOT+'/SOURCES.json',seenDegree:'NEWLY_AUTHORED_PROVISIONAL_DEVELOPMENT_TEMPLATE_DERIVED',truthStatus:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL'}
    ref.sourceId=id;ref.sourceSha256=sourceSha256;ref.seenDegree=source.seenDegree;ref.author='Codex / template-derived provisional engineering adjudication'
    for(const representation of ref.representations){representation.sourceId=id;representation.scopeTextById=Object.fromEntries(index.scopes.map(row=>[row.id,row.text]))}
    validateReferenceV7(ref)
    const context={index,referenceTime:source.referenceTime,timezone:source.timezone},adapted=x.adaptCandidate14CommonWire(wire,context).adapted
    const positive=scoreSemanticV7(ref,adapted),negativeWire=structuredClone(wire)
    if(negativeWire.tasks.length){const t=negativeWire.tasks[0];t.semantics.status=t.semantics.status==='pending'?'cancelled':'pending'}
    else negativeWire.informationScopeIds=[]
    const negative=scoreSemanticV7(ref,x.adaptCandidate14CommonWire(negativeWire,context).adapted)
    check(positive.status==='SCORED'&&positive.complete&&!negative.complete,'ROUNDTRIP_'+id)
    const ranked=corpus.map(row=>({path:row.path,score:overlap(sourceText,row.text)})).sort((a,b)=>b.score-a.score)
    const maxOverlap=ranked[0]?.score??0
    check(sourceSha256!==prior.sourceSha256&&maxOverlap<0.68,'SIMILARITY_'+id+'_'+maxOverlap.toFixed(3))
    sources.push(source);references.push(ref);oracles.push({sourceId:id,wire});roundtrip.push({sourceId:id,positive:'PASS',negative:'DETECTED',negativeStatus:negative.status});similarity.push({sourceId:id,maxHistoricalFourGramOverlap:Number(maxOverlap.toFixed(3)),closestPath:ranked[0]?.path??null,exactOverlap:false,templateSourceId:prior.sourceId})
  }
  const sourceBytes=encode({sources}),referenceBytes=encode({references}),requestRows=[]
  for(let i=0;i<12;i++)for(const arm of (i%2===0?['A','B']:['B','A'])){
    const source=sources[i],context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
    const a=await x.buildCandidate03Request(context),b=await x.buildCandidate17Request(context),chosen=arm==='A'?a:b,body=structuredClone(chosen.body);body.model='deepseek-flash'
    const counterpart=structuredClone((arm==='A'?b:a).body);counterpart.model='deepseek-flash'
    body.input[0].content[0].text=counterpart.input[0].content[0].text
    check(JSON.stringify(body)===JSON.stringify(counterpart),'ARM_PARAMETER_DRIFT_'+source.sourceId)
    body.input[0].content[0].text=chosen.body.input[0].content[0].text
    const ordinal=requestRows.length+1,requestSha256=sha(JSON.stringify(body)),identity={batch:'D16-C03-C17-DEVELOPMENT-R1',ordinal,sourceId:source.sourceId,sourceSha256:source.sourceSha256,arm,candidate:arm==='A'?'Candidate03':'Candidate17',requestSha256,referenceSha256:sha(referenceBytes),model:'deepseek-flash',scorer:SCORER_V7}
    const unitIdentitySha256=sha(JSON.stringify(identity));requestRows.push({...identity,unitIdentitySha256,body,dispatchAuthorized:false,status:'NOT_RUN'})
  }
  check(requestRows.length===24&&new Set(requestRows.map(r=>r.unitIdentitySha256)).size===24,'IDENTITIES')
  const prepared={version:'candidate17-d16-identities-1',dispatchAuthorized:false,status:'NOT_RUN',requests:requestRows}
  const preRegistration={version:'candidate17-d16-selection-1',role:'SEEN_TEMPLATE_DERIVED_PROVISIONAL_DEVELOPMENT',baseline:'Candidate03',challenger:'Candidate17',units:24,sources:12,order:'6 AB / 6 BA',transport:'one attempt per frozen identity; zero retry, repair or verifier; failures remain in the denominator',dispatchAuthorized:false,selection:{developmentImprovement:'all 24 determinate, both arms schema and reference valid, Candidate17 no Severe or Forbidden, no per-source risk regression, and strictly more whole-correct sources than Candidate03',mixedProgress:'whole-correct gain with at least one risk regression, or improvements and regressions across sources',riskRegression:'new critical FN, unsupported action, wrong precise time/material/revision relation, Severe or Forbidden',insufficientEvidence:'incomplete or uncertain units, invalid scoring reference, or unresolved adjudication affecting comparison'},report:['whole-correct numerator/12 and paired wins/ties/losses','task FN and unsupported additions','time, material and revision errors','Schema/reference failures, Severe and Forbidden','not-scoreable and human disputes'],truthLimit:'No independent human truth or human efficacy claim; D15 decisions remain unchanged'}
  const artifacts={'SOURCES.json':{sources},'REFERENCES.json':{references},'LEGAL_WIRE_ORACLES.json':{role:'ENGINEERING_ORACLE_NOT_MODEL_OUTPUT',oracles},'ROUNDTRIP_RESULTS.json':{roundtrip},'SIMILARITY_CHECK.json':{similarity,method:'Unicode four-gram overlap against historical sources, prompt text and fixtures; reject >=0.68; structural templates remain seen provisional Development',scannedPaths:priorPaths},'PRE_REGISTRATION.json':preRegistration,'PREPARED_REQUEST_IDENTITIES.json':prepared}
  const files=Object.entries(artifacts).map(([name,value])=>({path:name,sha256:sha(encode(value))}))
  const componentPaths=['src/experiments/realInput01/candidate03.ts','src/experiments/realInput01/candidate17.ts','src/experiments/realInput01/modelWire.ts','src/experiments/candidate14/commonAdapter.ts','scripts/recognition-semantic-v7.mjs']
  const components=componentPaths.map(path=>({path,sha256:sha(readFileSync(path))}))
  const manifest={version:'candidate17-d16-development-1',role:'NEWLY_AUTHORED_TEMPLATE_DERIVED_PROVISIONAL_DEVELOPMENT_NOT_HOLDOUT',status:'ZERO_CALL_REVIEWABLE_FOR_NEW_AUTHORIZATION',dispatchAuthorized:false,modelCalls:0,requestCount:24,sourceCount:12,referenceCoverage:{complete:12,partial:0,unresolved:0},order:{AB:6,BA:6},model:'deepseek-flash',scorer:SCORER_V7,requestBodiesContainExpected:false,components,artifacts:files,preRegistration:'PRE_REGISTRATION.json',historyD15Decision:'NEEDS_TARGETED_FIXES_UNCHANGED'}
  return {...artifacts,'MANIFEST.json':manifest}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const mode=process.argv[2];check(['--write','--verify'].includes(mode),'MODE')
  const artifacts=await buildD16Package();mkdirSync(ROOT,{recursive:true})
  for(const [name,value] of Object.entries(artifacts)){const path=join(ROOT,name),bytes=encode(value);if(mode==='--write'){check(!existsSync(path),'FROZEN_FILE_EXISTS_'+name);writeFileSync(path,bytes,{flag:'wx'})}else check(readFileSync(path,'utf8')===bytes,'FROZEN_DRIFT_'+name)}
  console.log(JSON.stringify({sources:12,complete:12,requests:24,AB:6,BA:6,dispatchAuthorized:false,status:'NOT_RUN'}))
}
