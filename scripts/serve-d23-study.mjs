import {build} from 'esbuild'
import {createServer} from 'node:http'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,basename} from 'node:path'
import {pathToFileURL} from 'node:url'
import {execFileSync} from 'node:child_process'
import {digest} from './candidate16-d13-records.mjs'
import {d13Components} from './candidate16-d13-support.mjs'
import {d8Handler} from './serve-candidate15-d8.mjs'

const json=p=>JSON.parse(readFileSync(p,'utf8'))
export async function d23Materials(){
  const root='docs/recognition-optimization/candidate17/d16-development',units=json(root+'/PREPARED_REQUEST_IDENTITIES.json').requests,sources=json(root+'/SOURCES.json').sources
  const witnesses=json('docs/recognition-optimization/candidate17/d17-development/SCORING_RESULTS.json').cases
  const {indexImmutableScopesV11}=await d13Components(),records=[],materials=[]
  // Coverage decided from source tags, without reading scores or participant outcomes.
  for(const number of [1,2,4,5,6,7,9,11]){
    const source=sources.find(s=>s.sourceId.endsWith('S'+String(number).padStart(2,'0'))),unit=units.find(u=>u.sourceId===source?.sourceId&&u.candidate==='Candidate17')
    if(!source||!unit)throw Error('D23_RECORD_MAPPING_MISSING')
    const rawBytes=readFileSync('.data/candidate17/d17-execution/raw/'+String(unit.ordinal).padStart(2,'0')+'.json'),raw=JSON.parse(rawBytes),witness=witnesses.find(row=>row.ordinal===unit.ordinal)
    if(!witness||witness.rawFileSha256!==digest(rawBytes)||witness.responseSha256!==raw.responseSha256||raw.unitIdentitySha256!==unit.unitIdentitySha256||raw.ordinal!==unit.ordinal||raw.requestSha256!==unit.requestSha256||digest(raw.rawHttpText)!==raw.responseSha256||digest(source.sourceText)!==source.sourceSha256)throw Error('D23_FROZEN_RAW_SOURCE_DRIFT')
    const id='d21-record-'+String(unit.ordinal).padStart(2,'0'),context={index:await indexImmutableScopesV11(source.sourceId,source.sourceVersionId,source.sourceText),referenceTime:source.referenceTime,timezone:source.timezone}
    const assisted={id,label:'固定录制 · '+source.sourceId,kind:'RECORDED_MODEL',candidateVersion:'real-input-source-semantics-17',context,rawHttpText:raw.rawHttpText,responseSha256:raw.responseSha256,requestSha256:unit.requestSha256}
    const manualId='d13-fixture-manual-d23-s'+String(number).padStart(2,'0'),envelope=JSON.parse(raw.rawHttpText),wire=JSON.parse(envelope.output.at(-1).content[0].text)
    for(const field of ['tasks','materials','timePoints','events','revisions','conflicts'])wire[field]=[]
    wire.informationScopeIds=context.index.scopes.map(s=>s.id);wire.unresolvedScopeIds=[]
    envelope.output.at(-1).content[0].text=JSON.stringify(wire)
    // Parser-compatible empty envelope only. This is explicitly an ENGINEERING_FIXTURE,
    // not a provider response or observed zero usage; manual has no first-model outcome.
    envelope.id=manualId;envelope.usage={input_tokens:0,output_tokens:0}
    const manualRaw=JSON.stringify(envelope),manual={...assisted,id:manualId,label:'空白手动 · '+source.sourceId,kind:'ENGINEERING_FIXTURE',rawHttpText:manualRaw,responseSha256:digest(manualRaw),requestSha256:digest('D23_MANUAL_NO_MODEL:'+manualId)}
    records.push(assisted,manual);materials.push({id:source.sourceId,sourceText:source.sourceText,sourceSha256:source.sourceSha256,assistedId:id,manualId,stimulusSha256:raw.responseSha256,kind:'RECORDED_MODEL',coverage:source.coverageTags,ordinal:unit.ordinal})
  }
  const layouts=[[[0,'assisted'],[4,'manual'],[2,'manual'],[6,'assisted']],[[0,'manual'],[4,'assisted'],[2,'assisted'],[6,'manual']],[[1,'manual'],[5,'assisted'],[3,'assisted'],[7,'manual']],[[1,'assisted'],[5,'manual'],[3,'manual'],[7,'assisted']]]
  const slots=layouts.flatMap((rows,index)=>rows.map(([n,condition],i)=>({slotId:`p${index+1}-${i+1}`,participantId:'p'+(index+1),ordinal:i+1,materialId:materials[n].id,condition})))
  const body={version:'d23-material-plan-1',materials,slots,measurement:{version:'d23-semantic-measurement-1',idleLimitMs:5000,maxFields:2,maxEditMs:30000,completionWindowMs:600000}},plan={...body,sha256:digest(JSON.stringify(body))}
  return {plan,records}
}
export async function buildD23Preview(port='6721',instance='run01',authority=null,reportVersion=null){
  if(reportVersion!==null&&reportVersion!=='d24-planned-coverage-1')throw Error('D24_REPORT_VERSION_INVALID')
  if(!/^\d{4,5}$/.test(port)||Number(port)<6720||Number(port)>65535||!/^[a-z0-9]{2,20}$/.test(instance))throw Error('D23_NEW_PORT_IDENTITY_REQUIRED')
  const {plan,records}=await d23Materials(),role=authority?'HUMAN_EXPLORATORY':'ENGINEERING_REPLAY'
  if(authority&&(authority.planSha256!==plan.sha256||authority.scope!=='4_PEOPLE_16_TRIALS_LOCAL_RECORDED'||!authority.authorizedByHuman?.trim()||!authority.ownerRef?.trim()||!authority.scopeRef?.trim()))throw Error('D23_SCOPE_AUTHORITY_INVALID')
  const directory=resolve('.data/d23/'+instance),origin='http://127.0.0.1:'+port;mkdirSync(resolve(directory,'records'),{recursive:true})
  const choices=records.map(row=>{const bytes=JSON.stringify(row);writeFileSync(resolve(directory,'records',row.id+'.json'),bytes);return {id:row.id,label:row.label,kind:row.kind,sha256:digest(bytes)}})
  const gitHead=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceFiles=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','src','scripts'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>/\.(tsx?|m?js|css)$/.test(p)).sort(),sourceSha256=digest(sourceFiles.map(p=>p+':'+digest(readFileSync(p))).join('\n'))
  const databases=Object.fromEntries([1,2,3,4].map(n=>['p'+n,`rco-mainline-01-02-i1-real-input-d23-study-${authority?'human':'engineering'}-${instance}-p${n}`]))
  const config={origin,databases,records:choices,plan,role,authority,reportVersion,buildIdentity:gitHead.slice(0,12)+' / source '+sourceSha256.slice(0,12)}
  const output=await build({absWorkingDir:process.cwd(),entryPoints:['src/experiments/candidate16/d23-browser.tsx'],bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',target:'es2022',outdir:'memory',minify:true,define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}',__D23_CONFIG__:JSON.stringify(config)}})
  for(const file of output.outputFiles)writeFileSync(resolve(directory,basename(file.path)),file.text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,''))
  writeFileSync(resolve(directory,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+ (reportVersion?'D24':'D23') +' 来源核对与试次 / '+role+'</title><link rel="stylesheet" href="/d23-browser.css"></head><body><div id="root">正在打开隔离核对…</div><script type="module" src="/d23-browser.js"></script></body></html>')
  const paths=['index.html','d23-browser.js','d23-browser.css',...choices.map(r=>'records/'+r.id+'.json')]
  const manifest={version:'d23-local-study-1',gitHead,sourceSha256,origin,directory,databases,role,reportVersion,plan,records:choices,modelCallsEnabled:false,humanTrial:role==='HUMAN_EXPLORATORY',assets:paths.map(path=>({path,sha256:digest(readFileSync(resolve(directory,path)))}))}
  writeFileSync(resolve(directory,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  // Human authority may only be supplied after a separate explicit human scope authorization.
  const authority=process.argv[4]?json(resolve(process.argv[4])):null,manifest=await buildD23Preview(process.argv[2],process.argv[3],authority),handler=d8Handler(manifest),server=createServer((req,res)=>{if(req.url==='/?owner=1')req.url='/';handler(req,res)})
  server.once('error',e=>{console.error(e.code==='EADDRINUSE'?'D23_PORT_BUSY_NO_PROCESS_KILLED':e.message);process.exitCode=1})
  server.listen(Number(new URL(manifest.origin).port),'127.0.0.1',()=>console.log(JSON.stringify({origin:manifest.origin,databases:manifest.databases,build:manifest.sourceSha256,role:manifest.role,modelCalls:0,humanAuthorized:manifest.humanTrial})))
}
