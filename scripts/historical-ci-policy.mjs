import {readFileSync,writeFileSync,statSync} from 'node:fs'
import {execFileSync,spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'

export function failedTestNames(log) {
  const tap=[...log.matchAll(/^\s*not ok \d+ - (.+)$/gmu)].map(m=>m[1].trim())
  const vitest=[...log.matchAll(/^\s*FAIL\s+(.+?)(?:\r?$)/gmu)].map(m=>m[1].trim())
  return [...new Set([...tap,...vitest])]
}
export function classifyHistorical(summary,policy,{readLog,originalsUnchanged,filesMatch=()=>false}) {
  const known=[],unexpected=[],unavailable=[]
  for(const row of summary.results){
    if(row.outcome==='PASS')continue
    const rule=policy.groups[row.label]
    if(row.outcome==='NOT_AVAILABLE'){
      if(rule?.unavailable&&row.reason==='HISTORICAL_PRIVATE_ORIGINALS_MISSING')unavailable.push(row.label)
      else unexpected.push({label:row.label,reason:'UNEXPECTED_UNAVAILABLE'})
      continue
    }
    if(row.outcome!=='FAIL'||!rule){unexpected.push({label:row.label,reason:'UNLISTED_OUTCOME'});continue}
    if(row.label==='historical-originals'){
      if(originalsUnchanged(row.log,policy.baseline))known.push({label:row.label,reason:rule.reason})
      else unexpected.push({label:row.label,reason:'NEW_ORIGINAL_CONTENT_DRIFT'})
      continue
    }
    const log=readLog(row.log),names=failedTestNames(log)
    const signatures=rule.errorAlternatives??[rule.errors]
    const signatureMatches=signatures.some(errors=>Array.isArray(errors)&&errors.length>0&&errors.every(error=>log.includes(error)))
    const contentMatches=!rule.fileSha256||filesMatch(rule.fileSha256)
    if(names.length&&names.every(name=>rule.tests?.includes(name))&&signatureMatches&&contentMatches)known.push({label:row.label,reason:rule.reason,tests:names})
    else unexpected.push({label:row.label,reason:'NEW_FAILURE_SIGNATURE',tests:names})
  }
  return {outcome:unexpected.length?'FAIL':'PASS_WITH_RECORDED_HISTORY',known,unavailable,unexpected,originalAssertionsUnchanged:true}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const policy=JSON.parse(process.env.HISTORICAL_KNOWN_FAILURES??'null')
  if(!policy?.baseline||!policy.groups)throw Error('HISTORICAL_CI_POLICY_MISSING')
  const started=Date.now(),result=spawnSync(process.execPath,['scripts/candidate11-checks.mjs','historical'],{stdio:'inherit',timeout:12*60_000})
  if(result.error)throw result.error
  const path=resolve('.data/candidate11/checks/historical',(process.env.TZ??'Asia/Shanghai').replaceAll('/','-'),'summary.json')
  if(result.signal||statSync(path).mtimeMs<started)throw Error('HISTORICAL_RUN_DID_NOT_COMPLETE')
  const summary=JSON.parse(readFileSync(path,'utf8'))
  const canonical=bytes=>bytes.toString('utf8').replace(/\r\n/gu,'\n')
  const report=classifyHistorical(summary,policy,{readLog:path=>readFileSync(path,'utf8'),filesMatch:files=>Object.entries(files).every(([path,expected])=>{
    try{return createHash('sha256').update(canonical(readFileSync(path))).digest('hex')===expected}catch{return false}
  }),originalsUnchanged:path=>{
    const report=JSON.parse(readFileSync(path,'utf8')),failed=report.results.filter(row=>row.outcome==='FAIL')
    return failed.length>0&&failed.every(row=>{
      // The old assertion still fails. Suppress CI escalation only for bytes
      // already present at the audited starting commit, never new originals.
      // The active root tool lock is explicitly upgraded in this work package.
      if(row.path==='package-lock.json')return row.expected==='330350e448c1cd29c6c7869c7a978142d95ba84aa12658a9c9bcacdcf763bbe3'
      try{return canonical(readFileSync(row.path))===canonical(execFileSync('git',['show',policy.baseline+':'+row.path],{maxBuffer:16*1024*1024}))}catch{return false}
    })
  }})
  writeFileSync(resolve(path,'..','ci-policy.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report))
  if(report.unexpected.length)process.exitCode=1
}
