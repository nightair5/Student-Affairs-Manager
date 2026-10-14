import {artificialResponse,notices,NOW} from '../mainline01/fixtures'
import type {RecognitionResult} from '../../recognition/types'

export const ordinaryFixtures=[
  {id:'exact',label:'精确截止与材料',text:notices.multi},
  {id:'no-date',label:'没有截止的真实任务',text:notices['no-date']},
  {id:'unknown',label:'未公布截止的任务',text:notices.vague},
  {id:'information',label:'纯信息，没有行动',text:'资料室已新增一批参考手册。本通知仅供了解，无需行动。'},
  {id:'event',label:'停机事件，周三晚',text:'校车预约平台将在周三晚停机，已保存行程不受影响。无需删除行程，不要提交说明。本通知仅说明停机消息。'},
  {id:'mixed',label:'任务与两个独立事件',text:'请保存活动手册。资料讲解会于2026年10月12日14:00开始，15:00结束，地点为资料室。预约平台将在周三晚停机。'},
  {id:'date-only',label:'仅日期的任务',text:'请于2026年10月12日前提交报名表。'},
  {id:'omitted',label:'误判资讯后补遗漏',text:'请保存活动手册。本通知没有截止日期。'},
  {id:'dependency',label:'前置未完成的两个待办',text:'请先填写登记表。填完后提交登记表，PDF格式。当前尚未填写。'},
  {id:'partial',label:'错误关联与无关正确项',text:'请保存活动手册。请提交报告，报告时间尚未公布。'},
] as const
export function ordinaryFixtureResult(id:string,sourceId:string):RecognitionResult{
  const fixture=ordinaryFixtures.find(f=>f.id===id)
  if(!fixture)throw Error('D26_ANONYMOUS_FIXTURE_REQUIRED')
  const kind=id==='exact'?'multi':id==='no-date'||id==='mixed'?'no-date':id==='unknown'?'vague':'information'
  const result=artificialResponse(kind,sourceId)
  result.modelName='D26 匿名工程假传输（非模型成绩）';result.createdAt=NOW
  result.sourceSummary.summary=fixture.text
  result.evidence=result.evidence.map(e=>({...e,sourceId,quote:fixture.text,quotedText:fixture.text,textEnd:fixture.text.length}))
  if(id==='event'||id==='mixed'){
    result.events=[{tempId:'stop',title:'预约平台将在周三晚停机',description:'',location:null,startTimePointTempId:'stop-time',endTimePointTempId:null,evidenceIds:['notice'],confidence:1,inferenceLevel:'explicit',selected:true}]
    result.timePoints.push({tempId:'stop-time',type:'event_start',rawText:'周三晚',normalizedValue:null,timezone:'Asia/Shanghai',isAllDay:false,precision:'vague',needsConfirmation:true,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:['notice'],confidence:1,selected:true})
    if(id==='mixed'){
      result.events.push({tempId:'briefing',title:'资料讲解会',description:'',location:'资料室',startTimePointTempId:'brief-start',endTimePointTempId:'brief-end',evidenceIds:['notice'],confidence:1,inferenceLevel:'explicit',selected:true})
      for(const [part,raw,value] of [['start','2026年10月12日14:00','2026-10-12T14:00'],['end','15:00','2026-10-12T15:00']] as const)result.timePoints.push({tempId:`brief-${part}`,type:part==='start'?'event_start':'event_end',rawText:raw,normalizedValue:value,timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:['notice'],confidence:1,selected:true})
    }
  }
  if(id==='date-only'){const base=artificialResponse('no-date',sourceId).standaloneTasks[0];result.sourceSummary.requiresAction=true;result.standaloneTasks=[{...base,tempId:'date-task',title:'提交报名表',actionVerb:'提交',actionObject:'报名表',timePointTempIds:['date-time']}];result.timePoints=[{tempId:'date-time',type:'task_deadline',rawText:'2026年10月12日前',normalizedValue:'2026-10-12',timezone:'Asia/Shanghai',isAllDay:true,precision:'date_only',needsConfirmation:false,relatedTaskTempIds:['date-task'],relatedMaterialTempIds:[],evidenceIds:['notice'],confidence:1,selected:true}]}
  if(id==='dependency'||id==='partial'){
    const base=artificialResponse('no-date',sourceId).standaloneTasks[0]
    result.sourceSummary.requiresAction=true
    result.standaloneTasks=id==='dependency'?[{...base,tempId:'fill',title:'填写登记表',actionVerb:'填写',actionObject:'登记表',description:'',dependencyTempIds:[]},{...base,tempId:'submit',title:'提交登记表',actionVerb:'提交',actionObject:'登记表',description:'',dependencyTempIds:['fill']}]:[{...base,tempId:'safe'},{...base,tempId:'broken',title:'提交报告',actionVerb:'提交',actionObject:'报告',dependencyTempIds:['nonexistent']}]
    result.standaloneTasks=result.standaloneTasks.map(t=>({...t,evidenceIds:['notice']}))
  }
  return result
}
