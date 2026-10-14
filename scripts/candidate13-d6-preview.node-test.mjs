import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync,writeFileSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {buildD6Preview,d6Handler} from './serve-candidate13-d6.mjs'

const directory=mkdtempSync(join(tmpdir(),'d6-static-tests-'));writeFileSync(join(directory,'index.html'),'<html>D6</html>')
const handler=d6Handler({origin:'http://127.0.0.1:6634',directory,assets:[{path:'index.html'}]})
function request(url='/',headers={},method='GET'){const result={};handler({url,method,headers:{host:'127.0.0.1:6634',...headers}},{writeHead:(status,h)=>{result.status=status;result.headers=h},end:body=>{result.body=body?.toString()}});return result}
test('only D6 loopback origin serves the isolated static app',()=>{assert.equal(request().status,200);assert.equal(request('/?automation=1').status,200);assert.equal(request('/',{},'HEAD').body,undefined);assert.match(request().headers['Content-Security-Policy'],/connect-src 'self'/)})
test('host, cross-site, server writes and unlisted paths fail closed',()=>{for(const headers of [{host:'attacker.invalid'},{origin:'https://other.invalid'},{'sec-fetch-site':'cross-site'}])assert.equal(request('/',headers).status,403);for(const method of ['POST','PUT','DELETE'])assert.equal(request('/',{},method).status,405);for(const path of ['/api/deepseek','/manifest.json','/.env','/?other=1'])assert.equal(request(path).status,404)})
test('old origins cannot build D6 and launcher has no model or dotenv path',async()=>{for(const origin of ['http://127.0.0.1:6631','http://127.0.0.1:6632','http://127.0.0.1:6633','http://0.0.0.0:6634'])await assert.rejects(()=>buildD6Preview(origin),/D6_PREVIEW_ORIGIN/);const source=readFileSync('scripts/serve-candidate13-d6.mjs','utf8');assert.doesNotMatch(source,/import.*(?:dotenv|real-input-model-gateway)/);assert.match(source,/modelCallsEnabled:false/)})
test('preview builds exactly 24 recorded results with no human-trial claim',async()=>{const manifest=await buildD6Preview();assert.equal(manifest.records.length,24);assert.equal(manifest.modelCallsEnabled,false);assert.equal(manifest.humanTrial,false);assert.equal(manifest.database,'rco-mainline-01-02-i1-real-input-candidate13-d6-engineering-1')})
