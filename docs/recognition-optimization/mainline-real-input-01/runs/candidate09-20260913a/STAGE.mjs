// Exact, reviewed candidate09 stage list; no recursive workspace staging.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
const directory='docs/recognition-optimization/mainline-real-input-01/runs/candidate09-20260913a/'
const snapshot=JSON.parse(readFileSync(directory+'IMPLEMENTATION_SNAPSHOT.json'))
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',windowsHide:true}).trim()
if(git('rev-parse','HEAD')!==snapshot.head)throw Error('HEAD_CHANGED')
const extra=['docs/recognition-optimization/CURRENT_CONTEXT.md','docs/recognition-optimization/OPTIMIZATION_LOG.md',
 'docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl']
const changed=git('diff','HEAD','--name-only').split('\n').filter(path=>path&&!path.startsWith(directory))
for(const path of changed)if(!snapshot.sources.some(s=>s.path===path)&&!extra.includes(path))throw Error('UNEXPECTED_CHANGE:'+path)
const sources=[...changed,...snapshot.sources.filter(s=>s.path.endsWith('/candidate09.ts')||s.path.endsWith('/candidate09.test.ts')||s.path.endsWith('/evidenceRoleWireV2.ts')||s.path.endsWith('/evidenceRoleWireV2.test.ts')).map(s=>s.path)]
const reports=readdirSync(directory).map(f=>directory+f)
const paths=[...new Set([...sources,...reports,directory+'STAGED_FILES.json'])].sort()
writeFileSync(directory+'STAGED_FILES.json',JSON.stringify({head:snapshot.head,paths},null,2)+'\n')
for(const path of paths)git('add','-f','--',path)
const actual=git('diff','--cached','--name-only').split('\n').sort()
if(JSON.stringify(actual)!==JSON.stringify(paths))throw Error('INDEX_NOT_EXACT')
// Preserve raw tool output byte-for-byte; its trailing blank lines are evidence,
// not source whitespace. All source and authored report files still get checked.
git('diff','--cached','--check','--',...paths.filter(path=>!path.endsWith('.log')))
console.log(JSON.stringify({staged:paths.length,sourceAndContext:sources,reportCount:reports.length+1}))
