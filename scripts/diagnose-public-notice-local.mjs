// Read-only old recordings and engineering fixtures; no transport or ledger writes.
import {readFileSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {build} from 'esbuild'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {publicNoticeComponents} from './public-notice-components.mjs'
const root='docs/recognition-optimization/candidate19-public-development',x=await publicNoticeComponents()
const oldCode=execFileSync('git',['show','0bcc3b8b9263e8fadf2d9fd8453e5ce74ec774c9:src/recognition/materialChannelGrounding.ts'],{encoding:'utf8'})
const compiled=await build({stdin:{contents:oldCode,resolveDir:resolve('src/recognition'),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'})
const old=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'))
const f=await x.createPublicNoticeFixture('PUB-C19-02'),d=x.decodeCurrentSourceRecording(f.rawHttpText,'EngineeringFixture',f.context)
const before=old.groundMaterialChannels(d.result,f.sourceText),after=x.groundMaterialChannels(d.result,f.sourceText)
const current=JSON.parse(readFileSync('.data/candidate19/channel-followup-v1/REPORT.json'))
const prior=JSON.parse(readFileSync('docs/recognition-optimization/candidate19-development/paid-evidence/eligibility-followup/ALL_12_DIAGNOSTIC.json'))
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const equality=current.cases.map(c=>{const p=prior.cases.find(p=>p.ordinal===c.ordinal);return {ordinal:c.ordinal,sourceId:c.sourceId,candidate:c.candidate,responseSha256:c.responseSha256,firstSuggestionEqual:digest(c.firstSuggestion)===p.firstSuggestionSha256,diagnosticEqual:JSON.stringify(c.modelFactsDiagnosticUnchanged)===JSON.stringify(p.modelFactsDiagnosticUnchanged)}})
if(equality.some(c=>!c.firstSuggestionEqual||!c.diagnosticEqual))throw Error('OLD_12_DISPLAY_OR_DIAGNOSTIC_CHANGED')
writeFileSync(root+'/OLD_12_DIAGNOSTIC.json',JSON.stringify({...current,equality},null,2)+'\n')
writeFileSync(root+'/ROOT_CAUSE.json',JSON.stringify({role:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT',sourceId:f.context.index.sourceId,sourceText:f.sourceText,wire:JSON.parse(JSON.parse(f.rawHttpText).output[0].content[0].text),layer:'PUBLIC_CONVERSION',root:'Single-object destination matcher discarded earlier members of an explicit, closed, same-owner material list',beforeVersion:old.MATERIAL_CHANNEL_GROUNDING_VERSION,before:before.audit,after:after.audit,inferredFacts:0,unchanged:{condition:d.originalAdapted.tasks[0].condition,deadline:d.result.timePoints,formatAndNaming:d.result.materials.map(m=>({name:m.name,format:m.formatRequirements,naming:m.namingRequirements}))},old12Equality:equality,newModelCalls:0},null,2)+'\n')
const oldSources=['docs/recognition-optimization/candidate19-development/SOURCES.json','docs/recognition-optimization/d25-accuracy/SOURCES.json','docs/recognition-optimization/candidate17/d16-development/SOURCES.json'].flatMap(path=>JSON.parse(readFileSync(path)).sources.map(s=>({path,id:s.sourceId??s.id,text:s.sourceText??s.text??s.content})))
if(oldSources.some(s=>typeof s.text!=='string'))throw Error('OVERLAP_INPUT_SHAPE')
const normalize=s=>s.replace(/[\s\p{P}\p{N}]/gu,'')
const grams=s=>new Set(Array.from({length:Math.max(0,s.length-4)},(_,i)=>s.slice(i,i+5)))
const similarity=(a,b)=>{const aa=grams(normalize(a)),bb=grams(normalize(b)),n=[...aa].filter(g=>bb.has(g)).length;return n/(aa.size+bb.size-n||1)}
const teachingContext={index:await x.indexImmutableScopesV11('overlap-check','overlap-check-v1','仅用于检查生成说明'),referenceTime:'2026-10-04T09:00:00+08:00',timezone:'Asia/Shanghai'}
const teaching=JSON.stringify((await x.buildCandidate19Request(teachingContext)).body)
const overlap=x.PUBLIC_NOTICE_SOURCES.map(s=>({sourceId:s.id,exactOldSource:oldSources.some(o=>normalize(o.text)===normalize(s.text)),maximumOldFiveCharacterJaccard:Math.max(...oldSources.map(o=>similarity(s.text,o.text))),teachingPromptFiveCharacterJaccard:similarity(s.text,teaching),sourcesCompared:oldSources.length,limits:'Lexical overlap check only; selection and provisional authoring are Development, never independent Holdout'}))
writeFileSync(root+'/OVERLAP_CHECK.json',JSON.stringify({method:'case-sensitive punctuation/digit/space removed, character 5-gram Jaccard; actual current generation request/schema/instructions with sentinel source, not the selected notices',cases:overlap},null,2)+'\n')
console.log(JSON.stringify({before:before.audit.decisions.map(d=>d.status),after:after.audit.decisions.map(d=>d.status),old12Unchanged:equality.length,overlap}))
