import {readFileSync,writeFileSync,statSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

// The actual Windows assertion runs in the Windows matrix job. Preserve its
// NOT_AVAILABLE row on Linux; never accept a failed assertion or other gap.
export function safetyCiOutcome(summary,platform) {
  const hostOnly=summary.results.filter(row=>row.outcome==='NOT_AVAILABLE'
    &&row.label==='d25-live-safety'
    &&row.reason==='FROZEN_WINDOWS_POWERSHELL_LOCK_TEST_REQUIRES_WINDOWS; portable executor tests run separately')
  const unexpected=summary.results.filter(row=>row.outcome!=='PASS'&&!hostOnly.includes(row))
  if(platform==='win32'&&hostOnly.length)unexpected.push(...hostOnly)
  return {outcome:unexpected.length?'FAIL':hostOnly.length?'PASS_PLATFORM_MATRIX_REQUIRED':'PASS',hostOnly:hostOnly.map(row=>row.label),unexpected}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const started=Date.now(),child=spawnSync(process.execPath,['scripts/candidate11-checks.mjs','current-safety'],{stdio:'inherit',timeout:12*60_000})
  if(child.error)throw child.error
  const path=resolve('.data/candidate11/checks/current-safety',(process.env.TZ??'Asia/Shanghai').replaceAll('/','-'),'summary.json')
  if(child.signal||statSync(path).mtimeMs<started)throw Error('SAFETY_RUN_DID_NOT_COMPLETE')
  const report=safetyCiOutcome(JSON.parse(readFileSync(path,'utf8')),process.platform)
  if(child.status!==0&&child.status!==2)report.unexpected.push({outcome:'FAIL',reason:'RUNNER_EXIT',status:child.status})
  if(report.unexpected.length)report.outcome='FAIL'
  writeFileSync(resolve(path,'..','ci-policy.json'),JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report))
  if(report.outcome==='FAIL')process.exitCode=1
}
