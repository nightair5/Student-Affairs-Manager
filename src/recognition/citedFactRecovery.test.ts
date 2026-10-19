import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {parseRecognitionResult} from './schema'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
import {projectCitedTimeLayouts} from './citedLayoutSupport'

const context=(sourceText:string)=>({sourceText,referenceTime:'2027-03-01T09:00:00+08:00',timezone:'Asia/Shanghai'})
function range(){
  const literal='4\n月\n6\n日\n—\n4\n月\n9\n日\n10:00—15:30',source='领取工具包时间：'+literal+'。',r=ordinaryWorkflowFixture(source)
  r.standaloneTasks=[];r.materials=[];r.evidence=[{id:'R',sourceId:'pending-source',quote:source,field:'event'}]
  r.timePoints=['event_start','event_end'].map((type,i)=>({tempId:'p'+i,type:type as 'event_start'|'event_end',rawText:'4月6日—4月9日10:00—15:30',normalizedValue:'2027-04-06T10:00',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:['R'],confidence:1,selected:true}))
  r.events=[{tempId:'E',title:'领取工具包',description:source,startTimePointTempId:'p0',endTimePointTempId:'p1',location:null,relatedTaskTempIds:[],evidenceIds:['R'],confidence:1,inferenceLevel:'explicit',selected:true}]
  return {source,r,literal}
}
function courses(){
  const names=['《城市与河流》','《科学写作》'],intro='MOOC'+names.join('\n')+'将于2027年4月2日开始网络学习，请同学完成课程学习。',learning='学习时间：2027年4月2日—2027年4月20日',exam='考试时间：2027年4月21日—2027年4月28日',source=intro+'\n'+learning+'\n'+exam,r=ordinaryWorkflowFixture(source),base=r.standaloneTasks[0]
  r.materials=[];r.standaloneTasks=names.map((name,i)=>({...base,tempId:'t'+i,title:'完成'+name+'课程学习',actionVerb:'完成',actionObject:name+'课程学习',description:intro,materialTempIds:[],timePointTempIds:['l0','l1'],evidenceIds:['n'+i,'V','L']}))
  r.evidence=names.map((name,i)=>({id:'n'+i,sourceId:'pending-source',quote:name,field:'title' as const})).concat([{id:'V',sourceId:'pending-source',quote:'将于2027年4月2日开始网络学习，请同学完成课程学习。',field:'description' as 'title'},{id:'L',sourceId:'pending-source',quote:learning,field:'deadline' as 'title'},{id:'X',sourceId:'pending-source',quote:exam,field:'event' as 'title'}])
  r.timePoints=[['l0','event_start',learning,'L',['t0','t1']],['l1','event_end',learning,'L',['t0','t1']],['x0','event_start',exam,'X',[]],['x1','event_end',exam,'X',[]]].map(([id,type,raw,proof,owners])=>({tempId:id as string,type:type as 'event_start'|'event_end',rawText:raw as string,normalizedValue:null,timezone:'Asia/Shanghai',isAllDay:true,precision:'date_only',needsConfirmation:true,relatedTaskTempIds:owners as string[],relatedMaterialTempIds:[],evidenceIds:[proof as string],confidence:1,selected:false}))
  r.events=[{tempId:'exam',title:'MOOC'+names.join('')+'考试',description:exam,startTimePointTempId:'x0',endTimePointTempId:'x1',location:null,relatedTaskTempIds:[],evidenceIds:['X'],confidence:1,inferenceLevel:'explicit',selected:true}]
  return {source,r,names}
}
describe('existing facts survive literal typography and closed course scopes',()=>{
  it('projects both ends from the same unchanged pair rather than only repairing the first array member',()=>{
    const {source,r,literal}=range(),audit=projectCitedTimeLayouts(r,source)
    expect(audit.decisions).toHaveLength(2);expect(r.timePoints.map(p=>p.rawText)).toEqual([literal,literal])
  })
  it('maps a continuous date/clock range back to its own original bytes and keeps its two actual ends',()=>{
    const {source,r,literal}=range(),before=structuredClone(r),first=assembleCurrentFirstSuggestion(parseRecognitionResult(r),context(source))
    expect(first.result.timePoints.map(p=>p.normalizedValue)).toEqual(['2027-04-06T10:00','2027-04-09T15:30'])
    expect(first.result.timePoints.every(p=>p.rawText===literal)).toBe(true);expect(first.audit.citedTimeLayouts).toBeDefined();expect(r).toEqual(before)
  })
  it.each(['wrong date','foreign evidence','ambiguous span','missing pair','deadline'])('does not use layout to repair %s',kind=>{
    const {r,source}=range();let text=source
    if(kind==='wrong date')r.timePoints.forEach(p=>p.rawText=p.rawText.replace('6日','7日'))
    if(kind==='foreign evidence')r.timePoints.forEach(p=>p.evidenceIds=['other'])
    if(kind==='ambiguous span')text+='\n'+source
    if(kind==='missing pair')r.events[0].endTimePointTempId=null
    if(kind==='deadline')r.timePoints[0].type='submission_deadline'
    const out=assembleCurrentFirstSuggestion(r,context(text));expect(out.audit.citedTimeLayouts?.decisions).toHaveLength(0)
  })
  it('retains two existing course actions and the collective exam, with separate date precision',()=>{
    const {source,r,names}=courses(),before=structuredClone(r),first=assembleCurrentFirstSuggestion(parseRecognitionResult(r),context(source))
    expect(first.result.standaloneTasks.map(t=>t.title)).toEqual(names.map(n=>'完成'+n+'课程学习'))
    expect(first.result.events[0].title).toBe('MOOC'+names.join('')+'考试')
    expect(first.result.events).toHaveLength(1);expect(first.result.timePoints.map(p=>p.normalizedValue)).toEqual(['2027-04-02','2027-04-20','2027-04-21','2027-04-28'])
    expect(first.result.timePoints.every(p=>p.precision==='date_only'&&!p.normalizedValue?.includes('T'))).toBe(true)
    expect(first.audit.citedCourseScope?.decisions).toHaveLength(3);expect(r).toEqual(before)
  })
  it('retains a Chinese course name wrapped inside the book-title marks without treating English word joining as typography',()=>{
    const f=courses();f.source=f.source.replace('《科学写作》','《科学\n写作》');f.r.evidence[1].quote='《科学\n写作》'
    const first=assembleCurrentFirstSuggestion(f.r,context(f.source));expect(first.result.standaloneTasks[1].title).toBe('完成《科学写作》课程学习');expect(first.result.events[0].title).toBe(f.r.events[0].title)
    const e=courses();e.source=e.source.replace('《科学写作》','《Data Science》');e.r.evidence[1].quote='《Data Science》';e.r.standaloneTasks[1].actionObject='《DataScience》课程学习'
    expect(assembleCurrentFirstSuggestion(e.r,context(e.source)).result.standaloneTasks[1].selected).toBe(false)
  })
  it.each(['different course','only one exam','separate dates','intervening course','cancelled exam','unannounced exam','missing predicate','foreign source'])('keeps the collective boundary for %s',kind=>{
    const {source,r}=courses();let text=source
    if(kind==='different course')r.standaloneTasks[0].actionObject='《化学》课程学习'
    if(kind==='only one exam'){text=text.replace('考试时间：','《城市与河流》考试时间：');r.evidence.at(-1)!.quote='《城市与河流》'+r.evidence.at(-1)!.quote}
    if(kind==='separate dates'){text=text.replace('考试时间：','《城市与河流》考试时间：')+'\n《科学写作》考试时间：2027年5月1日';r.evidence.at(-1)!.quote='《城市与河流》'+r.evidence.at(-1)!.quote}
    if(kind==='intervening course')text=text.replace('\n考试时间','\n另开《化学》课程。\n考试时间')
    if(kind==='cancelled exam'){text=text.replace('考试时间：','考试时间：已取消，');r.evidence.at(-1)!.quote=r.evidence.at(-1)!.quote.replace('考试时间：','考试时间：已取消，')}
    if(kind==='unannounced exam'){text=text.replace('考试时间：2027年4月21日—2027年4月28日','考试时间：待定');r.evidence.at(-1)!.quote='考试时间：待定'}
    if(kind==='missing predicate')r.standaloneTasks.forEach(t=>t.evidenceIds=t.evidenceIds.filter(id=>id!=='V'))
    if(kind==='foreign source')r.evidence.filter(e=>e.id.startsWith('n')).forEach(e=>e.sourceId='foreign-source')
    const first=assembleCurrentFirstSuggestion(r,context(text))
    if(['different course','missing predicate','foreign source'].includes(kind))expect(first.result.standaloneTasks[0].selected).toBe(false)
    if(!['different course','missing predicate'].includes(kind))expect(first.audit.citedCourseScope?.decisions.some(d=>d.entityId==='exam')).toBe(false)
  })
})
