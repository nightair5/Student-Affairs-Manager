import {existsSync,readdirSync,readFileSync} from 'node:fs'
import {resolve,join,relative} from 'node:path'
import {createHash} from 'node:crypto'

export function checkEnvironment(source) {
  const allowed=new Set(['PATH','PATHEXT','SYSTEMROOT','WINDIR','COMSPEC','TEMP','TMP','TMPDIR','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','PROGRAMFILES','PROGRAMFILES(X86)','SYSTEMDRIVE','NUMBER_OF_PROCESSORS','TZ'])
  // Filter names before reading values: never even evaluate credential getters.
  const env=Object.fromEntries(Object.keys(source).filter(key=>allowed.has(key.toUpperCase())).map(key=>[key,source[key]]))
  return {...env,CI:'true',NO_COLOR:'1',TZ:env.TZ??'Asia/Shanghai'}
}

export function assertNoEnvironmentFiles(root) {
  if(readdirSync(root).some(name=>(/^\.env(?:\.|$)/.test(name)&&name!=='.env.example')||(/^\.dev\.vars(?:\.|$)/.test(name)&&name!=='.dev.vars.example')))throw Error('C11_ENV_FILE_PRESENT_NO_LOAD')
}

export function testFileGroups(root) {
  const all=[]
  function visit(dir) {for(const entry of readdirSync(resolve(root,dir),{withFileTypes:true})) {const path=join(dir,entry.name);if(entry.isDirectory())visit(path);else if(/\.(?:test|spec)\.tsx?$/.test(path))all.push(path.replaceAll('\\','/'))}}
  visit('src');visit('scripts');all.sort()
  const carrier='src/experiments/realInput01/acceptance.test.tsx'
  const mixed='src/experiments/realInput01/runtime.test.ts'
  // These frozen suites load the private D17 raw package, some at module scope.
  const historical=new Set(['d19SourceSession','d20Rebase','d21EventEvidence','d22Recovery','d23Study','d24Product'].map(name=>'src/experiments/candidate16/'+name+'.test.ts'))
  return {product:all.filter(path=>!path.startsWith('src/experiments/')),safety:all.filter(path=>path.startsWith('src/experiments/')&&path!==carrier&&path!==mixed&&!historical.has(path)),carriers:all.filter(path=>path===carrier),mixed:all.filter(path=>path===mixed),historical:all.filter(path=>historical.has(path))}
}

// Mixed suites retain their original assertions. These explicit historical cases
// and their exact complement are both scheduled, under different prerequisites.
export const historicalTestNames={
  carriers:[
    'the candidate02 launcher exposes local carriers but keeps all upstream sending disabled',
    'complex notice correction public API, original model answers remain immutable',
    'batch actual recorded responses retain raw and first suggestions, never default select, preserve A02 and reject identity substitution',
    'original A02 real App driver preserves provenance, material observation and explicit edits through independent reload',
    'recorded launcher builds real App, serves only bound A02 and rejects unauthorized endpoints without model code',
  ],
  mixed:[
    'exact original A02 enters existing source atomically, provenance stays live, duplicate replay preserves confirmed data',
    'record corruption/identity substitution rejects before writes; original pending source retained on transaction failure',
  ],
}
export function historicalTestPattern(group, historical) {
  const names=historicalTestNames[group]
  if(!names)throw Error('UNKNOWN_MIXED_TEST_GROUP')
  const pattern=names.map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')
  return historical?'(?:'+pattern+')':'^(?!.*(?:'+pattern+')).*$'
}

export async function prepareCarriers(prepare,run,record) {
  let manifest
  try {manifest=await prepare()}
  catch(error) {record({label:'carrier-preparation',status:1,outcome:'FAIL',error:String(error.message??error)});record({label:'vitest-carriers',status:null,outcome:'NOT_RUN',reason:'CARRIER_PREPARATION_FAILED'});return}
  record({label:'carrier-preparation',status:0,outcome:'PASS',manifest})
  return run(manifest)
}

// Check all available originals even if a different original is missing.
export function inspectHistoricalFiles(root, entries, read=readFileSync) {
  const results=[]
  for(const item of entries) {
    const path=resolve(root,item.path),rel=relative(root,path)
    if(rel.startsWith('..')||resolve(root,rel)!==path)throw Error('HISTORICAL_PATH_ESCAPE')
    try {
      const bytes=read(path),value=item.mode==='lf'?bytes.toString('utf8').replace(/\r\n/g,'\n'):bytes
      const actual=createHash('sha256').update(value).digest('hex')
      results.push({path:item.path,outcome:actual===item.sha256?'PASS':'FAIL',...(actual===item.sha256?{}:{reason:'IMMUTABLE_ORIGINAL_CHANGED',expected:item.sha256,actual})})
    }catch(error) {if(error.code!=='ENOENT')throw error;results.push({path:item.path,outcome:'NOT_AVAILABLE',reason:'ORIGINAL_MISSING'})}
  }
  return {outcome:results.some(r=>r.outcome==='FAIL')?'FAIL':results.some(r=>r.outcome==='NOT_AVAILABLE')?'NOT_AVAILABLE':'PASS',results}
}

export function historicalArtifactEntries(root) {
  // Anchored to committed 7b90b1e originals, never to mutable current expectations.
  const anchors=[
    {path:'docs/governance/GOVERNANCE_BASELINE_V2.json',sha256:'2b241cd1f8179210b699c62090bc54786b20d6d590a66615b439ae7f81c362bf',mode:'lf'},
    {path:'docs/recognition-optimization/d25-accuracy/MANIFEST.json',sha256:'b21902a115ad3feebc66fc11ab58c30564277a123dc0cb2669691a0415f1ce06',mode:'raw'},
  ]
  const rows=[...anchors]
  const approved=entry=>{
    if(!existsSync(resolve(root,entry.path))||inspectHistoricalFiles(root,[entry]).outcome!=='PASS')return null
    return JSON.parse(readFileSync(resolve(root,entry.path),'utf8'))
  }
  const manifest=approved(anchors[0])
  if(manifest) {
    rows.push({...manifest.originalProtection,mode:'raw'},...manifest.protectedFiles.map(row=>({path:row.readPath,sha256:row.sha256,mode:'raw'})),
      ...manifest.archives.map(row=>({path:row.archivePath,sha256:row.sha256,mode:'raw'})),...manifest.frozenFiles,{...manifest.d7Freeze,mode:'raw'})
    const d7=approved({...manifest.d7Freeze,mode:'raw'})
    if(d7)rows.push(...d7.components.map(row=>({...row,mode:'raw'})))
  }
  // D25 runtime sources can evolve; its artifacts and identities cannot.
  const d25='docs/recognition-optimization/d25-accuracy',d25Manifest=approved(anchors[1])
  if(d25Manifest)rows.push(...d25Manifest.artifacts.map(row=>({...row,path:join(d25,row.path),mode:'raw'})))
  return rows
}
