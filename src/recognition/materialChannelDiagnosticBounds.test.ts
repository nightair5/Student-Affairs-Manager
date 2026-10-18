import{it,expect}from'vitest'
import{groundMaterialChannels}from'./materialChannelGrounding'
import{parseRecognitionResult}from'./schema'
import{decodeCurrentSourceRecording}from'./conditionalNonActionProduct'
import{createChannelRoleFixture}from'../experiments/candidate19Recorded/materialChannelFixtures'
import{sourceEventProblem}from'../domain/v2/sourceReviewD26'
it('a shared unsupported channel preserves every proof and affected owner within bounded conflicts',async()=>{
 const f=await createChannelRoleFixture('prohibited-wu'),r=decodeCurrentSourceRecording(f.rawHttpText,'EngineeringFixture',f.context).result
 const t=r.standaloneTasks[0],m=r.materials[0],source='统计表须为PDF。'+Array.from({length:36},(_,i)=>`第${i+1}项说明。`).join('')
 r.evidence=Array.from({length:36},(_,i)=>({id:'q'+i,sourceId:'same',quote:`第${i+1}项说明。`,field:'materials' as const,extractionMethod:'parser' as const}))
 r.standaloneTasks=Array.from({length:18},(_,i)=>({...structuredClone(t),tempId:'t'+i,evidenceIds:['q'+(i*2),'q'+(i*2+1)]}))
 m.evidenceIds=['q0'];m.submissionChannel='凭空平台';m.relatedTaskTempIds=r.standaloneTasks.map(t=>t.tempId)
 r.standaloneTasks.forEach(t=>{t.materialTempIds=[m.tempId];t.timePointTempIds=[]});r.timePoints=[];r.events=[{tempId:'independent-event',title:'第1项说明',description:'',location:null,startTimePointTempId:null,endTimePointTempId:null,relatedTaskTempIds:[],evidenceIds:['q0'],confidence:1,inferenceLevel:'explicit',selected:true}]
 const p=groundMaterialChannels(r,source),conflicts=p.result.conflicts.filter(c=>c.id.startsWith('material-channel:'))
 expect(conflicts.length).toBe(2);expect(conflicts.every(c=>c.evidenceIds.length<=20&&c.entityTempIds.length>0&&c.entityTempIds.length<=30)).toBe(true)
 expect(new Set(conflicts.flatMap(c=>c.evidenceIds))).toEqual(new Set(r.evidence.map(e=>e.id)))
 expect(new Set(conflicts.flatMap(c=>c.entityTempIds))).toEqual(new Set([m.tempId,...m.relatedTaskTempIds]))
 expect(p.result.standaloneTasks.every(t=>t.selected===false)).toBe(true);expect(p.result.materials[0].submissionChannel).toBeNull();expect(()=>parseRecognitionResult(p.result)).not.toThrow()
 expect(sourceEventProblem(p.result,'independent-event')).toBeUndefined()
})
