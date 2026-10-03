import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {candidate19Recordings} from './candidate19-recorded-data.mjs'
const root='docs/recognition-optimization/candidate19-development/'
const units=JSON.parse(readFileSync(root+'PREPARED_REQUEST_IDENTITIES.json')).requests
const sources=JSON.parse(readFileSync(root+'SOURCES.json')).sources
const state=JSON.parse(readFileSync(root+'paid-evidence/EXECUTION_REPORT.json')).scene.state
function fixture(){const rawRoot=mkdtempSync(join(tmpdir(),'c19-recorded-test-'));for(let i=1;i<=2;i++)writeFileSync(join(rawRoot,String(i).padStart(2,'0')+'.json'),readFileSync(root+'paid-evidence/raw-'+String(i).padStart(2,'0')+'.json'));return {units,sources,state,rawRoot}}
test('only two known settled records are exposed; the ten unsent fixed identities never become synthetic outputs',()=>{
  const rows=candidate19Recordings(fixture());assert.deepEqual(rows.map(r=>[r.ordinal,r.candidate]),[[1,'Candidate17'],[2,'Candidate19']]);assert.equal(rows[0].referenceTime,sources[0].referenceTime)
})
test('raw, request, source or HTTP substitutions are rejected before replay',()=>{
  for(const mode of ['raw','request','source','http']){const f=fixture(),path=join(f.rawRoot,'02.json'),r=JSON.parse(readFileSync(path));if(mode==='raw')r.rawHttpText+=' ';if(mode==='request')r.requestSha256='0'.repeat(64);if(mode==='http')r.httpStatus=500;if(mode==='source')f.sources=structuredClone(sources),f.sources[0].sourceText+='不同来源';writeFileSync(path,JSON.stringify(r));assert.throws(()=>candidate19Recordings(f),/DRIFT/)}
})
