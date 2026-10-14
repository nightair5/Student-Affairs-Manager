import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {sourceCoverageHints} from './sourceCoverageHints'
describe('missing-source disclosure without invented facts or extra confirmation',()=>{
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
