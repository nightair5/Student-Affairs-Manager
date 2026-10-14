import {describe,it,expect} from 'vitest'
import {ordinaryWorkflowFixture} from './ordinaryProviderSupport.fixture'
import {assembleCurrentFirstSuggestion} from './materialChannelGrounding'
import {retainCurrentDeadlineFacts} from './sourceCurrentFacts'
import {rangeEndpointSupport} from './rangeEndpointSupport'
function revised(){
 const source='本学年回执截止由2026年11月3日改为2026年11月6日17:00，旧截止作废。请上传本学年回执。',r=ordinaryWorkflowFixture(source),t=r.standaloneTasks[0];r.evidence=[{id:'Q',sourceId:'pending-source',quote:source,field:'deadline'}];t.evidenceIds=['Q'];t.timePointTempIds=['OLD','NEW'];r.materials=[];t.materialTempIds=[];r.timePoints=[{tempId:'OLD',type:'submission_deadline',rawText:'2026年11月3日',normalizedValue:'2026-11-03',timezone:'Asia/Shanghai',isAllDay:true,precision:'date_only',needsConfirmation:false,relatedTaskTempIds:[t.tempId],relatedMaterialTempIds:[],evidenceIds:['Q'],confidence:.9,selected:true},{tempId:'NEW',type:'submission_deadline',rawText:'2026年11月6日17:00',normalizedValue:'2026-11-06T17:00',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[t.tempId],relatedMaterialTempIds:[],evidenceIds:['Q'],confidence:.9,selected:true}];return {source,r}
}
describe('source currentness and owner-cited endpoint composition',()=>{
 it('same-object explicitly replaced old cutoff is retained in audit, not offered as a current deadline',()=>{
  const {r,source}=revised(),copy=structuredClone(r),out=assembleCurrentFirstSuggestion(r,{sourceText:source,referenceTime:'2026-10-14T08:00:00+08:00',timezone:'Asia/Shanghai'});expect(r).toEqual(copy);expect(out.result.timePoints.map(p=>p.tempId)).toEqual(['NEW']);expect(out.result.standaloneTasks[0].timePointTempIds).toEqual(['NEW']);expect(out.audit.sourceCurrentness[0]).toMatchObject({entityId:'OLD',before:{normalizedValue:'2026-11-03'}});expect(out.result.ignoredContent[0].text).toBe(source)
 })
 it.each(['no cancellation','foreign owner','missing replacement','ambiguous old occurrence'])('does not remove %s by guess',mode=>{
  const {r,source}=revised();let text=source;if(mode==='no cancellation'){text=source.replace('旧截止作废','旧截止需核对');r.evidence[0].quote=text}if(mode==='foreign owner'){const other={...structuredClone(r.standaloneTasks[0]),tempId:'OTHER',actionObject:'不同对象',timePointTempIds:['OLD']};r.standaloneTasks.push(other);r.timePoints[0].relatedTaskTempIds=['OTHER']}if(mode==='missing replacement')r.timePoints.pop();if(mode==='ambiguous old occurrence')text+='另一活动为2026年11月3日。';expect(retainCurrentDeadlineFacts(r,text)).toEqual([])
 })
 it('shared closed date range chooses its declared endpoint; wrong role/backward/uncited remains unsupported',()=>{
  const raw='线上培训时间为2026年11月7日至9日';expect(rangeEndpointSupport(raw,'event_end',[raw],'2026-10-14T09:00:00+08:00','Asia/Shanghai')?.expanded).toBe('2026年11月9日');expect(rangeEndpointSupport(raw,'submission_deadline',[raw],'2026-10-14T09:00:00+08:00','Asia/Shanghai')).toBeNull();expect(rangeEndpointSupport(raw,'event_end',['其他时间'],'2026-10-14T09:00:00+08:00','Asia/Shanghai')).toBeNull();expect(rangeEndpointSupport('2026年11月9日至7日','event_end',['2026年11月9日至7日'],'2026-10-14T09:00:00+08:00','Asia/Shanghai')).toBeNull()
 })
})
