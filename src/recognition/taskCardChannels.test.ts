import {describe,it,expect} from 'vitest'
import {taskCardChannels} from './taskCardChannels'
import {buildLocalRecognition} from './pipeline'
const source='通过课程平台提交阅读报告。'
function fixture(){const r=buildLocalRecognition({content:'10月30日17:00前提交阅读报告。',sourceTitle:'匿名通知',sourceType:'text',referenceTime:new Date('2026-10-23T10:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]});r.promptVersion='recognition-two-step-2.1.0';const t=r.standaloneTasks[0];t.description='通过课程平台提交阅读报告\n提交渠道：课程平台';t.actionObject='阅读报告';r.evidence=[{id:'action',sourceId:'s',quote:source.slice(0,-1),textStart:0,textEnd:source.length-1,field:'description',extractionMethod:'parser',confidence:1},{id:'channel',sourceId:'s',quote:'课程平台',textStart:2,textEnd:6,field:'description',extractionMethod:'parser',confidence:1}];t.evidenceIds=['action','channel'];return{r,t}}
describe('summary preserves already-compiled task routes without material reassignment',()=>{
 it('shows a source-aligned task channel even with no unique material channel',()=>{const {r,t}=fixture();const before=structuredClone(r);expect(taskCardChannels(r,t,source)).toEqual(['提交渠道：课程平台']);expect(r).toEqual(before)})
 it('never promotes legacy prose, a wrong value, another object or missing owner',()=>{
  const a=fixture();a.r.promptVersion='recognition-product-contract-1.5.0';expect(taskCardChannels(a.r,a.t,source)).toEqual([])
  const b=fixture();b.t.description='提交渠道：另一个平台';expect(taskCardChannels(b.r,b.t,source)).toEqual([])
  const c=fixture();c.t.actionObject='报名表';expect(taskCardChannels(c.r,c.t,source)).toEqual([])
  const d=fixture();d.t.evidenceIds=['action'];expect(taskCardChannels(d.r,d.t,source)).toEqual([])
 })
 it('rejects invalid offsets and never changes conditional selection',()=>{const {r,t}=fixture();t.selected=false;expect(taskCardChannels(r,t,source)).toHaveLength(1);expect(t.selected).toBe(false);r.evidence[1].textStart=0;expect(taskCardChannels(r,t,source)).toEqual([])})
})
