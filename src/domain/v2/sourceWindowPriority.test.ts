import {describe,it,expect} from 'vitest'
import {createGoldenWorkspaceV8} from './fixtures'
import {workspaceV8ToLegacyView} from './legacyView'
import {calculateTaskPriority} from '../../lib/taskLogic'

function windowWorkspace(){
 const w=createGoldenWorkspaceV8(),t=w.tasks[0],p=w.timePoints[0],v=w.sourceVersions[0],literal='2027年3月8日09:00—11:00'
 w.tasks=[{...t,dependencyIds:[],legacyData:{sourceId:v.sourceId,sourceWindowDeclarations:{version:'source-window-declarations-1.0.0',ownerTaskId:t.id,sourceVersionId:v.id,windows:[{state:'RESOLVED_DISCRETE',rawText:literal,pointIds:['window-S','window-E']}]}}}]
 w.materials=[];w.sourceVersions=[{...v,rawText:'纸质报告请在'+literal+'交到资料室。'}]
 w.timePoints=[{...p,id:'window-S',taskId:t.id,eventId:null,materialId:null,type:'event_start',rawText:literal,normalizedValue:'2027-03-08T09:00',precision:'exact',needsConfirmation:false,relatedTaskIds:[t.id],relatedMaterialIds:[]},{...p,id:'window-E',taskId:t.id,eventId:null,materialId:null,type:'event_end',rawText:literal,normalizedValue:'2027-03-08T11:00',precision:'exact',needsConfirmation:false,relatedTaskIds:[t.id],relatedMaterialIds:[]}]
 return w
}

describe('ordinary stored source-window priority',()=>{
 it('does not manufacture deadline urgency above a real imminent cutoff, and leaves canonical facts unchanged',()=>{
  const w=windowWorkspace(),before=JSON.stringify(w),task=workspaceV8ToLegacyView(w).tasks[0],now=new Date('2027-03-04T09:00:00+08:00')
  const window=calculateTaskPriority(task,[task],now),due={...task,id:'actual-cutoff',deadline:'2027-03-04T10:00',sourceWindowLabel:undefined}
  expect(task.deadline).toBe('');expect(task.sourceWindowLabel).toContain('09:00—11:00');expect(window.risks).not.toContain('待确认')
  expect(window.reasons).toContain('按原文办理时段安排，未另设截止');expect(calculateTaskPriority(due,[due],now).score).toBeGreaterThan(window.score)
  expect(JSON.stringify(w)).toBe(before)
 })
 it('warns about the real window nearing its end or already passed without manufacturing a deadline',()=>{
  const task=workspaceV8ToLegacyView(windowWorkspace()).tasks[0]
  const near=calculateTaskPriority(task,[task],new Date('2027-03-08T09:30:00+08:00')),past=calculateTaskPriority(task,[task],new Date('2027-03-08T12:00:00+08:00'))
  expect(near.risks).toContain('紧急');expect(near.reasons).toContain('原文办理时段将在24小时内结束')
  expect(past.risks).toContain('待确认');expect(past.reasons).toContain('原文办理时段已过，请核对补办方式');expect(task.deadline).toBe('')
 })
 it('keeps an explicitly unknown cutoff beside a valid window pending',()=>{
  const w=windowWorkspace();w.timePoints.push({...w.timePoints[0],id:'unknown-cutoff',type:'submission_deadline',rawText:'另行公布截止',normalizedValue:null,precision:'vague',needsConfirmation:true})
  const task=workspaceV8ToLegacyView(w).tasks[0],result=calculateTaskPriority(task)
  expect(task.sourceDeadlineLabel).toBe('另行公布截止');expect(result.risks).toContain('待确认');expect(result.reasons).toContain('截止时间需要核对')
 })
 it('does not suppress stored user risk or a window whose endpoint no longer belongs to the task',()=>{
  const w=windowWorkspace(),taskBefore=workspaceV8ToLegacyView(w).tasks[0]
  expect(calculateTaskPriority(taskBefore,[taskBefore],new Date(),{[taskBefore.id]:{kind:'review',label:'关系需核对',noDeadlineProven:false,projectedPendingOnly:false}}).risks).toContain('待确认')
  w.tasks[0].needsReview=true;expect(calculateTaskPriority(workspaceV8ToLegacyView(w).tasks[0]).risks).toContain('待确认');w.tasks[0].needsReview=false
  w.tasks[0].legacyData={...w.tasks[0].legacyData,v7Record:{riskFlags:['待确认']}}
  expect(calculateTaskPriority(workspaceV8ToLegacyView(w).tasks[0]).risks).toContain('待确认')
  w.timePoints[1].normalizedValue='2027-03-08';w.timePoints[1].needsConfirmation=false;w.timePoints[1].isAllDay=true
  expect(calculateTaskPriority(workspaceV8ToLegacyView(w).tasks[0]).risks).toContain('待确认')
  delete w.tasks[0].legacyData.v7Record;w.timePoints[1].taskId='other-task'
  const task=workspaceV8ToLegacyView(w).tasks[0];expect(task.sourceWindowLabel).toBeUndefined();expect(calculateTaskPriority(task).risks).toContain('待确认')
  w.timePoints[1].taskId=w.tasks[0].id;w.timePoints[1].normalizedValue=null;w.timePoints[1].needsConfirmation=true
  expect(calculateTaskPriority(workspaceV8ToLegacyView(w).tasks[0]).risks).toContain('待确认')
 })
})
