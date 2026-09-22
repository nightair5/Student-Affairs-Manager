import {createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {join,resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'

export const D7_DIAGNOSTIC_VERSION='candidate14-d7-offline-diagnostic-1.1.0'
const D6='docs/recognition-optimization/candidate13/d6-development-20260922a'
const D5='docs/recognition-optimization/candidate13/d5-development'
const OUTPUT='docs/recognition-optimization/candidate14/d7-diagnostics'
const hash=value=>createHash('sha256').update(value).digest('hex')
const check=(value,code)=>{if(!value)throw Error('CANDIDATE14_D7_OFFLINE_'+code)}
const read=path=>JSON.parse(readFileSync(path,'utf8'))
async function adapter(){
  const output=await build({stdin:{contents:`export {adaptModelWire,WIRE_VERSION} from './src/experiments/realInput01/modelWire.ts';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].contents).toString('base64'))
}
const sourceRoot={
  S01:'SCORER_ERROR',S02:'SCORER_ERROR',S03:'SCORER_ERROR',S04:'MODEL_ERROR',S05:'ADAPTER_ERROR',S06:'UNRESOLVED_SEMANTIC_AMBIGUITY',S07:'UNRESOLVED_SEMANTIC_AMBIGUITY',S08:'UNRESOLVED_SEMANTIC_AMBIGUITY',S09:'PRODUCT_DISPOSITION_ERROR',S10:'CONTRACT_UNREACHABLE',S11:'REFERENCE_ERROR',S12:'MODEL_ERROR',
}
const armOverride={'S04-A':'SCORER_ERROR','S08-A':'UNRESOLVED_SEMANTIC_AMBIGUITY','S10-B':'CONTRACT_UNREACHABLE','S11-B':'REFERENCE_ERROR','S12-A':'SCORER_ERROR','S12-B':'SCORER_ERROR'}
const explanations={SCORER_ERROR:'旧v4.1字段投影或窄等义规则造成错误计分，保留历史分数但不再解释为纯模型错误。',MODEL_ERROR:'公共适配后仍存在任务遗漏或完成标准损失。',REFERENCE_ERROR:'参照存在错对象、虚构完成标准或不当规范化。',CONTRACT_UNREACHABLE:'旧参照要求当前wire枚举无法合法输出的状态。',ADAPTER_ERROR:'模型raw保留不确定时间，但旧本机时间适配把它确定化。',UNRESOLVED_SEMANTIC_AMBIGUITY:'依赖、条件或时间类型口径未预先冻结，不能事后偏向任一候选。',PRODUCT_DISPOSITION_ERROR:'识别结果可成立，但产品确认流程阻断正确无任务归档。'}

export async function analyzeCandidate14D7Offline(){
  const binding=read(join(D6,'BINDING.json')),prepared=read(join(D5,'PREPARED_REQUEST_IDENTITIES.json')),api=await adapter(),packetById=new Map(prepared.requests.map(row=>[row.unitId,row]))
  check(binding.targets.length===24&&prepared.requests.length===24,'UNIT_COUNT')
  const units=[]
  for(const [index,target] of binding.targets.entries()){
    check(target.ordinal===index+1,'ORDINAL')
    const packet=packetById.get(target.unitId);check(packet&&packet.requestSha256===target.requestSha256,'REQUEST_BINDING')
    check(hash(JSON.stringify(packet.request))===target.requestSha256,'REQUEST_HASH')
    const rawLines=readFileSync(join(D6,'raw',target.unitId+'.jsonl'),'utf8').trimEnd().split('\n').map(JSON.parse);check(rawLines.length===1,'RAW_COUNT')
    const raw=rawLines[0],result=read(join(D6,'results',target.unitId+'.json'));check(hash(raw.rawHttpText)===raw.responseSha256&&result.responseSha256===raw.responseSha256,'RESPONSE_HASH')
    const envelope=JSON.parse(raw.rawHttpText),wire=JSON.parse(envelope.output[0].content[0].text),adapted=api.adaptModelWire(wire,packet.prepared.context).adapted
    check(JSON.stringify(adapted)===JSON.stringify(result.assembled),'READAPT_MISMATCH')
    check(envelope.usage.input_tokens===result.usage.input_tokens&&envelope.usage.output_tokens===result.usage.output_tokens,'USAGE_MISMATCH')
    const short=target.sourceId.slice(-3),key=`${short}-${target.arm}`,category=armOverride[key]??sourceRoot[short]
    units.push({unitId:target.unitId,ordinal:target.ordinal,sourceId:target.sourceId,arm:target.arm,transport:'COMPLETED_HTTP_200',rawSha256:raw.responseSha256,requestSha256:target.requestSha256,adapterRoundTrip:'PASS',usageVerified:true,preassignedPostHocHypothesis:category,hypothesisBasis:'D7_PREASSIGNED_SOURCE_ARM_MAP_NOT_DETERMINISTIC_RESCORING',explanation:explanations[category],historicalScoreChanged:false})
  }
  return {version:D7_DIAGNOSTIC_VERSION,status:'PASS',mode:'PURE_OFFLINE_NO_DISPATCH',modelCalls:0,networkCalls:0,ledgerReads:0,ledgerWrites:0,budgetOperations:0,units,hypothesisCounts:Object.fromEntries([...new Set(units.map(u=>u.preassignedPostHocHypothesis))].sort().map(key=>[key,units.filter(u=>u.preassignedPostHocHypothesis===key).length])),historicalDecision:'REJECT_CANDIDATE13_DEVELOPMENT',historicalDecisionPreserved:true,revisedAccuracy:null,claim:'EVIDENCE_CHAIN_VERIFIED_PREASSIGNED_HYPOTHESES_NOT_CAUSAL_ADJUDICATION'}
}
function correctionLog(result){return {version:'candidate14-d7-corrections-1',appendOnly:true,entries:[
  {id:'D7-CORR-001',kind:'REFERENCE_ERROR',scope:'D5R1-S11',statement:'旧参照把“登记现场展示场地”缩成“展示时段”，且虚构取消/历史端点完成标准。',historicalArtifactsModified:false},
  {id:'D7-CORR-002',kind:'CONTRACT_UNREACHABLE',scope:'D5 references',statement:'旧参照使用historical/cancelled等当前wire不可达组合。',historicalArtifactsModified:false},
  {id:'D7-CORR-003',kind:'SCORER_ERROR',scope:'v4.1',statement:'task_deadline未完整映射，字段窄等义未预注册，一项任务未对齐时发生多字段级联。',historicalArtifactsModified:false},
  {id:'D7-CORR-004',kind:'ADAPTER_ERROR',scope:'D5R1-S05',statement:'raw保留“暂定…下午”，旧时间适配却生成确定全天且无需确认。',historicalArtifactsModified:false},
  {id:'D7-CORR-005',kind:'OVERATTRIBUTION',scope:'D5R1-S11',statement:'Candidate13实际保留四个端点和两条方向正确的替代关系，不再称其合并端点。',historicalArtifactsModified:false},
  {id:'D7-CORR-006',kind:'PRODUCT_DISPOSITION_ERROR',scope:'D5R1-S09',statement:'正确无任务结果含事件/时间，但旧确认流程无法完成归档。',historicalArtifactsModified:false},
],historicalDecision:result.historicalDecision,revisedAccuracy:null}
}
export async function writeCandidate14D7Diagnostics(){
  const result=await analyzeCandidate14D7Offline(), corrections=correctionLog(result);mkdirSync(OUTPUT,{recursive:true})
  const json=(name,value)=>writeFileSync(join(OUTPUT,name),JSON.stringify(value,null,2)+'\n')
  json('OFFLINE_ANALYZER_RESULT.json',result);json('ROOT_CAUSE_TRACE.json',{version:'candidate14-d7-root-cause-trace-1',units:result.units});json('CORRECTIONS_LOG.json',corrections)
  writeFileSync(join(OUTPUT,'CORRECTIONS_LOG.md'),['# D7追加式订正日志','','D6历史结论仍为`REJECT_CANDIDATE13_DEVELOPMENT`；本日志不改旧raw、Expected、评分、锁文件或结论。没有计算“订正后正确率”。','',...corrections.entries.map(e=>`- **${e.id} / ${e.kind} / ${e.scope}**：${e.statement}`),''].join('\n'))
  return {status:'PASS',units:24,output:OUTPUT}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const command=process.argv[2];if(command==='--write')console.log(JSON.stringify(await writeCandidate14D7Diagnostics()));else if(command==='--verify')console.log(JSON.stringify(await analyzeCandidate14D7Offline()));else throw Error('CANDIDATE14_D7_OFFLINE_ARGUMENT')
}
