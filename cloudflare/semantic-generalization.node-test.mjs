import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {sourceSupportedDependency} from './semantic-relations.mjs'
import {validateRecognitionResult} from './recognition-contract.generated.mjs'

const options={referenceTime:'2027-01-01T09:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.31'}
const compile=(source,items)=>compileSemanticNotice({topic:'匿名事项',kind:'action',items,materials:[]},{...options,source})
const task=(key,title,action,object,evidence,extra={})=>({key,kind:'task',title,action,object,evidence:[evidence],...extra})

test('an actor repeated in the document can be grounded inside its uniquely cited action',()=>{
 const source='学生先查看通知。学生凭登记证明提交报名表。'
 const quote='学生凭登记证明提交报名表'
 const {result,audit}=compile(source,[task('form','提交报名表','提交','报名表',quote,{assignment:{scope:'audience',actor:'学生',evidence:quote,actorEvidence:'学生'}})])
 assert.equal(result.standaloneTasks.length,1)
 assert.doesNotMatch(result.standaloneTasks[0].description,/执行人未能从通知中确定/u)
 assert.equal(audit.losses.some(loss=>loss.reason==='ACTOR_EVIDENCE_UNRESOLVED'),false)
})

test('possessive or repeated mentions in one quote are not enough to identify the actor',()=>{
 for(const [source,quote] of [['学生的表格由老师提交。学生查看进度。','学生的表格由老师提交'],['学生通知其他学生填写表格。学生查看反馈。','学生通知其他学生填写表格'],['学生凭证由老师提交。学生查看结果。','学生凭证由老师提交']]){
  const {result,audit}=compile(source,[task('form','提交表格','提交','表格',quote,{assignment:{scope:'audience',actor:'学生',evidence:quote,actorEvidence:'学生'}})])
  assert.equal(result.standaloneTasks[0].userConfirmationRequired,true)
  assert.ok(audit.losses.some(loss=>loss.reason==='ACTOR_EVIDENCE_UNRESOLVED'))
 }
})

test('a processing window does not replace its independently specified deadline',()=>{
 const source='服务窗口4月1日至4月7日开放；申请截止4月5日17:00。'
 const {result}=compile(source,[task('apply','提交申请','提交','申请','申请截止4月5日17:00',{evidence:['服务窗口4月1日至4月7日开放','申请截止4月5日17:00'],times:[{role:'window',raw:'4月1日至4月7日'},{role:'deadline',raw:'4月5日17:00'}]})])
 const points=result.timePoints.filter(point=>point.relatedTaskTempIds.includes(result.standaloneTasks[0].tempId))
 assert.equal(points.find(point=>point.type==='task_deadline')?.normalizedValue,'2027-04-05T17:00')
 assert.ok(!points.some(point=>point.type==='task_deadline'&&/2027-04-0[17]/u.test(point.normalizedValue??'')))
})

test('same cited sentence can support an explicit dependency even with an inserted qualifier in the second action',()=>{
 const source='领取材料后，到办公室加盖单位公章。',quote='领取材料后，到办公室加盖单位公章'
 const parent=task('take','领取材料','领取','材料',quote)
 const child=task('stamp','加盖公章','加盖公章','材料',quote,{dependencyEvidence:quote,dependsOn:['take']})
 assert.equal(sourceSupportedDependency(source,parent,child),true)
 const {result}=compile(source,[parent,child])
 assert.deepEqual(result.standaloneTasks[1].dependencyTempIds,[result.standaloneTasks[0].tempId])
})

test('conjunction, alternatives and negation cannot be turned into dependencies',()=>{
 for(const quote of ['领取材料并到办公室加盖单位公章','领取材料或到办公室加盖单位公章','领取材料后不必加盖单位公章','领取材料后不必加盖公章','先领取材料，然后无需加盖公章','领取材料后请不要重新加盖单位公章','领取材料后可以加盖或取消公章']){
  const parent=task('take','领取材料','领取','材料',quote)
  const child=task('stamp','加盖公章','加盖公章','材料',quote,{dependencyEvidence:quote,dependsOn:['take']})
  assert.equal(sourceSupportedDependency(quote+'。',parent,child),false,quote)
 }
 const source='先领取材料，然后无需加盖公章。'
 const first=task('take','领取材料','领取','材料','先领取材料')
 const second=task('stamp','加盖公章','加盖公章','材料','然后无需加盖公章',{dependencyEvidence:'先领取材料，然后无需加盖公章',dependsOn:['take']})
 assert.equal(sourceSupportedDependency(source,first,second),false)
})

test('source-cited task-level naming requirements are retained for an unambiguous single delivery',()=>{
 const source='请提交作品。作品背面需注明姓名与学院。',quote='作品背面需注明姓名与学院'
 const {result}=compile(source,[task('work','提交作品','提交','作品','请提交作品',{naming:[quote]})])
 assert.ok(result.standaloneTasks[0].completionCriteria.includes(quote))
 assert.ok(result.standaloneTasks[0].evidenceIds.some(id=>result.evidence.find(e=>e.id===id)?.quote===quote))
})

test('a task-level naming requirement cannot be fabricated or copied across incompatible deliveries',()=>{
 const source='请提交电子版报名表和纸质版报名表。电子版文件名注明编号。',quote='电子版文件名注明编号'
 const {result}=compile(source,[
  task('electronic','提交电子版报名表','提交','报名表','请提交电子版报名表和纸质版报名表',{deliveryForm:'电子版',evidence:['请提交电子版报名表和纸质版报名表',quote],naming:[quote,'文件名写密码']}),
  task('paper','提交纸质版报名表','提交','报名表','请提交电子版报名表和纸质版报名表',{deliveryForm:'纸质版',evidence:['请提交电子版报名表和纸质版报名表',quote],naming:[quote]}),
 ])
 assert.ok(result.standaloneTasks[0].completionCriteria.includes(quote))
 assert.ok(!result.standaloneTasks[0].completionCriteria.includes('文件名写密码'))
 assert.ok(!result.standaloneTasks[1].completionCriteria.includes(quote))
})

test('an unrelated event instruction is not assigned to the only task merely because it is the only task',()=>{
 const source='请提交论文。讲座入场券上注明姓名。',quote='讲座入场券上注明姓名'
 const {result,audit}=compile(source,[task('paper','提交论文','提交','论文','请提交论文',{naming:[quote]})])
 assert.ok(!result.standaloneTasks[0].completionCriteria.includes(quote))
 assert.ok(audit.losses.some(loss=>loss.reason==='TASK_NAMING_OWNER_UNRESOLVED'))
})

test('many task-level requirements remain bounded and explicitly partial without invalidating the saved item',()=>{
 const naming=Array.from({length:25},(_,i)=>`作品背面标注第${i+1}项信息`),source='请提交作品。'+naming.join('。')+'。'
 const {result,audit}=compile(source,[task('work','提交作品','提交','作品','请提交作品',{naming})])
 assert.equal(result.standaloneTasks.length,1)
 assert.ok(result.standaloneTasks[0].evidenceIds.length<=20)
 assert.equal(validateRecognitionResult(result,{sourceContent:source}).valid,true)
 assert.equal(result.quality.needsHumanReview,true)
 assert.ok(audit.losses.some(loss=>loss.reason==='TASK_NAMING_INPUT_OVERFLOW'||loss.reason==='TASK_NAMING_EVIDENCE_OVERFLOW'))
})
