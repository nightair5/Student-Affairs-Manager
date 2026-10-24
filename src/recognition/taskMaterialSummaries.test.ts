import{describe,it,expect}from'vitest'
import{taskMaterialSummaries}from'./taskMaterialSummaries'
import{buildLocalRecognition}from'./pipeline'
function fixture(){const r=buildLocalRecognition({content:'10月30日17:00前提交阅读报告。',sourceTitle:'匿名通知',sourceType:'text',referenceTime:new Date('2026-10-23T10:00:00+08:00'),timezone:'Asia/Shanghai',projects:[],tasks:[]});r.promptVersion='recognition-two-step-2.1.0';const t=r.standaloneTasks[0];r.materials=[{tempId:'m',name:'格式为PDF',required:true,formatRequirements:['格式为PDF','格式为PDF'],namingRequirements:['学号+姓名'],quantity:null,submissionChannel:'课程平台',relatedTaskTempIds:[t.tempId],evidenceIds:[],confidence:1,selected:false}];return{r,t}}
describe('material summary keeps each existing requirement once',()=>{
 it('deduplicates the same name/format but keeps naming and route; never mutates saved data',()=>{const{r,t}=fixture(),old=structuredClone(r);expect(taskMaterialSummaries(r,t.tempId)).toEqual(['格式为PDF · 命名：学号+姓名 · 交至课程平台']);expect(r).toEqual(old)})
 it('keeps differing requirements and distinct owners',()=>{const{r,t}=fixture();r.materials[0].formatRequirements.push('不超过3MB');r.materials.push({...r.materials[0],tempId:'other',name:'另一事项附件',relatedTaskTempIds:['different']});expect(taskMaterialSummaries(r,t.tempId)[0]).toContain('不超过3MB');expect(taskMaterialSummaries(r,t.tempId)).toHaveLength(1)})
 it('legacy summary bytes and conditional selection are preserved',()=>{const{r,t}=fixture();r.promptVersion='recognition-product-contract-1.5.0';expect(taskMaterialSummaries(r,t.tempId)[0]).toContain('格式为PDF · 格式为PDF');expect(r.materials[0].selected).toBe(false)})
})
