import {readFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {createHash} from 'node:crypto'
import {readCandidate19Package} from './candidate19-execution-host.mjs'
import {createScopedHost} from './scoped-execution-host.mjs'
import {createScopedEngine} from './scoped-execution-core.mjs'
import {AUTHORITATIVE_LEDGER} from './d26-execution-host.mjs'
const sha=b=>createHash('sha256').update(b).digest('hex')
/** Reuse original snapshot validation and existing read-only audit, never relax a frozen assertion. */
export async function candidate19RecordedScene(snapshot='C:/Users/Winner/.codex/worktrees/student-affairs-c19-frozen/比赛') {
  const active=process.cwd(),root=resolve(active,'.data/candidate19/execution')
  let pack,manifest
  try {process.chdir(snapshot);pack=readCandidate19Package();manifest=JSON.parse(readFileSync('docs/recognition-optimization/candidate19-development/MANIFEST.json'))}
  finally {process.chdir(active)}
  const frozenRoot=resolve(active,'docs/recognition-optimization/candidate19-development')
  if(sha(readFileSync(join(frozenRoot,'MANIFEST.json')))!==pack.binding.manifestSha256||sha(readFileSync(join(frozenRoot,'PREPARED_REQUEST_IDENTITIES.json')))!==pack.binding.identitiesSha256)throw Error('C19_RECORDED_FROZEN_IDENTITY_DRIFT')
  for(const f of manifest.artifacts)if(sha(readFileSync(join(frozenRoot,f.path)))!==f.sha256)throw Error('C19_RECORDED_FROZEN_ARTIFACT_DRIFT')
  const forbidden=()=>{throw Error('C19_RECORDED_READ_ONLY_DISPATCH_DISABLED')}
  const scope={batch:'C19-C17-C19-DEVELOPMENT-R1',count:12,snapshot:pack.snapshot}
  const host=createScopedHost(scope,{root,ledgerPath:AUTHORITATIVE_LEDGER,engine:createScopedEngine(scope),packageRead:()=>pack,role:'POST_HOC_RECORDING_READ_ONLY',gitCheck:forbidden,append:forbidden,transport:{sendOnce:forbidden}})
  const scene=await host.resumeReadOnly()
  if(scene.audit!=='CONSISTENT'||scene.halt||scene.lockExists||!scene.state||scene.state.units.some(u=>u.status!=='SETTLED'))throw Error('C19_RECORDED_UNRESOLVED_STATE')
  return {pack,scene,snapshot}
}
