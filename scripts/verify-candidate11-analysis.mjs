import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {build} from 'esbuild'
import {scoreCandidate11,aggregateCandidate11,SCORER_VERSION} from './score-candidate11-recognition.mjs'

export const HISTORY_DIRECTORY='docs/recognition-optimization/mainline-real-input-01/runs/opensource-methods-20260920a'
export const BASELINE_FILE='docs/recognition-optimization/candidate11/BRANCH_BASELINE.json'
export const sha256=value=>createHash('sha256').update(value).digest('hex')
const check=(condition,code)=>{if(!condition)throw Error('C11_HISTORY_'+code)}
const read=(root,path)=>JSON.parse(readFileSync(resolve(root,path),'utf8'))
export async function loadCandidate11Api(root=process.cwd()) {
  const bundled=await build({absWorkingDir:root,stdin:{contents:`
    export {adaptModelWire,parseModelEnvelope,FLASH41_MODEL_NAME,MODEL_JSON_SCHEMA} from './src/experiments/realInput01/modelWire.ts';
    export {composeSemantics} from './src/experiments/mainline04/semanticComposer.ts';
    export {buildCandidate03Request} from './src/experiments/realInput01/candidate03.ts';
    export {buildCandidate10ComparisonRequest} from './src/experiments/realInput01/candidate10.ts';
    `,resolveDir:root,loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',logLevel:'silent'})
  return import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'))
}
export function verifyProtectedFiles(root=process.cwd()) {
  const baseline=read(root,BASELINE_FILE)
  for(const file of baseline.protectedFiles)check(sha256(readFileSync(resolve(root,file.path)))===file.sha256,'PROTECTED_CHANGED:'+file.path)
  return {count:baseline.protectedFiles.length,ledgerSha:baseline.ledger.sha256}
}

const eq=value=>({equals:value}), set=value=>({setEquals:value})
const referenceTask=(id,actions,objects,fields={})=>({id,actions,objects,fields})
// Explicit post-hoc constraints; the historical reference never becomes a
// complete independent label just because more checks have been added here.
export function historicalReference(id) {
  const deliver=()=>referenceTask('deliver',['交','交到','提交'],['校史照片'])
  const key=value=>referenceTask('key',['领取'],['实验钥匙'],{'condition.value':eq(value),actionable:eq(value==='true')})
  const refs={
    OS01:[{...deliver(),fields:{materials:{requiredFragments:['防潮盒']}}}],
    OS02:[referenceTask('buy',['购买'],['防潮盒']),{...deliver(),fields:{dependencies:set(['购买:防潮盒'])}}],
    OS03:[referenceTask('write',['编写'],['设备说明'],{dependencies:set([])}),referenceTask('backup',['备份'],['维修记录','上一学期的维修记录'],{dependencies:set([])})],
    OS04:[referenceTask('verify',['核验'],['数据授权书'],{'semantics.status':eq('pending'),'detail.completionCriteria':{forbiddenFragments:['核验通过','审核通过','核验合格']}}),
      referenceTask('publish',['公开'],['调查摘要'],{'condition.value':eq('unknown'),actionable:eq(false)})],
    OS05:[key('unknown')],OS06:[{...key('true'),fields:{...key('true').fields,'semantics.status':eq('pending')}}],OS07:[key('false')],
    OS08:[referenceTask('save',['保存'],['借用凭证','已签收的借用凭证'],{timeRaw:set([])})],
    OS09:[referenceTask('return',['交回'],['借用凭证'],{timeRaw:{requiredFragments:['10月12日','十点']}})],
    OS10:[referenceTask('old',['邮寄'],['调查册','纸质调查册'],{'semantics.validity':{oneOf:['cancelled','superseded']},actionable:eq(false)}),
      referenceTask('new',['上传'],['调查册','电子调查册'],{actionable:eq(true)})],
    OS11:[],
    OS12:[referenceTask('video',['提交'],['录播视频'],{timeRaw:{requiredFragments:['10月9日']},materials:{requiredFragments:['授权证明']}}),
      referenceTask('abstract',['提交'],['文字摘要'],{timeRaw:{requiredFragments:['10月11日']},materials:{requiredFragments:['授权证明']}})],
  }
  check(id in refs,'SOURCE_UNKNOWN')
  return {coverage:'partial',tasks:refs[id],checks:id==='OS10'?[{name:'new-to-old-effective-revision',path:'historicalChecks.effectiveReplacement',rule:eq(true)}]
    :id==='OS08'?[{name:'negated-today-not-normalized',path:'historicalChecks.negatedToday',rule:eq(false)}]:[]}
}
export async function verifyCandidate11History(root=process.cwd()) {
  const protection=verifyProtectedFiles(root),baseline=read(root,BASELINE_FILE),binding=read(root,HISTORY_DIRECTORY+'/BINDING_FINAL.json')
  const ledger=readFileSync(resolve(root,baseline.ledger.path),'utf8').trimEnd().split('\n').map(JSON.parse)
  let previous='0'.repeat(64)
  ledger.forEach((row,index)=>{check(row.sequence===index&&row.previous===previous&&row.hash===sha256(JSON.stringify({sequence:row.sequence,previous:row.previous,event:row.event})),'LEDGER_CHAIN');previous=row.hash})
  const api=await loadCandidate11Api(root),rows=[],snapshots=[]
  check(binding.units.length===24&&binding.items.length===12,'ROSTER')
  for(const item of binding.items){
    const before03=await api.buildCandidate03Request(item.context),before10=await api.buildCandidate10ComparisonRequest(item.context,'contrastive')
    snapshots.push({sourceId:item.sourceId,candidate03RequestSha:sha256(before03.serialized),candidate10RequestSha:sha256(before10.serialized)})
    for(const arm of ['A','B']){
      const unitId=item.id+'-'+arm,unit=binding.units.find(u=>u.unitId===unitId),raw=read(root,HISTORY_DIRECTORY+'/'+unitId+'_RAW.jsonl')
      const prior=read(root,HISTORY_DIRECTORY+'/'+unitId+'_RESULT.json'),request=binding.requests[unitId]
      const requestText=typeof request==='string'?request:JSON.stringify(request)
      check(unit&&sha256(requestText)===unit.requestSha&&raw.requestSha===unit.requestSha&&raw.inputSha===unit.inputSha&&raw.candidateSha===unit.candidateSha,'REQUEST_IDENTITY')
      check(raw.unitId===unitId&&raw.responseSha===sha256(raw.rawHttpText)&&prior.responseSha===raw.responseSha,'RESPONSE_IDENTITY')
      const settlement=ledger.filter(row=>row.event.kind==='batchSettle'&&row.event.unitId===unitId)
      check(settlement.length===1&&settlement[0].event.requestSha===unit.requestSha&&settlement[0].event.responseSha===raw.responseSha,'SETTLEMENT')
      const envelope=JSON.parse(raw.rawHttpText)
      check(isDeepStrictEqual(settlement[0].event.usage,envelope.usage),'SETTLED_USAGE')
      let adapted=null,parseError=null
      try{
        adapted=api.parseModelEnvelope(raw.rawHttpText,item.context,api.FLASH41_MODEL_NAME).adaptedResponse
        check(isDeepStrictEqual(adapted,prior.assembled),'ADAPTER_DRIFT')
        await api.composeSemantics(adapted,{...item.context,authority:'live_model_candidate',profile:'real-input-01',ownershipMode:'mainline05-own-assets-1'})
      }catch(error){if(String(error.message).includes('ADAPTER_DRIFT'))throw error;parseError=error.message;adapted=null}
      const checked=adapted ? {...adapted,historicalChecks:{
        negatedToday:adapted.timePoints.some(t=>t.rawText.includes('今天')&&t.normalizedValue!==null),
        effectiveReplacement:adapted.revisions.some(r=>r.effective==='true'&&adapted.tasks.find(t=>t.id===r.fromDirectiveId)?.action.surface==='上传'
          &&adapted.tasks.find(t=>t.id===r.targetDirectiveId)?.action.surface==='邮寄'),
      }} : null
      rows.push({sourceId:item.sourceId,unitId,arm,requestSha:unit.requestSha,responseSha:raw.responseSha,parseError,
        score:scoreCandidate11(historicalReference(item.sourceId),checked)})
    }
  }
  check(isDeepStrictEqual(verifyProtectedFiles(root),protection),'PROTECTION_DRIFT')
  return {version:'candidate11-historical-rescore-2',scorerVersion:SCORER_VERSION,scorerSha:sha256(readFileSync(resolve(root,'scripts/score-candidate11-recognition.mjs'))),
    referenceProvenance:'Post-hoc single-agent diagnostic constraints; not independent human labels; all references partial.',
    bindingSha:sha256(readFileSync(resolve(root,HISTORY_DIRECTORY+'/BINDING_FINAL.json'))),protection,ledgerRows:ledger.length,newModelCalls:0,
    oldCandidateSnapshots:snapshots,rows,arms:Object.fromEntries(['A','B'].map(arm=>[arm,aggregateCandidate11(rows.filter(r=>r.arm===arm).map(r=>r.score))])),
    qualityConclusion:'NO_PROMOTION_REFERENCE_INCOMPLETE',userConversion:'NOT_OBSERVABLE'}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  if(process.argv.slice(2).some(arg=>!['--write','--verify'].includes(arg)))throw Error('C11_VERIFY_ARGUMENT')
  const report=await verifyCandidate11History(),text=JSON.stringify(report,null,2)+'\n'
  const target='docs/recognition-optimization/candidate11/historical-rescore/REPORT.json'
  if(process.argv.includes('--write')){mkdirSync(dirname(target),{recursive:true});if(existsSync(target))check(readFileSync(target,'utf8')===text,'EXISTING_REPORT_DRIFT');else writeFileSync(target,text,{flag:'wx'})}
  console.log(JSON.stringify({rows:report.rows.length,arms:report.arms,protection:report.protection,
    knownChecks:Object.fromEntries(['A','B'].map(a=>[a,report.rows.filter(r=>r.arm===a&&r.score.knownChecksPass).length])),
    failures:report.rows.filter(r=>r.parseError).map(r=>({unit:r.unitId,error:r.parseError})),reportSha:sha256(text)}))
}
