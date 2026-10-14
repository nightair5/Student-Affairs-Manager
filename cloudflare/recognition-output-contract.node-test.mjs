import test from 'node:test'
import assert from 'node:assert/strict'
import {recognitionOutputSchema,productGenerationContract,PRODUCT_CONTRACT_PROMPT_VERSION} from './recognition-output-contract.mjs'
import {recognitionSystemPrompt,normalizeRecognitionResult} from './recognition.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'
import {parseRecognitionJson} from './recognition-json.mjs'
const source='请于2026年10月22日18:00前向课程平台提交报告PDF。说明会于2026年10月23日14:00开始。'
const r={schemaVersion:'2.0',promptVersion:PRODUCT_CONTRACT_PROMPT_VERSION,modelName:'deepseek-v4-flash',createdAt:'2026-10-14T08:30:00+08:00',sourceSummary:{title:'报告与说明会',sourceType:'text',notificationType:'material_submission',summary:'提交报告和说明会信息',requiresAction:true,actionReason:'原文明示提交报告'},projectMatch:{decision:'standalone_task',matchedProjectId:null,suggestedProjectTitle:null,confidence:.9,reasons:[]},projectSuggestion:null,milestones:[],standaloneTasks:[{tempId:'T1',parentTempId:null,hierarchyType:'task',title:'提交报告',actionVerb:'提交',actionObject:'报告',description:'提交报告PDF至课程平台',completionCriteria:['提交报告PDF'],estimatedMinutes:null,statusSuggestion:'todo',prioritySuggestion:'medium',dependencyTempIds:[],materialTempIds:['M1'],timePointTempIds:['P1'],evidenceIds:['Q'],confidence:.9,inferenceLevel:'explicit',userConfirmationRequired:true,selected:false}],materials:[{tempId:'M1',name:'报告',required:true,formatRequirements:['PDF'],namingRequirements:[],quantity:null,submissionChannel:'课程平台',relatedTaskTempIds:['T1'],evidenceIds:['Q'],confidence:.9,selected:false}],timePoints:[{tempId:'P1',type:'submission_deadline',rawText:'2026年10月22日18:00',normalizedValue:'2026-10-22T18:00:00+08:00',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:['T1'],relatedMaterialTempIds:['M1'],evidenceIds:['Q'],confidence:.9,selected:false},{tempId:'P2',type:'event_start',rawText:'2026年10月23日14:00',normalizedValue:'2026-10-23T14:00:00+08:00',timezone:'Asia/Shanghai',isAllDay:false,precision:'exact',needsConfirmation:false,relatedTaskTempIds:[],relatedMaterialTempIds:[],evidenceIds:['Q'],confidence:.9,selected:false}],events:[{tempId:'E1',title:'说明会',description:'说明会信息',startTimePointTempId:'P2',endTimePointTempId:null,location:null,relatedTaskTempIds:[],evidenceIds:['Q'],confidence:.9,inferenceLevel:'explicit',selected:false}],evidence:[{id:'Q',sourceId:'pending-source',quote:source,field:'description',extractionMethod:'ai',confidence:.9}],conflicts:[],ambiguities:[],ignoredContent:[],quality:{overallConfidence:.9,hierarchyConfidence:.9,dateConfidence:.9,evidenceCoverage:.9,duplicateRisk:0,overFragmentationRisk:0,missingActionRisk:0,needsHumanReview:false,reviewReasons:[]}}
test('full generation fields are accepted by the real product validator',()=>{
 assert.equal(validateRecognitionResult(r,{sourceContent:source}).valid,true)
 assert.deepEqual(Object.keys(recognitionOutputSchema.properties).sort(),Object.keys(r).sort())
 for(const [name,item]of [['standaloneTasks',r.standaloneTasks[0]],['materials',r.materials[0]],['timePoints',r.timePoints[0]],['events',r.events[0]]])assert.deepEqual(Object.keys(recognitionOutputSchema.properties[name].items.properties).sort(),Object.keys(item).sort())
})
test('wrong enum, absent field, foreign owner and nonliteral evidence still fail',()=>{
 for(const mutate of [x=>x.timePoints[0].type='deadline',x=>delete x.materials[0].formatRequirements,x=>x.materials[0].relatedTaskTempIds=['FOREIGN'],x=>x.evidence[0].quote='虚构内容',x=>x.standaloneTasks[0].completionCriteria='字符串']){const x=structuredClone(r);mutate(x);assert.equal(validateRecognitionResult(x,{sourceContent:source}).valid,false)}
})
test('new contract remains opt-in until a nonregression decision; legacy default remains exact',()=>{
 assert.equal(recognitionSystemPrompt().includes(productGenerationContract()),false)
 assert.equal(recognitionSystemPrompt({productContract:true}).includes(JSON.stringify(recognitionOutputSchema)),true)
 assert.equal(recognitionSystemPrompt().includes('promptVersion=recognition-2.0.0'),true)
})
test('normalization preserves declared leading action and an explicit unselected state',()=>{
 const x=structuredClone(r);x.standaloneTasks[0].title='保留提交回执';x.standaloneTasks[0].actionVerb='保留';x.standaloneTasks[0].actionObject='提交回执';x.standaloneTasks[0].selected=false
 const y=normalizeRecognitionResult(x,source,x.createdAt)
 assert.equal(y.standaloneTasks[0].actionVerb,'保留');assert.equal(y.standaloneTasks[0].title,'保留提交回执');assert.equal(y.standaloneTasks[0].selected,false)
 const z=structuredClone(r);z.standaloneTasks[0].title='领取报名表';z.standaloneTasks[0].actionVerb='领取';z.standaloneTasks[0].actionObject='报名表';assert.equal(normalizeRecognitionResult(z,source,z.createdAt).standaloneTasks[0].actionVerb,'领取')
})
test('one JSON-only fenced container is lossless; mixed prose and multiple containers reject',()=>{
 assert.deepEqual(parseRecognitionJson('```json\n'+JSON.stringify(r)+'\n```'),r)
 assert.throws(()=>parseRecognitionJson('建议如下：\n'+JSON.stringify(r)))
 assert.throws(()=>parseRecognitionJson('```json\n{}\n```\n```json\n{}\n```'))
 assert.throws(()=>parseRecognitionJson('[{}]'))
 const invalid=structuredClone(r);delete invalid.materials[0].formatRequirements;assert.equal(validateRecognitionResult(parseRecognitionJson('```json\n'+JSON.stringify(invalid)+'\n```')).valid,false)
})
