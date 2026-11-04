import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'

const options={referenceTime:'2026-11-03T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'}
const task=(evidence)=>({key:'send',kind:'task',title:'提交登记表',action:'提交',object:'登记表',evidence:[evidence],times:[],materials:[]})

test('a uniquely scoped optional attachment mentioned by the model and original is not lost',()=>{
 const source='请提交登记表。作品目录如有可附，不提供不影响申请。'
 const raw={topic:'登记表提交',summary:'提交登记表，作品目录可选附上。',kind:'action',items:[task('请提交登记表')],materials:[]}
 const {result,audit}=compileSemanticNotice(raw,{...options,source})
 assert.deepEqual(result.materials.map(m=>[m.name,m.required]),[['作品目录',false]])
 assert.match(result.materials[0].requirements.join(' '),/如有可附/u)
 assert.equal(result.materials[0].relatedTaskTempIds[0],result.standaloneTasks[0].tempId)
 assert.equal(result.evidence.find(e=>e.id===result.materials[0].evidenceIds[0]).extractionMethod,'parser')
 assert.ok(audit.facts.some(f=>f.role==='source_backed_optional_material'))
})

test('examples, ungrounded summaries and multiple task owners never create a guessed attachment',()=>{
 const source='请提交登记表。课程感想如有可附。请提交成绩单。'
 const one={topic:'提交材料',summary:'作品目录可选附上',kind:'action',items:[task('请提交登记表')],materials:[]}
 assert.equal(compileSemanticNotice(one,{...options,source}).result.materials.length,0)
 const multi={...one,summary:'课程感想可选附上',items:[task('请提交登记表'),{...task('请提交成绩单'),key:'other',object:'成绩单'}]}
 assert.equal(compileSemanticNotice(multi,{...options,source}).result.materials.length,0)
})

test('a sole topic-scoped document window remains separate from the cutoff',()=>{
 const source='材料受理时间11月5日至11月18日。请于11月12日17:00前提交登记表。'
 const raw={topic:'登记材料受理',summary:'材料受理时间11月5日至11月18日，登记表11月12日17:00前提交。',kind:'action',items:[{...task('请于11月12日17:00前提交登记表'),times:[{role:'deadline',raw:'11月12日17:00前'}]}],materials:[]}
 const {result}=compileSemanticNotice(raw,{...options,source})
 assert.deepEqual(result.timePoints.map(p=>[p.type,p.normalizedValue]),[['task_deadline','2026-11-12T17:00'],['event_start','2026-11-05'],['event_end','2026-11-18']])
 assert.ok(result.timePoints.slice(1).every(p=>p.isAllDay&&p.precision==='date_only'))
})

test('a window belonging to a different subject is not attached to the task',()=>{
 const source='借阅办理时间11月5日至11月18日。请于11月12日17:00前提交登记表。'
 const raw={topic:'登记表提交',summary:'借阅办理时间11月5日至11月18日，登记表11月12日17:00前提交。',kind:'action',items:[{...task('请于11月12日17:00前提交登记表'),times:[{role:'deadline',raw:'11月12日17:00前'}]}],materials:[]}
 const {result}=compileSemanticNotice(raw,{...options,source})
 assert.deepEqual(result.timePoints.map(p=>p.type),['task_deadline'])
})

test('a topic-wide in-person window is not attached to a separately routed online delivery',()=>{
 const source='现场材料受理时间11月5日至11月18日。请于11月12日17:00前通过线上系统提交登记表。'
 const raw={topic:'现场材料受理',summary:'现场材料受理时间11月5日至11月18日，线上登记表11月12日17:00前提交。',kind:'action',items:[{...task('请于11月12日17:00前通过线上系统提交登记表'),channel:'线上系统',times:[{role:'deadline',raw:'11月12日17:00前'}]}],materials:[]}
 const {result}=compileSemanticNotice(raw,{...options,source})
 assert.deepEqual(result.timePoints.map(p=>p.type),['task_deadline'])
})

