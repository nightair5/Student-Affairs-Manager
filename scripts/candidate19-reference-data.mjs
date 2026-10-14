import {sourceContractComponents} from './source-contract-components.mjs'
import {createHash} from 'node:crypto'
import {validateReferenceV7} from './recognition-semantic-v7.mjs'
const sha=v=>createHash('sha256').update(v).digest('hex')
const alias=value=>({canonical:value,aliases:[]})
const policy=ids=>({requiredAnyOf:ids.map(id=>[id]),allowed:ids,contradictory:[]})
/** Values below are source-authored. No parser/adapter output is used for truth. */
export async function makeCandidate19Data(){
  const x=await sourceContractComponents(),sources=[],references=[],oracles=[]
  for(let n=1;n<=6;n++){
    const f=await x.createGenerationFixture(n),idx=f.context.index
    const sid=fragment=>{const s=idx.scopes.find(s=>s.text.includes(fragment));if(!s)throw Error('C19_REFERENCE_FRAGMENT:'+fragment);return s.id}
    const scopes=fragments=>fragments.map(sid),tasks=[],aux=[],timeAssertions=[]
    const task=(id,action,object,fragments,options={})=>{
      const conditionIds=scopes(options.conditionFragments??[]),factIds=scopes(options.factFragments??[]),ids=[...new Set([...scopes(fragments),...conditionIds,...factIds])]
      const t={id,action:alias(action),object:alias(object),actor:'addressee',currentness:'current',condition:options.condition??'not_applicable',conditionScopeIds:conditionIds,factScopeIds:factIds,actionability:options.condition==='unknown'?'needs_confirmation':'actionable',defaultSelection:options.condition==='unknown'?'not_selected':'selected',confirmation:'required',materials:'N/A',times:'N/A',completionStandards:options.completion??'N/A',dependencies:options.dependencies??'N/A',actionScopeIds:[ids[0]],objectScopeIds:[ids[0]],scopeIds:ids,evidencePolicy:{proposition:{...policy([ids[0]]),allowed:ids},condition:policy(conditionIds),fact:policy(factIds)},parentTaskId:null,hierarchyType:'task',materialDetails:[],timeEvidence:[]};tasks.push(t);return t
    }
    const point=(id,rawText,type,value,precision,needsConfirmation,fragment,owners=[])=>{
      const p={tempId:id,rawText,type,normalizedValue:value,timezone:'Asia/Shanghai',isAllDay:precision==='date_only',precision,needsConfirmation,relatedTaskTempIds:owners,relatedMaterialTempIds:[],scopeIds:[sid(fragment)],confidence:1}
      timeAssertions.push({...p,role:'SOURCE_AUTHORED_NOT_ADAPTER_DERIVED'})
      return p
    }
    const event=(id,title,fragments,points)=>{aux.push({id,kind:'event',value:title,aliases:fragments.map(fragment=>idx.scopes.find(s=>s.id===sid(fragment)).text.replace(/[，。]$/u,'')).filter(text=>text.includes(title)),sourceText:title,scopeIds:scopes(fragments),timeFactIds:points.map(p=>p.tempId),locationFactIds:[]});for(const p of points)aux.push({id:p.tempId,kind:'time',value:p.rawText,aliases:[],sourceText:p.rawText,scopeIds:p.scopeIds,time:p})}
    if(n===1)event('E1','校园失物查询网站',['校园失物'],[point('P1','周日晚间','event_start',null,'vague',true,'校园失物')])
    if(n===2){event('E1','开放实验室说明会',['开放实验','11:40'],[point('P1','2026年11月12日10:10','event_start','2026-11-12T10:10','exact',false,'开放实验'),point('P2','11:40','event_end','2026-11-12T11:40','exact',false,'11:40')]);event('E2','网络调试',['网络调试','恢复时间'],[point('P3','周五夜间','event_start',null,'vague',true,'网络调试'),point('P4','恢复时间尚未公布','event_end',null,'vague',true,'恢复时间')])}
    if(n===3){task('T1','填写','场地使用登记',['先填写']);task('T2','递交','场地使用登记',['填好之后'],{dependencies:['T1']});task('T3','领取','演示器材',['符合资格'],{condition:'unknown',conditionFragments:['符合资格'],factFragments:['资格还未']})}
    if(n===4)task('T1','保存','活动联系编号',['另请保存'])
    if(n===5){const t=task('T1','上传','志愿服务统计表',['请在','统计表须','文件名','看到平台'],{completion:['看到平台显示接收成功才算办结']});t.materials=['统计表','PDF','小组编号'];const ids=scopes(['统计表须','文件名']);t.materialDetails=[{tempId:'M1',name:'统计表',required:true,formatRequirements:['PDF'],namingRequirements:['小组编号'],quantity:null,submissionChannel:null,relatedTaskTempIds:['T1'],scopeIds:ids,confidence:1,evidencePolicy:policy(ids)}];const p=point('P0','2026年11月13日09:25前','submission_deadline','2026-11-13T09:25','exact',false,'请在',['T1']);t.times=[p];t.timeEvidence=[{rawText:p.rawText,type:p.type,relatedTaskTempIds:['T1'],evidencePolicy:policy(p.scopeIds)}];event('E1','培训说明会',['培训说明','15:35'],[point('P1','2026年11月14日14:20','event_start','2026-11-14T14:20','exact',false,'培训说明'),point('P2','15:35','event_end','2026-11-14T15:35','exact',false,'15:35')])}
    if(n===6)task('T1','核对','储物柜编号',['请核对'])
    const covered=new Set([...tasks.flatMap(t=>t.scopeIds),...aux.flatMap(a=>a.scopeIds)])
    for(const s of idx.scopes.filter(s=>!covered.has(s.id)))aux.push({id:'I'+(aux.length+1),kind:'information',value:s.text,aliases:[],sourceText:s.text,scopeIds:[s.id]})
    const source={sourceId:idx.sourceId,sourceVersionId:idx.sourceVersionId,sourceText:f.sourceText,sourceSha256:sha(f.sourceText),referenceTime:f.context.referenceTime,timezone:f.context.timezone,role:'NEW_MODEL_ASSISTED_SYNTHETIC_DEVELOPMENT_NOT_HOLDOUT',targets:n<=2?['NO_TASK_EVENT_TIME',...(n===2?['EVENT_ENDPOINT_GRAPH']:[])]:n<=4?['QUALIFICATION_VS_PREREQUISITE']:n===5?['TASK_EVENT_GRAPH','PRECISE_MATERIAL_COMPLETION_CONTROL']:['ORDINARY_TASK_EXPLICIT_NONE_CONTROL']}
    const reference={version:'recognition-reference-7.0.0',sourceId:idx.sourceId,sourceSha256:source.sourceSha256,completeness:'complete',truthStatus:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',author:'Codex single-author source assertions, no model outputs inspected',seenDegree:'NEW_AUTHORED_DEVELOPMENT_SEEN_DURING_ENGINEERING',decisions:['Source values authored independently of adapter; only IDs/scopes mechanically bound','Standalone events do not become tasks; legitimate unknown qualification is a correct retained pending fact'],unresolved:[],representations:[{version:'candidate15-reference-contract-6.0.0',sourceId:idx.sourceId,completeness:'complete',referenceTime:f.context.referenceTime,timezone:f.context.timezone,scopeTextById:Object.fromEntries(idx.scopes.map(s=>[s.id,s.text])),allowedAliases:[],tasks,relations:[],noTaskFacts:aux}],forbiddenActions:n===4?[{action:alias('提交'),object:alias('展位申请'),scopeIds:scopes(['不能提交']),reason:'explicit_prohibition'}]:[],d26DisplayPolicy:{eventContradictions:[]},coverageAssertions:tasks.map(t=>({taskId:t.id,time:n===5?'present':n===6?'explicit_none':'not_stated',material:n===5?'present':n===6?'explicit_none':'not_stated',event:n===6?'explicit_none':'not_stated'})),prerequisiteAssertions:n===3?[{taskId:'T2',predecessorId:'T1',completion:'unknown'}]:[],sourceTimeAssertions:timeAssertions,freeProseAndLeakage:'NOT_ADJUDICATED'}
    if(n===5){
      reference.sourceMaterialAssertions=[{taskId:'T1',names:['统计表','志愿服务统计表'],formatRequirements:['PDF'],namingRequirements:['小组编号'],role:'SOURCE_AUTHORED_NOT_ADAPTER_DERIVED'}]
      // Pre-output author-approved alternative views of the SAME source facts.
      // The cutoff type/value/owner still must match; material names are only
      // the full source name or its unambiguous local shorthand.
      const base=reference.representations[0]
      for(const fullName of [false,true])for(const shortenedTime of [false,true]){
        if(!fullName&&!shortenedTime)continue
        const rep=structuredClone(base),t=rep.tasks[0]
        if(fullName){t.materialDetails[0].name='志愿服务统计表';t.materials=t.materials.slice(1)}
        if(shortenedTime){t.times[0].rawText='2026年11月13日09:25';t.timeEvidence[0].rawText='2026年11月13日09:25'}
        reference.representations.push(rep)
      }
      reference.sourceTimeAssertions.find(p=>p.tempId==='P0').allowedRawTexts=['2026年11月13日09:25前','2026年11月13日09:25']
    }
    validateReferenceV7(reference);sources.push(source);references.push(reference);oracles.push({sourceId:idx.sourceId,role:f.role,facts:f.facts})
  }
  return {'SOURCES.json':{sources},'REFERENCES.json':{references},'LEGAL_CONTRACT_ORACLES.json':{oracles}}
}
