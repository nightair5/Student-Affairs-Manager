import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'

/** Anonymous engineering examples, never model observations or evaluation rows. */
export function conditionalRefundFixture(personalFact=''){
 const rule='学生如已缴费但决定放弃选修资格，请于开课前申请退费。',delivery='2027年4月8日17:00前填写并发送《选修退费申请表》（教务处官网-表格下载）至选修办理邮箱:[匿名邮箱]办理。',arrival='退款预计在学期末前到账。',source=rule+delivery+arrival+personalFact,r=ordinaryWorkflowFixture(source),t=r.standaloneTasks[0]
 Object.assign(t,{tempId:'refund',title:'填写并发送《选修退费申请表》',actionVerb:'填写并发送',actionObject:'《选修退费申请表》',description:rule+delivery,completionCriteria:['填写申请表并发送至选修办理邮箱:[匿名邮箱]'],materialTempIds:['form'],timePointTempIds:['cutoff'],dependencyTempIds:[],evidenceIds:['rule','delivery',...(personalFact?['personal']:[])],selected:false})
 r.evidence=[{id:'rule',sourceId:'pending-source',quote:rule,field:'requirement'},{id:'delivery',sourceId:'pending-source',quote:delivery,field:'materials'},{id:'arrival',sourceId:'pending-source',quote:arrival,field:'description'},...(personalFact?[{id:'personal',sourceId:'pending-source',quote:personalFact,field:'requirement' as const}]:[])]
 r.materials=[{tempId:'form',name:t.actionObject,required:true,formatRequirements:[],namingRequirements:[],quantity:1,submissionChannel:'选修办理邮箱:[匿名邮箱]',relatedTaskTempIds:['refund'],evidenceIds:['delivery'],confidence:1}]
 r.timePoints=[{tempId:'cutoff',type:'submission_deadline',rawText:'2027年4月8日17:00前',normalizedValue:'2027-04-08T17:00',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:['refund'],relatedMaterialTempIds:[],evidenceIds:['delivery'],confidence:1,selected:false}]
 r.ambiguities=[];r.conflicts=[]
 return {source,r}
}

export function alternativeReceiptFixture(daily=false){
 const a='2027年4月6日—2027年4月7日'+(daily?'每日':'')+'10:00—12:00',b='2027年4月8日—2027年4月9日'+(daily?'每日':'')+'13:00—16:00'
 const normal='请于'+a+'在甲室领取资料袋。',rule='如果错过以上领取时间，可于'+b+'在乙室领取。',source=normal+'\n'+rule,r=ordinaryWorkflowFixture(source),base=r.standaloneTasks[0]
 r.materials=[];r.standaloneTasks=[{...base,tempId:'normal',title:'领取资料袋',actionVerb:'领取',actionObject:'资料袋',description:normal,completionCriteria:['已领取资料袋'],materialTempIds:[],timePointTempIds:['a0','a1'],evidenceIds:['normal'],estimatedMinutes:30,selected:true},{...base,tempId:'alternative',title:'领取资料袋（错过正常窗口时）',actionVerb:'领取',actionObject:'资料袋',description:rule,completionCriteria:['已领取资料袋'],materialTempIds:[],timePointTempIds:['b0','b1'],evidenceIds:['alternative'],dependencyTempIds:['normal'],estimatedMinutes:30,selected:false}]
 r.evidence=[{id:'normal',sourceId:'pending-source',quote:normal,field:'event'},{id:'alternative',sourceId:'pending-source',quote:rule,field:'event'}]
 r.timePoints=[['a0','event_start',a,'normal'],['a1','event_end',a,'normal'],['b0','event_start',b,'alternative'],['b1','event_end',b,'alternative']].map(([id,type,raw,owner])=>({tempId:id,type:type as 'event_start'|'event_end',rawText:raw,normalizedValue:null,timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[owner],relatedMaterialTempIds:[],evidenceIds:[owner],confidence:1,selected:true}))
 r.events=[['normal-event','资料袋领取','a0','a1','normal','甲室'],['alternative-event','资料袋补领','b0','b1','alternative','乙室']].map(([id,title,start,end,owner,location])=>({tempId:id,title,description:owner==='normal'?normal:rule,startTimePointTempId:start,endTimePointTempId:end,location,relatedTaskTempIds:[owner],evidenceIds:[owner],confidence:1,inferenceLevel:'explicit',selected:owner==='normal'}))
 r.ambiguities=[];r.conflicts=[]
 return {source,r}
}
