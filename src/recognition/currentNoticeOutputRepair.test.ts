import {describe,it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {decodeCurrentSourceRecording} from './conditionalNonActionProduct'
import {assembleCurrentFirstSuggestion,groundMaterialChannels} from './materialChannelGrounding'
import {indexImmutableScopesV11} from './scopeIndexV11'
import {createContractFixture} from '../experiments/d26Recorded/contractFixtures'
import {assembleRecognitionFirstSuggestionD26} from './firstSuggestionD26'
import {rangeEndpointSupport} from './rangeEndpointSupport'
import {emptyWorkspace} from '../experiments/mainline01/fixtures'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {CapturePersistenceService} from '../domain/v2/capture'
import {IndexedDbWorkspaceRepository} from '../lib/repository'
import {buildSourceReviewPlan,commitSourceReview,verifySourceReviewReadback,sourceReviewProblem} from '../domain/v2/sourceReviewD26'
import {rebindRecordedScopes} from './recordedProjectionD26'
const root='docs/recognition-optimization/candidate19-public-development/current-notice-diagnostic/'
const sources=JSON.parse(readFileSync(root+'SOURCES.json','utf8')).sources as Array<{sourceId:string;sourceVersionId:string;sourceText:string;referenceTime:string;timezone:string}>
const raw=(n:number)=>(JSON.parse(readFileSync(root+`paid-evidence/raw-${String(n).padStart(2,'0')}.json`,'utf8')) as {rawHttpText:string}).rawHttpText
async function recorded(n:number){const s=sources[n-1],context={index:await indexImmutableScopesV11(s.sourceId,s.sourceVersionId,s.sourceText),referenceTime:s.referenceTime,timezone:s.timezone};return {s,context,decoded:decodeCurrentSourceRecording(raw(n),'Candidate19',context)}}
describe('actual first-output repair, not new model scoring',()=>{
 it('keeps explicit registration label/URL and permits only the unconditionally supported task in one real transaction',async()=>{
  const {s,context,decoded}=await recorded(2),first=assembleCurrentFirstSuggestion(decoded.result,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone})
  expect(first.materialChannelAudit.decisions[0].status).toBe('EXPLICIT_CHANNEL')
  expect(first.result.materials[0].submissionChannel).toBe('学工系统“暑假离留校登记”应用（https://xmuxg.xmu.edu.cn/app/182）')
  expect(first.result.standaloneTasks.map(t=>t.selected)).toEqual([true,false,false])
  expect(sourceReviewProblem(first.result,'task-0001')).toBeUndefined()
  const store=new MemoryWorkspaceRecordStore(),repo=new CanonicalWorkspaceRepository(store);await repo.initialize(emptyWorkspace())
  const capture=new CapturePersistenceService(repo),h=await capture.beginCapture({operationId:crypto.randomUUID(),rawText:s.sourceText,sourceType:'text',title:'实际录制登记回归',provider:'manual',modelName:'fixed-recording',promptVersion:'Candidate19',pipelineVersion:'current-output-repair'})
  const index=await indexImmutableScopesV11(h.sourceId,h.sourceVersionId,s.sourceText)
  await capture.recognize(h,async()=>assembleCurrentFirstSuggestion(decodeCurrentSourceRecording(rebindRecordedScopes(raw(2),context.index,index).reboundHttpText,'Candidate19',{index,referenceTime:s.referenceTime,timezone:s.timezone}).result,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone}).result)
  const w=(await repo.load())!,view=(await new IndexedDbWorkspaceRepository(repo).load())!.drafts.find(d=>d.id===h.draftId)!
  const receipt=await commitSourceReview(repo,buildSourceReviewPlan(w,view)),back=await verifySourceReviewReadback(new CanonicalWorkspaceRepository(store),receipt)
  expect(receipt.disposition).toBe('partial');expect(back.tasks).toHaveLength(1);expect(back.materials).toHaveLength(1);expect(back.projects).toHaveLength(0)
  expect(back.materials[0].submissionChannel).toBe(first.result.materials[0].submissionChannel)
  expect(back.timePoints[0]).toMatchObject({normalizedValue:'2026-07-16',precision:'date_only',rawText:'7月16日前'})
 })
 it.each([1,4])('keeps actual request %i with contradictory graph rejected, without guessing edges',async n=>{await expect(recorded(n)).rejects.toThrow('SOURCE_CONTRACT_COVERAGE_ENTITY')})
 it('preserves the original declared event end rather than nulling its lossless cited year expansion',async()=>{
  const {s,decoded}=await recorded(3),first=assembleCurrentFirstSuggestion(decoded.result,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone})
  expect(first.result.timePoints.find(p=>p.type==='event_end')).toMatchObject({normalizedValue:'2026-07-10',precision:'date_only',rawText:'2026年7月10日',needsConfirmation:false})
  expect(first.result.events[0].title).toBe('活动时间：2026年7月6日-7月10日')
  expect(first.result.events).toHaveLength(4) // Extra semantic events remain errors, not silently merged to pass.
  expect(decoded.sidecar.displayAudit.rangeSupport).toHaveLength(1)
 })
 it.each([
  ['请通过青禾应用完成住宿信息登记（https://example.edu/app/18）。','青禾应用（https://example.edu/app/18）',true],
  ['请在青禾应用登记住宿信息。','青禾应用',true],
  ['请勿通过青禾应用完成住宿信息登记（https://example.edu/app/18）。','青禾应用（https://example.edu/app/18）',false],
  ['若通过青禾应用完成住宿信息登记（https://example.edu/app/18）。','青禾应用（https://example.edu/app/18）',false],
  ['请通过青禾应用完成活动照片登记（https://example.edu/app/18）。','青禾应用（https://example.edu/app/18）',false],
  ['请通过青禾应用完成住宿信息登记（https://example.edu/app/18）。','青禾应用（https://evil.example/18）',false],
  ['请通过青禾应用完成住宿信息登记（https://example.edu/app/18）。不得通过青禾应用完成住宿信息登记（https://example.edu/app/18）。','青禾应用（https://example.edu/app/18）',false],
 ] as const)('registration source role %s rejects swapped URL/object, condition and contradiction',async(quote,channel,ok)=>{
  const f=await createContractFixture('deadline'),result=decodeCurrentSourceRecording(f.rawHttpText,'EngineeringFixture',f.context).result
  result.standaloneTasks[0].actionObject='住宿信息';result.materials[0].name='住宿信息';result.materials[0].submissionChannel=channel
  result.evidence.forEach(e=>{e.quote=quote})
  const p=groundMaterialChannels(result,quote)
  expect(p.result.materials[0].submissionChannel).toBe(ok?channel:null)
 })
 it.each([
  ['2027年2月15日','event_end','2027年2月11日至15日',true],
  ['2027年3月1日','event_end','2027年2月27日至3月1日',true],
  ['2027年2月16日','event_end','2027年2月11日至15日',false],
  ['2027年2月15日','event_start','2027年2月11日至15日',false],
  ['2027年2月15日','task_deadline','2027年2月11日至15日',false],
  ['2027年1月2日','event_end','2027年12月30日至1月2日',false],
 ] as const)('cited endpoint %s/%s has no wrong date/type or guessed cross-year', (rawText,type,quote,ok)=>{expect(Boolean(rangeEndpointSupport(rawText,type,[quote],'2027-01-01T09:00:00+08:00','Asia/Shanghai'))).toBe(ok)})
 it('does not borrow a range from an unrelated event or unrelated source evidence',async()=>{
  const {s,decoded}=await recorded(3),result=structuredClone(decoded.result),end=result.timePoints.find(t=>t.type==='event_end')!
  result.events[0].evidenceIds=[]
  const p=assembleRecognitionFirstSuggestionD26(result,{sourceText:s.sourceText,referenceTime:s.referenceTime,timezone:s.timezone})
  expect(p.result.timePoints.find(t=>t.tempId===end.tempId)!.normalizedValue).toBeNull()
 })
})
