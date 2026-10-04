import {build} from 'esbuild'
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createServer} from 'node:http'
import {resolve,basename} from 'node:path'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {candidate19RecordedScene} from './candidate19-recorded-readonly.mjs'
import {candidate19Recordings} from './candidate19-recorded-data.mjs'
const [port,instance,fixtureMode]=process.argv.slice(2)
if(process.argv.length>5||fixtureMode&&!['--channel-role-fixtures','--channel-polarity-fixtures','--eligibility-fixtures'].includes(fixtureMode))throw Error('C19_UNKNOWN_REPLAY_MODE')
if(!/^\d{4,5}$/.test(port??'')||+port<6814||+port>65535||!/^[a-z0-9-]{2,32}$/.test(instance??''))throw Error('C19_NEW_LOOPBACK_INSTANCE_REQUIRED')
const {pack,scene}=await candidate19RecordedScene()
if(scene.audit!=='CONSISTENT'||!scene.state)throw Error('C19_REPLAY_UNRESOLVED_RECORDS')
const sources=JSON.parse(readFileSync('docs/recognition-optimization/candidate19-development/SOURCES.json')).sources
const recordings=candidate19Recordings({units:pack.units,sources,state:scene.state,rawRoot:'.data/candidate19/execution/raw'})
if(!recordings.length)throw Error('C19_NO_SETTLED_RECORDINGS')
const sha=v=>createHash('sha256').update(v).digest('hex'),dir=resolve('.data/candidate19/recorded-'+instance)
mkdirSync(dir,{recursive:true});if(readdirSync(dir).length)throw Error('C19_REPLAY_INSTANCE_ALREADY_BUILT')
let fixtureCount=0
if(fixtureMode==='--eligibility-fixtures'){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {ELIGIBILITY_CASES,createEligibilityFixture} from './src/experiments/candidate19Recorded/eligibilityFixtures'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const {ELIGIBILITY_CASES,createEligibilityFixture}=await import(pathToFileURL(fixtureFile))
  fixtureCount=ELIGIBILITY_CASES.length
  for(const [i,row] of ELIGIBILITY_CASES.entries()){
    const f=await createEligibilityFixture(row.id)
    recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})
  }
}else if(fixtureMode){
  const fixtureFile=resolve(dir,'fixture-builder.mjs')
  await build({stdin:{contents:`export {CHANNEL_ROLE_CASES,CHANNEL_POLARITY_CASES,createChannelRoleFixture} from './src/experiments/candidate19Recorded/materialChannelFixtures'`,resolveDir:process.cwd()},outfile:fixtureFile,bundle:true,platform:'node',format:'esm'})
  const {CHANNEL_ROLE_CASES,CHANNEL_POLARITY_CASES,createChannelRoleFixture}=await import(pathToFileURL(fixtureFile))
  const examples=fixtureMode==='--channel-polarity-fixtures'?CHANNEL_POLARITY_CASES:CHANNEL_ROLE_CASES
  fixtureCount=examples.length
  for(const [i,row] of examples.entries()){
    const f=await createChannelRoleFixture(row.id)
    recordings.push({ordinal:101+i,sourceId:f.context.index.sourceId,sourceVersionId:f.context.index.sourceVersionId,candidate:'EngineeringFixture',sourceText:f.sourceText,referenceTime:f.context.referenceTime,timezone:f.context.timezone,rawHttpText:f.rawHttpText,responseSha256:sha(f.rawHttpText),requestSha256:null,frozenOutcome:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT'})
  }
}
const hash=createHash('sha256');for(const f of execFileSync('git',['ls-files','--cached','--others','--exclude-standard','src','scripts/serve-candidate19-recorded.mjs','scripts/candidate19-recorded-data.mjs'],{encoding:'utf8'}).trim().split('\n').sort())hash.update(f).update(readFileSync(f))
const buildIdentity=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim().slice(0,12)+' / source '+hash.digest('hex').slice(0,12),origin='http://127.0.0.1:'+port,database='rco-mainline-01-02-i1-d27-plan-recorded-'+instance
const result=await build({entryPoints:['src/experiments/candidate19Recorded/browser.tsx'],bundle:true,write:false,format:'esm',platform:'browser',jsx:'automatic',target:'es2022',outdir:'memory',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}',__C19_RECORDED_CONFIG__:JSON.stringify({origin,database,build:buildIdentity,explicitContract:true,fixtureCount})}})
const files=result.outputFiles.map(f=>{const name=basename(f.path),content=f.text.replace(/@import\s+url\("https:\/\/fonts\.googleapis\.com[^;]+;\s*/g,'');writeFileSync(resolve(dir,name),content);return {name,sha256:sha(content)}})
writeFileSync(resolve(dir,'recordings.json'),JSON.stringify(recordings))
writeFileSync(resolve(dir,'index.html'),'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>学生事务管家 · C19真实录制产品修复</title><link rel="stylesheet" href="/browser.css"></head><body><div id="root"></div><script type="module" src="/browser.js"></script></body></html>')
writeFileSync(resolve(dir,'manifest.json'),JSON.stringify({origin,database,build:buildIdentity,role:'ENGINEERING_REPLAY',batch:scene.state.batch,knownSettledRecordings:recordings.filter(r=>r.candidate!=='EngineeringFixture').length,anonymousFixtures:fixtureCount,plannedRequests:12,batchComplete:scene.state.units.every(u=>u.status==='SETTLED'),files,recordingsSha256:sha(JSON.stringify(recordings)),modelCallsByBrowser:0},null,2))
createServer((req,res)=>{const p=new URL(req.url,origin).pathname;if(req.method!=='GET'||!['/','/browser.js','/browser.css','/recordings.json','/manifest.json'].includes(p)){res.writeHead(403);res.end('C19_MODEL_AND_EXTERNAL_ROUTES_DISABLED');return}res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript; charset=utf-8':p.endsWith('.css')?'text/css; charset=utf-8':p.endsWith('.json')?'application/json':'text/html; charset=utf-8');res.end(readFileSync(resolve(dir,p==='/'?'index.html':p.slice(1))))}).listen(+port,'127.0.0.1',()=>console.log(JSON.stringify({origin,database,build:buildIdentity,recordings:recordings.length,modelCallsByBrowser:0})))
