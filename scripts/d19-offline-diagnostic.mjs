import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {scoreD17} from './score-candidate17-d17.mjs'
import {d13Components} from './candidate16-d13-support.mjs'
import {scoreSemanticV8,SCORER_V8} from './recognition-semantic-v8.mjs'
import {comparePairV8,SELECTOR_V8} from './recognition-selector-v8.mjs'

const read=p=>JSON.parse(readFileSync(p,'utf8'))
const sha=b=>createHash('sha256').update(b).digest('hex')
export async function diagnoseD19(){
  const original=await scoreD17(),root='docs/recognition-optimization/candidate17/d16-development',sources=read(join(root,'SOURCES.json')).sources,references=read(join(root,'REFERENCES.json')).references,x=await d13Components(),cases=[]
  for(const old of original.cases){
    const rawPath=resolve('.data/candidate17/d17-execution/raw',String(old.ordinal).padStart(2,'0')+'.json'),rawBytes=readFileSync(rawPath),raw=JSON.parse(rawBytes)
    if(sha(rawBytes)!==old.rawFileSha256||sha(raw.rawHttpText)!==old.responseSha256)throw Error('D19_READONLY_RAW_DRIFT')
    const source=sources.find(row=>row.sourceId===old.sourceId),reference=references.find(row=>row.sourceId===old.sourceId)
    const first=JSON.parse(JSON.parse(raw.rawHttpText).output.at(-1).content[0].text)
    const context={index:await x.indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
    const adapted=x.adaptCandidate14CommonWire(first,context).adapted
    const diagnostic=scoreSemanticV8(reference,adapted,{schemaValid:old.schemaValid,referenceValid:old.referenceValid})
    cases.push({ordinal:old.ordinal,sourceId:old.sourceId,arm:old.arm,candidate:old.candidate,requestSha256:old.requestSha256,responseSha256:old.responseSha256,oldComplete:old.score.complete,oldSevere:old.score.severity?.severe??null,diagnostic:{status:diagnostic.status,completeStatus:diagnostic.completeStatus,relationFactsPass:diagnostic.relationFactsPass??null,risks:diagnostic.risks,disputes:diagnostic.disputes,taskPresence:diagnostic.taskPresence??null,matchedObligations:diagnostic.matchedObligations??[]}})
  }
  const pairs=sources.map(source=>{const a=cases.find(row=>row.sourceId===source.sourceId&&row.arm==='A'),b=cases.find(row=>row.sourceId===source.sourceId&&row.arm==='B');return {sourceId:source.sourceId,candidate03Ordinal:a.ordinal,candidate17Ordinal:b.ordinal,comparison:comparePairV8(a.diagnostic,b.diagnostic)}})
  const d15=read('docs/recognition-optimization/candidate15/d11-development-20260928a/SCORING_RESULTS.json')
  const d15Raw=d15.cases.map(row=>{const path=resolve('docs/recognition-optimization/candidate15/d11-development-20260928a/raw',String(row.ordinal).padStart(2,'0')+'.json'),raw=read(path);if(raw.responseSha256!==row.responseSha256||sha(raw.rawHttpText)!==row.responseSha256)throw Error('D19_D15_READONLY_RAW_DRIFT');return {ordinal:row.ordinal,sourceId:row.sourceId,arm:row.arm,responseSha256:row.responseSha256,oldStatus:row.score.status,oldComplete:row.score.complete,v8Status:'NOT_COMPARABLE_REFERENCE_V6'}})
  return {version:'d19-offline-diagnostic-1',role:'POSTHOC_PROVISIONAL_SEEN_SYNTHETIC',newModelCalls:0,oldDecisionUnchanged:true,oldD17:{decision:original.decision.status,candidate03Complete:original.arms.Candidate03.wholeCorrect,candidate17Complete:original.arms.Candidate17.wholeCorrect,denominator:24},scorer:SCORER_V8,selector:SELECTOR_V8,d17:{denominator:24,cases,pairs,determinateCompleteByArm:{A:cases.filter(row=>row.arm==='A'&&row.diagnostic.completeStatus===true).length,B:cases.filter(row=>row.arm==='B'&&row.diagnostic.completeStatus===true).length},unresolvedByArm:{A:cases.filter(row=>row.arm==='A'&&row.diagnostic.completeStatus==='UNKNOWN').length,B:cases.filter(row=>row.arm==='B'&&row.diagnostic.completeStatus==='UNKNOWN').length}},d15:{denominator:24,originalDecision:d15.decision,referenceVersion:'v6',v8Comparison:'NOT_COMPARABLE_REFERENCE_V6',reason:'D15 uses a different frozen reference and scorer; this package preserves all 24 outcomes and does not convert v6 labels into v8 scores',raw:d15Raw}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const output=await diagnoseD19(),mode=process.argv[2],path=resolve('docs/recognition-optimization/d19-source-session/OFFLINE_DIAGNOSTIC.json'),content=JSON.stringify(output,null,2)+'\n'
  if(mode==='--write'){mkdirSync(resolve('docs/recognition-optimization/d19-source-session'),{recursive:true});writeFileSync(path,content)}
  else if(mode==='--verify'){if(readFileSync(path,'utf8')!==content)throw Error('D19_DIAGNOSTIC_DRIFT')}
  else throw Error('D19_DIAGNOSTIC_ARGUMENT')
  console.log(JSON.stringify({d17:output.d17.determinateCompleteByArm,unresolved:output.d17.unresolvedByArm,d15Raw:output.d15.raw.length,pairs:output.d17.pairs.map(p=>p.comparison.status)}))
}
