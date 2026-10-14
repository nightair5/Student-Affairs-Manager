import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {sourceCoverageHints} from './sourceCoverageHints'
describe('missing-source disclosure without invented facts or extra confirmation',()=>{
 it('makes a missing notice event and quantity-prefixed preparation visible without creating facts',()=>{const r=ordinaryWorkflowFixture(),before=structuredClone(r);expect(sourceCoverageHints('平台将在周三晚停机。参加讨论前请准备一页议题提纲。',r).map(h=>h.kind)).toEqual(['unrepresented_event','unrepresented_action']);expect(r).toEqual(before);expect(sourceCoverageHints('平台不会停机。无需准备一页议题提纲。',r)).toEqual([])})
 it('a clock range quoted only by a deadline is not a represented operating window',()=>{
  const r=ordinaryWorkflowFixture();r.timePoints=[{tempId:'P',type:'submission_deadline',rawText:'2026年11月4日09:00—11:00',normalizedValue:'2026-11-04T09:00',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[],confidence:.9}];const before=structuredClone(r);expect(sourceCoverageHints('纸质件请于2026年11月4日09:00—11:00到教务窗口递交。',r)[0].kind).toBe('unrepresented_time_range');expect(r).toEqual(before)
 })
 it('points to missing attachment and clock range, without modifying any fact/selection',()=>{
  const text='提交位置见附件，附件内容未提供。办理窗口09:00—11:00。',r=ordinaryWorkflowFixture(),copy=structuredClone(r),h=sourceCoverageHints(text,r);expect(h.map(x=>x.kind)).toEqual(['unread_reference','unrepresented_time_range']);expect(h.every(x=>text.includes(x.quote))).toBe(true);expect(r).toEqual(copy)
 })
 it('does not call a represented range or unrelated cancelled/photo range missing',()=>{
  const r=ordinaryWorkflowFixture();r.timePoints=[{tempId:'P',type:'event_start',rawText:'09:00—11:00',normalizedValue:null,timezone:'Asia/Shanghai',isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[],confidence:.8}];expect(sourceCoverageHints('办理窗口09:00—11:00。',r)).toEqual([]);expect(sourceCoverageHints('历史照片09:00—11:00。取消的说明会12:00—13:00。',ordinaryWorkflowFixture())).toEqual([])
 })
 it('a real missing activation/preparation is visible; prohibition and an already represented action are not',()=>{
  const r=ordinaryWorkflowFixture();expect(sourceCoverageHints('请激活教学账号。各学员需自行准备终端设备。',r).map(x=>x.kind)).toEqual(['unrepresented_action','unrepresented_action']);expect(sourceCoverageHints('无需准备终端设备。不必激活教学账号。',r)).toEqual([]);r.standaloneTasks[0].actionVerb='激活';r.standaloneTasks[0].actionObject='教学账号';expect(sourceCoverageHints('请激活教学账号。',r)).toEqual([])
 })
})
