import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {digest} from './candidate16-d13-records.mjs'
import {d23Materials} from './serve-d23-study.mjs'
import {d8Handler} from './serve-candidate15-d8.mjs'

const directory=resolve(process.argv[2]??'.data/d23/final01'),manifest=JSON.parse(readFileSync(resolve(directory,'manifest.json'),'utf8'))
const {plan,records}=await d23Materials()
assert.equal(manifest.plan.sha256,plan.sha256,'D23 frozen source/stimulus/plan drift')
assert.equal(manifest.modelCallsEnabled,false)
assert.equal(new URL(manifest.origin).hostname,'127.0.0.1')
assert.equal(Object.keys(manifest.databases).length,4)
for(const name of Object.values(manifest.databases))assert.match(name,/^rco-mainline-01-02-i1-real-input-d23-study-(engineering|human)-[a-z0-9-]+-p[1-4]$/)
for(const asset of manifest.assets)assert.equal(digest(readFileSync(resolve(directory,asset.path))),asset.sha256,'D23 asset drift: '+asset.path)
for(const record of records){const bytes=JSON.stringify(record),item=manifest.records.find(r=>r.id===record.id);assert.equal(item?.sha256,digest(bytes));assert.equal(readFileSync(resolve(directory,'records',record.id+'.json'),'utf8'),bytes)}
const sourceFiles=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','src','scripts'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(p=>/\.(tsx?|m?js|css)$/.test(p)).sort()
const sourceSha256=digest(sourceFiles.map(p=>p+':'+digest(readFileSync(p))).join('\n'))
assert.equal(manifest.sourceSha256,sourceSha256,'D23 final source build drift')
const handler=d8Handler(manifest)
async function fakeRequest(method,url,headers={}){let status;const req={method,url,headers:{host:new URL(manifest.origin).host,...headers}},res={writeHead:(code)=>{status=code},end:()=>{}};await handler(req,res);return status}
assert.notEqual(await fakeRequest('POST','/api/deepseek'),200,'No business request route')
assert.notEqual(await fakeRequest('GET','/records/../../.env'),200,'No secret/file route')
assert.notEqual(await fakeRequest('GET','/',{host:'example.invalid'}),200,'No public host')
const js=readFileSync(resolve(directory,'d23-browser.js'),'utf8')
for(const code of ['D23_OTHER_DATABASE_FORBIDDEN','D23_OLD_STORAGE_DISABLED','D23_NETWORK_DISABLED','D23_REAL_SCOPE_AUTHORIZATION_MISSING','D23_DOMAIN_WRITE_OUTSIDE_ACTIVE_TRIAL','D23_STALE_OR_UNCOMMITTED_ADJUDICATION'])assert(js.includes(code),'Missing compiled gate: '+code)
assert(!js.includes('https://fonts.googleapis.com'))
console.log(JSON.stringify({status:'PASS',role:manifest.role,origin:manifest.origin,sourceSha256,planSha256:plan.sha256,materials:plan.materials.length,slots:plan.slots.length,records:records.length,databases:4,modelCalls:0,network:'OFFLINE_HANDLER_ONLY'}))
