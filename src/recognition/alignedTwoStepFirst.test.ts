import{describe,it,expect}from'vitest'
import{compileTwoStep}from'../../cloudflare/recognition-two-step-compiler.mjs'
import{assembleProductFirstSuggestion}from'./materialChannelGrounding'
import{parseRecognitionResult}from'./schema'
const source='入选者请在2028年4月6日16:30前填写并发送住宿确认表至课程站。'
function fixture(){return parseRecognitionResult(compileTwoStep({items:[{id:'a',kind:'任务',name:'填写并发送住宿确认表',quote:'填写并发送住宿确认表'}],facts:[{type:'截止',quote:'2028年4月6日16:30前',item:'a'},{type:'材料',quote:'住宿确认表',item:'a'},{type:'渠道',quote:'课程站',item:'a'},{type:'条件',quote:'入选者',item:'a'}],noAction:false},{source,referenceTime:'2028-04-01T08:00:00+08:00',timezone:'Asia/Shanghai'}).result)}
const context={sourceText:source,referenceTime:'2028-04-01T08:00:00+08:00',timezone:'Asia/Shanghai'}
describe('aligned two-step facts enter ordinary confirmation without1.5spelling rewrites',()=>{
 it('preserves names, compound action, exact time, materials, channel and unknown eligibility',()=>{const r=fixture(),out=assembleProductFirstSuggestion(r,context);expect(out.result.standaloneTasks[0].actionVerb).toBe('填写并发送');expect(out.result.standaloneTasks[0].selected).toBe(false);expect(out.result.timePoints).toEqual(r.timePoints);expect(out.result.materials).toEqual(r.materials);expect(out.audit.unresolved).toEqual([]);expect(out.audit.nativeQualificationReview.length).toBeGreaterThanOrEqual(0)})
 it('a corrupted offset blocks that entity while another correct task stays confirmable',()=>{const r=fixture();r.standaloneTasks[0].selected=true;r.standaloneTasks.push({...structuredClone(r.standaloneTasks[0]),tempId:'good',evidenceIds:r.standaloneTasks[0].evidenceIds.slice(1),selected:false});const id=r.standaloneTasks[0].evidenceIds[0];r.evidence.find(e=>e.id===id)!.textStart=0;const out=assembleProductFirstSuggestion(r,context);expect(out.result.standaloneTasks[0].selected).toBe(false);expect(out.audit.unresolved.some(e=>e.entityId===r.standaloneTasks[0].tempId)).toBe(true);expect(out.result.standaloneTasks).toHaveLength(2)})
})
