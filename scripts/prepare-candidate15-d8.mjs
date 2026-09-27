import {createHash} from 'node:crypto'
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {CANDIDATE15_REFERENCE_VERSION,validateCandidate15Reference} from './candidate15-reference-contract.mjs'

const directory='docs/recognition-optimization/candidate15/d8-development'
const prior='docs/recognition-optimization/candidate13/d5-development/SOURCES.json'
const components=['src/experiments/realInput01/candidate03.ts','src/experiments/realInput01/candidate15.ts','src/experiments/realInput01/modelWire.ts','src/experiments/mainline04/semanticContract.ts','src/experiments/candidate14/commonAdapter.ts','src/experiments/candidate14/timePolicy.ts','scripts/candidate15-reference-contract.mjs','scripts/score-candidate15-contract.mjs']
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const json=value=>JSON.stringify(value,null,2)+'\n'
const canonicalText=value=>value.replace(/\r\n/g,'\n')
const file=path=>{const bytes=Buffer.from(canonicalText(readFileSync(path,'utf8')));return {path,sha256:sha(bytes),bytes:bytes.length,hashMode:'UTF8_LF_CANONICAL'}}
const check=(v,code)=>{if(!v)throw Error('D8_PREPARATION_'+code)}
export function prepareD8Package(){
  const data=JSON.parse(readFileSync(prior,'utf8'))
  check(data.sources?.length===12&&data.evaluationRole==='SYNTHETIC_DEVELOPMENT','SOURCE_COUNT')
  const sources=data.sources.map((row,i)=>{check(sha(row.sourceText)===row.sourceSha256,'SOURCE_SHA_'+i);return {sourceId:row.sourceId,sourceVersionId:row.sourceVersionId,sourceText:row.sourceText,sourceSha256:row.sourceSha256,referenceTime:row.referenceTime,timezone:row.timezone,coverageTags:row.coverageTags,sourcePath:prior,seenDegree:'FULLY_SEEN_D5_DEVELOPMENT',truthStatus:'PROVISIONAL_MODEL_AUTHORED'}})
  const referencePath=directory+'/REFERENCES.json',references=existsSync(referencePath)?JSON.parse(readFileSync(referencePath,'utf8')):null
  const valid=Array.isArray(references?.references)&&references.references.length===12&&references.references.every((row,i)=>{try{const ref=validateCandidate15Reference(row);return ref.completeness==='complete'&&ref.sourceId===sources[i].sourceId&&ref.referenceTime===sources[i].referenceTime&&ref.timezone===sources[i].timezone}catch{return false}})
  const roster=sources.map((source,index)=>({sourceId:source.sourceId,coverageTags:source.coverageTags,sourceSha256:source.sourceSha256,referenceStatus:valid?'COMPLETE_CONTRACT_VALID':'NOT_YET_V6_COMPLETE',plannedOrders:['AB','BA','BA','AB','BA','AB','AB','BA','AB','BA','BA','AB'][index]}))
  const manifest={version:'candidate15-d8-development-preparation-1.0.0',status:valid?'REFERENCE_CONTRACT_VALID_DISPATCH_STILL_UNAUTHORIZED':'WAITING_FOR_COMPLETE_REFERENCES',origin:'SYNTHETIC_SEEN_DEVELOPMENT',humanTruth:'NOT_INDEPENDENT',holdoutEligible:false,candidateArms:{A:'real-input-source-semantics-3',B:'real-input-source-semantics-15'},referenceVersion:CANDIDATE15_REFERENCE_VERSION,modelPlanned:'deepseek-flash',fixedParameters:{temperature:0,reasoning:{effort:'none'},stream:false,max_output_tokens:8192,timezone:'Asia/Shanghai',referenceTime:'FROM_SOURCE_ROSTER',schema:'CURRENT_MODEL_JSON_SCHEMA'},plannedSources:12,plannedUnits:24,balancedOrder:{AB:6,BA:6},actualRequestIdentities:[],dispatchAuthorized:false,runStatus:'NOT_RUN',modelCalls:0,grantCreated:false,ledgerWritten:false,failedUnitRule:'KEEP_IN_DENOMINATOR_NO_RETRY_NO_REPAIR_NO_VERIFIER',promotionGate:{determinateUnits:24,schemaAndReferenceValidPerArm:12,newSevere:0,newForbidden:0,teachingLeak:0,taskFNIncreaseMax:0,keyMajorIncreaseMax:0,completeCorrectNetGainMin:2},sourceFile:file(prior),referenceFile:file(referencePath),sources:roster,components:components.map(file),blockedOn:valid?['INDEPENDENT_PRE_DISPATCH_REVIEW','NEW_COST_AUTHORIZATION','REQUEST_IDENTITIES_NOT_GENERATED']:['12_VERSION_6_COMPLETE_REFERENCES','SCHEMA_ADAPTER_SCORER_ROUNDTRIP_PER_SOURCE','INDEPENDENT_PRE_DISPATCH_REVIEW','NEW_COST_AUTHORIZATION']}
  return {sources:{version:'candidate15-d8-seen-sources-1.0.0',status:'SEEN_SYNTHETIC_DEVELOPMENT',sources},manifest}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve('scripts/prepare-candidate15-d8.mjs')){
  const output=prepareD8Package();mkdirSync(directory,{recursive:true})
  for(const [name,value] of [['SOURCES.json',output.sources],['MANIFEST.json',output.manifest]]){
    const path=directory+'/'+name,text=json(value)
    if(process.argv.includes('--verify'))check(existsSync(path)&&canonicalText(readFileSync(path,'utf8'))===text,'DRIFT_'+name)
    else writeFileSync(path,text)
  }
  console.log(JSON.stringify({status:output.manifest.status,plannedUnits:24,actualRequestIdentities:0,dispatchAuthorized:false}))
}