test('the same material can be required for one delivery and optional for another',()=>{
 const source='电子版须提交推荐信；纸质版推荐信如有可附。'
 const raw={topic:'材料提交',kind:'action',items:[
  {key:'online',kind:'task',title:'提交电子版推荐信',action:'提交',object:'推荐信',deliveryForm:'电子版',evidence:['电子版须提交推荐信'],materials:['letter']},
  {key:'paper',kind:'task',title:'提交纸质版材料',action:'提交',object:'纸质版材料',deliveryForm:'纸质版',evidence:['纸质版推荐信如有可附'],materials:['letter']},
 ],materials:[{key:'letter',name:'推荐信',required:true,owners:['online','paper'],formats:[],requirements:[],evidence:['电子版须提交推荐信','纸质版推荐信如有可附']}]}
 const {result}=compileSemanticNotice(raw,{...options,source})
 const online=result.standaloneTasks.find(value=>value.title.includes('电子版')),paper=result.standaloneTasks.find(value=>value.title.includes('纸质版'))
 const onlineUse=result.materials.find(value=>value.relatedTaskTempIds.includes(online.tempId)),paperUse=result.materials.find(value=>value.relatedTaskTempIds.includes(paper.tempId))
 assert.equal(onlineUse.required,true);assert.equal(paperUse.required,false)
 assert.match(paperUse.requirements.join(' '),/如有可附/u)
})

test('a heading-only window with a model-linked owner does not become a duplicate action',()=>{
 const source='证明办理：受理时段为11月8日09:00至11月22日17:00。\n材料要求：请于11月19日12:00前提交证明申请表。'
 const raw={topic:'证明办理',summary:'证明办理受理时段11月8日09:00至11月22日17:00，证明申请表11月19日12:00前提交。',kind:'action',items:[
  {key:'form',kind:'task',title:'提交证明申请表',action:'提交',object:'证明申请表',evidence:['请于11月19日12:00前提交证明申请表'],times:[{role:'deadline',raw:'11月19日12:00前'}],materials:[]},
  {key:'window',kind:'task',title:'办理证明',action:'办理',object:'证明',evidence:['证明办理：受理时段为11月8日09:00至11月22日17:00'],times:[{role:'window',raw:'11月8日09:00至11月22日17:00'}],dependsOn:['form'],materials:[]},
 ],materials:[]}
 const {result,audit}=compileSemanticNotice(raw,{...options,source})
 assert.equal(result.standaloneTasks.length,1)
 assert.deepEqual(result.timePoints.map(point=>point.type),['task_deadline','event_start','event_end'])
 assert.ok(audit.facts.some(fact=>fact.role==='heading_window_owner'))
 const extra=source+'请办理证明。'
 assert.equal(compileSemanticNotice(raw,{...options,source:extra}).result.standaloneTasks.length,2)
})

test('a model-backed voluntary attachment can be recovered without making it required',()=>{
 const source='请提交登记表。若有作品目录可自愿附上，不提供不影响申请。'
 const raw={topic:'登记表提交',summary:'登记表须提交，作品目录可自愿附上。',kind:'action',items:[task('请提交登记表')],materials:[]}
 const {result}=compileSemanticNotice(raw,{...options,source})
 assert.deepEqual(result.materials.map(material=>[material.name,material.required]),[['作品目录',false]])
})

test('an optional attachment is the object submitted, not the condition for having it',()=>{
 const source='请提交个人总结。总结可以包含实习收获等内容；如有公开发表作品，可另附作品目录。'
 const raw={topic:'个人总结',summary:'提交个人总结，如有公开发表作品可另附作品目录。',kind:'action',items:[{...task('总结可以包含实习收获等内容'),object:'个人总结'}],materials:[]}
 const {result}=compileSemanticNotice(raw,{...options,source})
 assert.deepEqual(result.materials.map(material=>[material.name,material.required]),[['作品目录',false]])
 assert.match(result.materials[0].requirements.join(' '),/如有公开发表作品/u)
})

