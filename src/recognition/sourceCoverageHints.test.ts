import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {sourceCoverageHints} from './sourceCoverageHints'
describe('missing-source disclosure without invented facts or extra confirmation',()=>{
 it('a shared complete range does not make its correctly resolved end look like the earlier start',()=>{
  const r=ordinaryWorkflowFixture(),source='活动于2027年3月8日19:00开始，20:30结束。';r.standaloneTasks=[];r.materials=[];r.events=[{tempId:'EV',title:'活动',description:source,startTimePointTempId:'S',endTimePointTempId:'E',location:null,evidenceIds:[],confidence:1,inferenceLevel:'explicit'}];r.timePoints=['S','E'].map((tempId,i)=>({tempId,type:i?'event_end':'event_start',rawText:source.slice(0,-1),normalizedValue:i?'2027-03-08T20:30':'2027-03-08T19:00',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[],confidence:1}));const before=structuredClone(r);expect(sourceCoverageHints(source,r)).toEqual([]);expect(r).toEqual(before)
  r.timePoints[1].normalizedValue='2027-03-08T11:00:00Z';expect(sourceCoverageHints(source,r).map(h=>h.kind)).toEqual(['unresolved_time_role']);r.timePoints[1].normalizedValue='2027-03-08T12:30:00Z';expect(sourceCoverageHints(source,r)).toEqual([])
 })
 it('does not borrow a signup cutoff to turn a completed-course qualifier into a missing event',()=>{
  const r=ordinaryWorkflowFixture(),before=structuredClone(r)
  expect(sourceCoverageHints('已完成基础培训者可报名实验室值班，报名截止为2027年3月7日12:00。你尚未完成基础培训，培训完成后再报名。',r)).toEqual([])
  expect(sourceCoverageHints('参加过安全讲座的同学可报名，截止为2027年4月3日17:00。',r)).toEqual([])
  expect(sourceCoverageHints('可报名岗前培训，报名截止为2027年4月3日17:00。',r)).toEqual([])
  expect(r).toEqual(before)
 })
 it('still discloses a real future activity beside a completed prerequisite or registration cutoff',()=>{
  const r=ordinaryWorkflowFixture()
  expect(sourceCoverageHints('已完成基础培训者请参加岗前培训，岗前培训定于2027年3月9日09:00。报名截止为2027年3月7日12:00。',r).map(h=>h.kind)).toEqual(['unrepresented_event'])
  expect(sourceCoverageHints('讲座定于2027年4月5日14:00，报名截止为2027年4月3日17:00。',r).map(h=>h.kind)).toEqual(['unrepresented_event'])
  expect(sourceCoverageHints('平台将在周三晚停机。',r).map(h=>h.kind)).toEqual(['unrepresented_event'])
 })
 it('makes a real omitted pre-registration result/date window visible, but not a represented completion criterion',()=>{const r=ordinaryWorkflowFixture(),text='新生须在8月13—27日登录迎新系统完成网上预注册。';expect(sourceCoverageHints(text,r).map(h=>h.kind)).toEqual(['unrepresented_time_range','unrepresented_action']);r.standaloneTasks[0].completionCriteria=['完成网上预注册'];r.timePoints=['2026-08-13','2026-08-27'].map((v,i)=>({tempId:'P'+i,type:i?'event_end':'event_start',rawText:'8月13—27日',normalizedValue:v,timezone:'Asia/Shanghai',isAllDay:true,precision:'date_only',needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[],confidence:1}));expect(sourceCoverageHints(text,r)).toEqual([])})
 it('points to a departure wrongly used as the end, without demanding a second event or changing facts',()=>{const r=ordinaryWorkflowFixture(),source='09:00集合，09:15出发。';r.timePoints=[{tempId:'END',type:'event_end',rawText:'09:15',normalizedValue:'2027-02-01T09:15',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:[],confidence:1}];r.events=[{tempId:'EV',title:'集合',description:source,startTimePointTempId:null,endTimePointTempId:'END',location:null,evidenceIds:[],confidence:1,inferenceLevel:'explicit'}];const before=structuredClone(r);expect(sourceCoverageHints(source,r)[0].kind).toBe('unresolved_time_role');expect(r).toEqual(before);expect(sourceCoverageHints('09:15结束。',r)).toEqual([])})
 it('does not mistake checking a completion status or a submission closing phrase for a missing action',()=>{const r=ordinaryWorkflowFixture();expect(sourceCoverageHints('请登录系统核对是否完成报名。',r)).toEqual([]);expect(sourceCoverageHints('请上传画稿，平台接收成功即完成提交。',r).some(h=>h.title==='这项办结要求还没有对应结果')).toBe(false)})
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
 it('uses existing canonical attachment ownership rather than an omitted duplicated task index, without inventing a third action',()=>{
  const r=ordinaryWorkflowFixture(),t=r.standaloneTasks[0];r.milestones=[];r.standaloneTasks=[{...t,tempId:'A',actionVerb:'提交',actionObject:'实验总结',materialTempIds:[],completionCriteria:['审核证明随实验总结提交']}];r.materials=[{...r.materials[0],tempId:'M',name:'审核证明',relatedTaskTempIds:['A']}];const source='实验总结须提交审核证明。审核证明是随附材料，不是另外一项提交动作。',before=structuredClone(r);
  expect(sourceCoverageHints(source,r)).toEqual([]);expect(r).toEqual(before);
  const foreign=structuredClone(r);foreign.materials[0].relatedTaskTempIds=['OTHER'];expect(sourceCoverageHints(source,foreign).some(h=>h.kind==='unrepresented_action')).toBe(true);
  const suffix=structuredClone(r);suffix.materials[0].name='审核证明照片';expect(sourceCoverageHints(source,suffix).some(h=>h.kind==='unrepresented_action')).toBe(true);
  r.materials=[];expect(sourceCoverageHints(source,r).some(h=>h.kind==='unrepresented_action')).toBe(true)
 })
 it('retaining an existing named todo is not a second action, while retaining a real receipt or a missing todo remains visible',()=>{
  const r=ordinaryWorkflowFixture();r.milestones=[];r.standaloneTasks=[{...r.standaloneTasks[0],actionVerb:'提交',actionObject:'封面作品'}];const text='请保留封面作品待办。格式同上，上条未提供。',before=structuredClone(r);expect(sourceCoverageHints(text,r).map(h=>h.kind)).toEqual(['unread_reference']);expect(r).toEqual(before);
  expect(sourceCoverageHints('请保留原始回执。',r).map(h=>h.kind)).toEqual(['unrepresented_action']);r.standaloneTasks=[];expect(sourceCoverageHints(text,r).some(h=>h.kind==='unrepresented_action')).toBe(true)
 })

})
