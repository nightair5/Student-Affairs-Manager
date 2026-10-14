import {test} from 'node:test'
import assert from 'node:assert/strict'
import {selectD16Development} from './candidate17-d17-selection.mjs'

function cases(){return Array.from({length:12},(_,i)=>['A','B'].map(arm=>({sourceId:`S${i+1}`,arm,determinate:true,schemaValid:true,referenceValid:true,score:{status:'SCORED',complete:false,currentTaskRisk:{fn:0,unsupportedActionable:0},severity:{severe:0,forbidden:0},relationsPass:true,fieldErrors:[]}}))).flat()}
test('strict whole-source gain with no risk observes development improvement',()=>{const rows=cases();rows[1].score.complete=true;assert.equal(selectD16Development(rows).status,'DEVELOPMENT_IMPROVEMENT_OBSERVED')})
test('new material error is a risk regression even with a net gain',()=>{const rows=cases();rows[1].score.complete=true;rows[3].score.fieldErrors=[{field:'materialDetails'}];const result=selectD16Development(rows);assert.equal(result.status,'MIXED_PROGRESS');assert.equal(result.risk[0].sourceId,'S2')})
test('new critical FN and severe cannot be offset by a total score',()=>{const rows=cases();rows[1].score.currentTaskRisk.fn=1;rows[1].score.severity.severe=1;assert.equal(selectD16Development(rows).status,'RISK_REGRESSION')})
test('a critical error moved to another task is still a new risk',()=>{const rows=cases();rows[0].score.fieldErrors=[{expectedId:'T1',field:'materialDetails'}];rows[1].score.fieldErrors=[{expectedId:'T2',field:'materialDetails'}];assert.equal(selectD16Development(rows).status,'RISK_REGRESSION')})
test('incomplete, invalid reference and unresolved adjudication remain insufficient',()=>{const rows=cases();assert.equal(selectD16Development(rows.slice(1)).status,'INSUFFICIENT_EVIDENCE');rows[0].referenceValid=false;assert.equal(selectD16Development(rows).status,'INSUFFICIENT_EVIDENCE');rows[0].referenceValid=true;rows[0].adjudication='UNRESOLVED_IMPACTING_COMPARISON';assert.equal(selectD16Development(rows).status,'INSUFFICIENT_EVIDENCE')})