test('an explicitly attachable optional document is retained but a prohibition is not',()=>{
 const source='请提交登记表。可另附说明材料。'
 const raw={topic:'登记表',summary:'提交登记表，可另附说明材料。',kind:'action',items:[task('请提交登记表')],materials:[]}
 const {result}=compileSemanticNotice(raw,{...options,source})
 assert.deepEqual(result.materials.map(material=>[material.name,material.required]),[['说明材料',false]])
 const prohibited='请提交登记表。不得附说明材料。'
 assert.equal(compileSemanticNotice(raw,{...options,source:prohibited}).result.materials.length,0)
})

test('a preferred route and a conditional backup share one source-backed delivery choice',()=>{
 const source='优先在11月21日17:00前通过系统上传登记表。如系统无法使用，可在11月22日12:00前将纸质登记表交至服务台。无需两种都提交。'
 const raw={topic:'登记表提交',kind:'action',items:[
  {key:'online',kind:'task',title:'通过系统上传登记表',action:'上传',object:'登记表',channel:'系统',evidence:['优先在11月21日17:00前通过系统上传登记表'],times:[{role:'deadline',raw:'11月21日17:00前'}],requirements:['任选一项：系统或纸质提交'],materials:['online-form']},
  {key:'paper',kind:'task',title:'交纸质登记表',action:'提交',object:'纸质登记表',channel:'服务台',evidence:['如系统无法使用，可在11月22日12:00前将纸质登记表交至服务台'],times:[{role:'deadline',raw:'11月22日12:00前'}],requirements:['任选一项：系统或纸质提交','如系统无法使用'],materials:['paper-form']},
 ],materials:[
  {key:'online-form',name:'登记表',owners:['online'],evidence:['系统上传登记表']},
  {key:'paper-form',name:'纸质登记表',owners:['paper'],evidence:['纸质登记表交至服务台']},
 ]}
 const {result}=compileSemanticNotice(raw,{...options,source})
 assert.equal(result.conflicts.filter(conflict=>conflict.id.startsWith('sem-choice-')).length,1)
 assert.ok(result.standaloneTasks.find(item=>item.title.includes('系统')).completionCriteria.includes('优先使用此方式'))
 assert.ok(result.standaloneTasks.find(item=>item.title.includes('纸质')).completionCriteria.some(value=>value.includes('系统无法使用')))
 const mandatory=source.replace('无需两种都提交','两种都必须提交')
 assert.equal(compileSemanticNotice(raw,{...options,source:mandatory}).result.conflicts.filter(conflict=>conflict.id.startsWith('sem-choice-')).length,0)
})

test('source wording that only one delivery method is needed joins two cited branches',()=>{
 const source='登记表只需选一种方式递交。电子版11月23日16:00前上传系统；纸质版11月24日11:00前交服务台。'
 const shared='任选一项：电子版或纸质版'
 const raw={topic:'登记表提交',kind:'action',items:[
  {key:'e',kind:'task',title:'提交电子版登记表',action:'提交',object:'登记表',deliveryForm:'电子版',channel:'系统',evidence:['电子版11月23日16:00前上传系统'],times:[{role:'deadline',raw:'11月23日16:00前'}],requirements:[shared],materials:['em']},
  {key:'p',kind:'task',title:'提交纸质版登记表',action:'提交',object:'登记表',deliveryForm:'纸质版',channel:'服务台',evidence:['纸质版11月24日11:00前交服务台'],times:[{role:'deadline',raw:'11月24日11:00前'}],requirements:[shared],materials:['pm']},
 ],materials:[{key:'em',name:'登记表',owners:['e'],evidence:['电子版11月23日16:00前上传系统']},{key:'pm',name:'登记表',owners:['p'],evidence:['纸质版11月24日11:00前交服务台']}]}
 const {result}=compileSemanticNotice(raw,{...options,source})
 assert.equal(result.conflicts.filter(conflict=>conflict.id.startsWith('sem-choice-')).length,1)
 assert.deepEqual(result.timePoints.filter(point=>point.type==='task_deadline').map(point=>point.normalizedValue).sort(),['2026-11-23T16:00','2026-11-24T11:00'])
})
