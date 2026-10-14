import { indexImmutableScopesV11 } from '../../recognition/scopeIndexV11'
import { SOURCE_CONTRACT_VERSION, type SourceContractV4, type CoverageClaim } from '../../recognition/sourceContractV4'

export const GENERATION_SOURCES = [
  '校园失物查询网站将在周日晚间暂停查询。此前登记的信息保持不变，不需要重新登记，也不要发送补充邮件。',
  '开放实验室说明会2026年11月12日10:10开始，11:40结束。网络调试从周五夜间开始，恢复时间尚未公布。两件事仅供了解，不要求报名。',
  '先填写场地使用登记。填好之后递交场地使用登记。器材领用资格还未公布，符合资格才能领取演示器材。',
  '本轮展位申请仅限获准社团。你的社团尚未获准，不能提交展位申请。另请保存活动联系编号。',
  '请在2026年11月13日09:25前上传志愿服务统计表。统计表须为PDF，文件名包含小组编号。看到平台显示接收成功才算办结。培训说明会2026年11月14日14:20开始，15:35结束。',
  '请核对储物柜编号。本通知没有截止日期，不需要准备附件，也没有活动安排。',
] as const
const none = (): CoverageClaim => ({ status: 'not_stated', entityIds: [], scopeIds: [] })
/** Author-built legal examples. These are not model outputs or independent truth. */
export async function createGenerationFixture(number: number, identity?: {sourceId:string;sourceVersionId:string}) {
  if (number < 1 || number > GENERATION_SOURCES.length) throw Error('GENERATION_FIXTURE_NUMBER')
  const sourceText = GENERATION_SOURCES[number-1], sourceId=identity?.sourceId ?? `C19-DEV-S0${number}`, sourceVersionId=identity?.sourceVersionId ?? sourceId+'-v1'
  const context={index:await indexImmutableScopesV11(sourceId,sourceVersionId,sourceText),referenceTime:'2026-10-03T09:00:00+08:00',timezone:'Asia/Shanghai'}
  const scope=(fragment:string)=>{const s=context.index.scopes.find(s=>s.text.includes(fragment));if(!s)throw Error('GENERATION_SOURCE_FRAGMENT:'+fragment);return s.id}
  const facts:SourceContractV4={schemaVersion:SOURCE_CONTRACT_VERSION,tasks:[],materials:[],timePoints:[],events:[],revisions:[],conflicts:[],scopeAccounting:[],prerequisiteStates:[]}
  const task=(id:string,action:string,object:string,fragment:string)=>{
    const sid=scope(fragment), t:SourceContractV4['tasks'][number]={id,propositionScopeIds:[sid],semantics:{actor:'addressee',speechAct:'directive',polarity:'affirmative',tense:'future',status:'pending',validity:'active',modality:'required'},inferenceLevel:'explicit',actionType:'other',action:{surface:action,scopeId:sid},object:{surface:object,scopeId:sid},effect:'local_change',detail:{parentTempId:null,hierarchyType:'task',title:action+object,description:'',completionCriteria:[],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],confidence:1,userConfirmationRequired:true},condition:{value:'not_applicable',conditionScopeIds:[],factScopeIds:[]},coverage:{time:none(),material:none(),event:none()}};facts.tasks.push(t);return t
  }
  const point=(id:string,rawText:string,type:SourceContractV4['timePoints'][number]['type'],fragment:string,relatedTaskTempIds:string[]=[])=>{const p={tempId:id,type,rawText,relatedTaskTempIds,relatedMaterialTempIds:[],scopeIds:[scope(fragment)],confidence:1};facts.timePoints.push(p);return p}
  const event=(id:string,title:string,start:string,end:string|null,fragments:string[])=>facts.events.push({tempId:id,title,description:'',location:null,startTimePointTempId:start,endTimePointTempId:end,relatedTaskTempIds:[],scopeIds:fragments.map(scope),confidence:1,inferenceLevel:'explicit'})
  if(number===1){point('P1','周日晚间','event_start','校园失物');event('E1','校园失物查询网站','P1',null,['校园失物'])}
  if(number===2){point('P1','2026年11月12日10:10','event_start','开放实验');point('P2','11:40','event_end','11:40');event('E1','开放实验室说明会','P1','P2',['开放实验','11:40']);point('P3','周五夜间','event_start','网络调试');point('P4','恢复时间尚未公布','event_end','恢复时间');event('E2','网络调试','P3','P4',['网络调试','恢复时间'])}
  if(number===3){task('T1','填写','场地使用登记','先填写');const t=task('T2','递交','场地使用登记','填好之后');t.detail.dependencyTempIds=['T1'];facts.prerequisiteStates.push({taskId:'T2',predecessorId:'T1',completion:'unknown',factScopeIds:[]});const q=task('T3','领取','演示器材','符合资格');q.condition={value:'unknown',conditionScopeIds:[scope('符合资格')],factScopeIds:[scope('资格还未')]}}
  // Explicitly inapplicable and prohibited action remains information, never a current task.
  if(number===4)task('T1','保存','活动联系编号','另请保存')
  if(number===5){const t=task('T1','上传','志愿服务统计表','请在');t.propositionScopeIds.push(scope('统计表须'),scope('文件名'),scope('看到平台'));t.detail.completionCriteria=['看到平台显示接收成功才算办结'];facts.materials.push({tempId:'M1',name:'统计表',required:true,formatRequirements:['PDF'],namingRequirements:['小组编号'],quantity:null,submissionChannel:null,relatedTaskTempIds:['T1'],scopeIds:[scope('统计表须'),scope('文件名')],confidence:1});t.coverage.material={status:'present',entityIds:['M1'],scopeIds:[scope('统计表须'),scope('文件名')]};point('P0','2026年11月13日09:25前','submission_deadline','请在',['T1']);t.coverage.time={status:'present',entityIds:['P0'],scopeIds:[scope('请在')]};point('P1','2026年11月14日14:20','event_start','培训说明');point('P2','15:35','event_end','15:35');event('E1','培训说明会','P1','P2',['培训说明','15:35'])}
  if(number===6){const t=task('T1','核对','储物柜编号','请核对');t.coverage.time={status:'explicit_none',entityIds:[],scopeIds:[scope('没有截止')]};t.coverage.material={status:'explicit_none',entityIds:[],scopeIds:[scope('不需要')]};t.coverage.event={status:'explicit_none',entityIds:[],scopeIds:[scope('没有活动')]}}
  for(const s of context.index.scopes){const events=facts.events.filter(e=>e.scopeIds.includes(s.id)),tasks=facts.tasks.filter(t=>t.propositionScopeIds.includes(s.id)),primary=events.length?events.map(e=>e.tempId):tasks.map(t=>t.id);facts.scopeAccounting.push({scopeId:s.id,kind:events.length?'event':tasks.length?'action':'information',primaryEntityIds:primary,secondaryEntityIds:primary.length?[...facts.materials,...facts.timePoints].filter(e=>e.scopeIds.includes(s.id)).map(e=>e.tempId):[]})}
  const rawHttpText=JSON.stringify({model:'deepseek-flash',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(facts)}]}],usage:{input_tokens:0,output_tokens:0}})
  return {sourceText,context,facts,rawHttpText,role:'ENGINEERING_FIXTURE_NOT_MODEL_OUTPUT' as const}
}
