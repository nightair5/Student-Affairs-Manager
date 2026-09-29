import {expect,it} from 'vitest'
import {calculateD19Engineering,summarizeD19HumanTrials} from './d19Measurement'
import type {D13Trace} from './measurement'

const row=(kind:D13Trace['kind'],atMs:number,extra:Partial<D13Trace>={}):D13Trace=>({id:'r'+atMs+kind,draftId:'d1',atMs,kind,...extra})

it('counts ten seconds of reading as zero active editing with verified semantic readback',()=>{
  const events=[row('begin',0),row('read',0),row('commit',10_000,{commitId:'c1',fields:[],semanticFields:[],includedEditIds:[],disposition:'no_task'}),row('readback',10_000,{commitId:'c1'}),row('end',10_000,{commitId:'c1',disposition:'no_task'})]
  const result=calculateD19Engineering(events,'assisted',true)
  expect(result.activeEditMs).toBe(0)
  expect(result.readMs).toBe(10_000)
  expect(result.wallMs).toBe(10_000)
  expect(result.semanticFieldCount).toBe(0)
  expect(result.humanMetrics).toBe('NOT_OBSERVABLE')
})

it('keeps missing readback and unfinished intervals missing rather than inventing zero',()=>{
  const events=[row('begin',0),row('edit',1_000,{editId:'e1',fieldKey:'date'}),row('commit',2_000,{commitId:'c1',includedEditIds:['e1'],fields:['timePoints.P1.rawText'],semanticFields:['time:P1:value']})]
  const result=calculateD19Engineering(events,'assisted',null)
  expect(result.activeEditMs).toBeNull()
  expect(result.wallMs).toBeNull()
  expect(result.missing).toContain('unverified semantic commit')
})

it('does not mix manual trials with assisted first-output or low-edit rates',()=>{
  const empty=summarizeD19HumanTrials([])
  expect(empty.manual.firstWholeSuggestionCorrect).toBe('NOT_APPLICABLE')
  expect(empty.assisted.firstWholeSuggestionCorrect).toMatchObject({status:'NOT_OBSERVABLE',denominator:0})
  expect(empty.assisted.correctDisposition).toMatchObject({status:'NOT_OBSERVABLE',denominator:0})
})
