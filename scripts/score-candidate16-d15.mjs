import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {frozenRequests,sha,FROZEN} from './candidate16-d14-executor.mjs'
import {validateChain} from './candidate13-d6-budget.mjs'
import {d13Components} from './candidate16-d13-support.mjs'
import {referencesValid} from './score-candidate15-d11.mjs'
import {scoreSemanticV7,SCORER_V7} from './recognition-semantic-v7.mjs'
import {selectD13Development} from './prepare-candidate16-d13.mjs'

const ROOT=resolve('.data/candidate16/d14-execution')
const OUT=resolve('docs/recognition-optimization/candidate16/d15-integrated')
const LEDGER=resolve('C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl')
const D13='docs/recognition-optimization/candidate16/d13-development'
const check=(value,code)=>{if(!value)throw Error('D15_SCORE_'+code)}
const read=path=>JSON.parse(readFileSync(path,'utf8'))
const encode=value=>JSON.stringify(value,null,2)+'\n'
const amount=rows=>rows.reduce((total,row)=>total+row,0)

export async function scoreD15(){
  const units=frozenRequests(),state=read(join(ROOT,'STATE.json')),auth=read(join(ROOT,'AUTHORIZATION.json'))
  check(state.authorized===true&&state.grantId===auth.grantId&&state.units.length===24&&state.units.every(row=>row.status==='SETTLED'),'INCOMPLETE_OR_UNCERTAIN')
  check(auth.manifestSha256===FROZEN.manifest&&auth.identitiesSha256===FROZEN.identities&&auth.count===24&&auth.hardLimitMicroUsd===7800000,'AUTH_DRIFT')
  const ledgerBytes=readFileSync(LEDGER),chain=validateChain(ledgerBytes),later=chain.rows.slice(auth.ledgerBaselineRows)
  check(sha(ledgerBytes.subarray(0,auth.ledgerBaselineBytes))===auth.ledgerBaselineSha256&&later.length===49&&later[0].event.kind==='candidate16D14Grant'&&later[0].event.grantId===auth.grantId,'LEDGER_DRIFT')
  const sources=read(join(D13,'SOURCES.json')).sources,references=read(join(D13,'REFERENCES.json')).references,x=await d13Components(),cases=[]
  for(const unit of units){
    const row=state.units[unit.ordinal-1],source=sources.find(s=>s.sourceId===unit.sourceId),reference=references.find(r=>r.sourceId===unit.sourceId)
    const path=join(ROOT,'raw',String(unit.ordinal).padStart(2,'0')+'.json'),rawBytes=readFileSync(path),raw=JSON.parse(rawBytes)
    check(source&&reference&&row.ordinal===unit.ordinal&&row.unitIdentitySha256===unit.unitIdentitySha256&&row.requestSha256===unit.requestSha256&&raw.ordinal===unit.ordinal&&raw.unitIdentitySha256===unit.unitIdentitySha256&&raw.requestSha256===unit.requestSha256&&raw.responseSha256===row.responseSha256&&sha(raw.rawHttpText)===raw.responseSha256,'UNIT_RAW_IDENTITY')
    const reserve=later.find(l=>l.event.kind==='candidate16D14Reserve'&&l.event.ordinal===unit.ordinal),settle=later.find(l=>l.event.kind==='candidate16D14Settle'&&l.event.ordinal===unit.ordinal)
    check(reserve?.event.grantId===auth.grantId&&settle?.event.grantId===auth.grantId&&settle.event.responseSha256===raw.responseSha256&&settle.event.costUpperMicroUsd===row.costUpperMicroUsd,'UNIT_LEDGER_IDENTITY')
    let transport='HTTP_'+raw.httpStatus,modelStatus='NOT_PARSED',parseValid=false,schemaValid=false,referenceValid=false,adapted=null,firstOutput=null,error=null
    if(raw.httpStatus===200)try{
      const envelope=JSON.parse(raw.rawHttpText);modelStatus=envelope.status??'MISSING'
      check(modelStatus==='completed','MODEL_STATUS')
      const output=envelope.output?.at(-1)?.content?.[0]?.text;check(typeof output==='string','OUTPUT_TEXT')
      firstOutput=JSON.parse(output);parseValid=true
      const context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
      adapted=x.adaptCandidate14CommonWire(firstOutput,context).adapted;schemaValid=true;referenceValid=referencesValid(adapted,context.index)
    }catch(cause){error=String(cause?.message??cause).slice(0,180)}
    const score=scoreSemanticV7(reference,adapted,{schemaValid,referenceValid})
    cases.push({ordinal:unit.ordinal,sourceId:unit.sourceId,arm:unit.arm,candidate:unit.candidate,requestSha256:unit.requestSha256,responseSha256:raw.responseSha256,rawFileSha256:sha(rawBytes),transport,modelStatus,parseValid,schemaValid,referenceValid,parseOrAdapterError:error,score,usage:row.usage,costUpperMicroUsd:row.costUpperMicroUsd,determinate:true,firstOutputSummary:firstOutput?{tasks:firstOutput.tasks?.length??null,materials:firstOutput.materials?.length??null,timePoints:firstOutput.timePoints?.length??null,events:firstOutput.events?.length??null,revisions:firstOutput.revisions?.length??null}:null})
  }
  const byArm=arm=>cases.filter(row=>row.arm===arm),arms={}
  for(const [arm,name] of [['A','Candidate03'],['B','Candidate16']]){
    const rows=byArm(arm)
    arms[name]={denominator:12,transportFailed:rows.filter(r=>r.transport!=='HTTP_200').length,parseFailed:rows.filter(r=>!r.parseValid).length,schemaFailed:rows.filter(r=>!r.schemaValid).length,referenceFailed:rows.filter(r=>!r.referenceValid).length,scored:rows.filter(r=>r.score.status==='SCORED').length,unscored:rows.filter(r=>r.score.status!=='SCORED').length,wholeCorrect:rows.filter(r=>r.score.complete).length,taskPresence:Object.fromEntries(['tp','fp','fn'].map(k=>[k,amount(rows.map(r=>r.score.taskPresence?.[k]??0))])),currentTaskRisk:Object.fromEntries(['fn','unsupportedActionable'].map(k=>[k,amount(rows.map(r=>r.score.currentTaskRisk?.[k]??0))])),severity:Object.fromEntries(['severe','major','forbidden','keyMajor'].map(k=>[k,amount(rows.map(r=>r.score.severity?.[k]??0))]))}
  }
  const pairwise=sources.map(source=>{const a=cases.find(c=>c.sourceId===source.sourceId&&c.arm==='A'),b=cases.find(c=>c.sourceId===source.sourceId&&c.arm==='B')
    return {sourceId:source.sourceId,candidate03Complete:a.score.complete,candidate16Complete:b.score.complete,wholeOutcome:a.score.status!=='SCORED'||b.score.status!=='SCORED'?'incomparable':a.score.complete===b.score.complete?'tie':b.score.complete?'Candidate16_win':'Candidate03_win',candidate03:{status:a.score.status,taskPresence:a.score.taskPresence,currentTaskRisk:a.score.currentTaskRisk,severity:a.score.severity,fieldErrors:a.score.fieldErrors??[]},candidate16:{status:b.score.status,taskPresence:b.score.taskPresence,currentTaskRisk:b.score.currentTaskRisk,severity:b.score.severity,fieldErrors:b.score.fieldErrors??[]}}
  })
  const decision=selectD13Development(cases)
  const tokenUsage={inputTokens:amount(cases.map(c=>c.usage.input_tokens)),outputTokens:amount(cases.map(c=>c.usage.output_tokens)),cachedInputTokens:amount(cases.map(c=>c.usage.input_tokens_details?.cached_tokens??0))}
  const costUpperMicroUsd=amount(cases.map(c=>c.costUpperMicroUsd))
  return {version:'candidate16-d15-development-results-1',role:'FULLY_SEEN_SYNTHETIC_DEVELOPMENT_SINGLE_AUTHOR_PROVISIONAL',scorer:SCORER_V7,originalD11Decision:'REJECT_CANDIDATE15_DEVELOPMENT',originalDecisionChanged:false,model:'deepseek-flash',planned:24,sent:24,settled:24,uncertain:0,authorizedHead:auth.committedHead,grantId:auth.grantId,hardLimitMicroUsd:auth.hardLimitMicroUsd,preflightWorstMicroUsd:7785696,ledger:{rows:chain.rows.length,sha256:sha(ledgerBytes),batchRows:later.length},rawCount:cases.length,usage:tokenUsage,costUpperMicroUsd,providerActualUsd:'NOT_OBSERVABLE',humanReview:{titlesAndDescriptions:'NOT_ADJUDICATED',teachingExampleLeakage:'NOT_ADJUDICATED'},humanMetrics:{firstWholeSuggestionCorrect:'NOT_OBSERVABLE',correctDisposition:'NOT_OBSERVABLE',lowModificationCorrectDisposition:'NOT_OBSERVABLE',activeModificationTime:'NOT_OBSERVABLE'},arms,pairwise,decision,cases}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  check(['--write','--verify'].includes(process.argv[2]),'ARGUMENT')
  const result=await scoreD15(),path=join(OUT,'SCORING_RESULTS.json')
  if(process.argv[2]==='--write'){mkdirSync(OUT,{recursive:true});check(!existsSync(path),'RESULT_ALREADY_EXISTS');writeFileSync(path,encode(result),{flag:'wx'})}
  else check(encode(result)===readFileSync(path,'utf8'),'RESULT_DRIFT')
  console.log(JSON.stringify({sent:result.sent,settled:result.settled,decision:result.decision,arms:result.arms,usage:result.usage,costUpperMicroUsd:result.costUpperMicroUsd,ledger:result.ledger}))
}
