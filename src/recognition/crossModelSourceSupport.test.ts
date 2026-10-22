import {describe,it,expect} from 'vitest'
import {rangeEndpointSupport} from './rangeEndpointSupport'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {completeDeclaredEventNameSupport} from './declaredEventNameSupport'
describe('source roles independent of model range spelling',()=>{
 const time='2025-09-01T00:00:00+08:00',zone='Asia/Shanghai'
 it.each(['9月14日21:00','2025年9月14日21:00'])('accepts %s only as the declared end of the current cited range',raw=>{
  const q='原定9月11日18:00-21:00的宣讲会调整至9月14日18:00-21:00举行。'
  expect(rangeEndpointSupport(raw,'event_end',[q],time,zone)).toMatchObject({literalRange:'9月14日18:00-21:00',expanded:'9月14日21:00'})
  expect(rangeEndpointSupport(raw,'event_start',[q],time,zone)).toBeNull()
  expect(rangeEndpointSupport(raw,'submission_deadline',[q],time,zone)).toBeNull()
 })
 it('rejects wrong dates, endpoints, ambiguous occurrences and another citation',()=>{
  for(const [raw,q]of[['9月15日21:00','活动9月14日18:00-21:00'],['9月14日22:00','活动9月14日18:00-21:00'],['9月14日21:00','甲9月14日18:00-21:00，乙9月14日19:00-21:00'],['9月14日21:00','另一个活动于9月15日18:00-21:00']])expect(rangeEndpointSupport(raw,'event_end',[q],time,zone)).toBeNull()
 })
})
describe('numbered activity heading binds only its own adjacent time block',()=>{
 function fixture(title='晨间交流'){const r=ordinaryWorkflowFixture();r.events=[{tempId:'EV',title,description:'',startTimePointTempId:null,endTimePointTempId:null,location:null,evidenceIds:['TIME'],confidence:1,inferenceLevel:'explicit'}];r.evidence=[{id:'TIME',sourceId:'pending-source',quote:'活动时间：10月24日09:00-10:30；',field:'event'}];return r}
 it.each(['（一）晨间交流','(2)晨间交流','3.晨间交流','二、晨间交流'])('retains exact literal heading %s and its evidence',heading=>{
  const r=fixture(),source=heading+'\n1.活动时间：10月24日09:00-10:30；'
  expect(completeDeclaredEventNameSupport(r,source)[0]).toMatchObject({eventId:'EV',quote:heading,rule:'IMMEDIATELY_CITED_SOURCE_HEADING'})
  expect(r.evidence.at(-1)?.quote).toBe(heading)
 })
 it('does not skip a different heading, intervening content, or another source',()=>{
  for(const source of ['（一）晨间交流\n（二）晚间交流\n1.活动时间：10月24日09:00-10:30；','（一）晨间交流\n另一项事项说明\n1.活动时间：10月24日09:00-10:30；','（一）晨间交流\n活动时间：10月25日09:00-10:30；'])expect(completeDeclaredEventNameSupport(fixture(),source)).toEqual([])
 })
})
