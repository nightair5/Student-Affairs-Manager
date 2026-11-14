import {describe,expect,it} from 'vitest'
import {localMaterialOwnership} from './localMaterialOwnership'
import {buildLocalRecognition} from './pipeline'
import {improveDirectFallback} from './directFallback'
import {isRecognitionResult} from './schema'

const referenceTime=new Date('2026-11-14T09:00:00+08:00')
const local=(text:string)=>buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:text,referenceTime,timezone:'Asia/Shanghai',projects:[],tasks:[]})

describe('format-only local material',()=>{
 it('does not erase a source-backed format or create an invalid empty material name',()=>{
  const source='请于周二上传PDF至课程平台。',input=local(source)
  const task=input.standaloneTasks[0]
  expect(task).toBeTruthy()
  task.actionVerb='上传';task.actionObject='PDF';task.title='上传PDF'
  const id='test-material',ref=input.evidence[0].id
  task.evidenceIds=[ref];task.materialTempIds=[id]
  input.materials=[{tempId:id,name:'PDF',required:true,formatRequirements:[],namingRequirements:[],quantity:null,submissionChannel:'课程平台',relatedTaskTempIds:[task.tempId],evidenceIds:[ref],confidence:1,selected:true}]
  const result=localMaterialOwnership(input,source)
  expect(result.materials[0].name).toBe('PDF')
  expect(result.materials[0].formatRequirements).toContain('PDF')
  expect(result.quality.needsHumanReview).toBe(true)
  expect(result.quality.reviewReasons.join(' ')).toContain('具体提交对象')
  expect(isRecognitionResult(result)).toBe(true)
 })
 it('keeps named materials and their formats distinct',()=>{
  const source='请上传调查报告PDF。',input=local(source),task=input.standaloneTasks[0]
  task.actionVerb='上传';task.actionObject='调查报告PDF';task.title='上传调查报告PDF'
  const id='test-material',ref=input.evidence[0].id
  task.evidenceIds=[ref];task.materialTempIds=[id]
  input.materials=[{tempId:id,name:'调查报告PDF',required:true,formatRequirements:[],namingRequirements:[],quantity:null,submissionChannel:null,relatedTaskTempIds:[task.tempId],evidenceIds:[ref],confidence:1,selected:true}]
  const result=localMaterialOwnership(input,source)
  expect(result.materials[0].name).toBe('调查报告')
  expect(result.materials[0].formatRequirements).toContain('PDF')
 })
 it('keeps a format-only action valid through the complete local fallback',()=>{
  const source='请于周二上传PDF至课程平台。'
  expect(isRecognitionResult(improveDirectFallback(local(source),source,{scopeAware:true}))).toBe(true)
 })
})
