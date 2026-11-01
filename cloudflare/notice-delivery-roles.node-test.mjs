import test from 'node:test'
import assert from 'node:assert/strict'
import {compileTwoStep} from './recognition-two-step-compiler-v2-1-16.mjs'
import {noticeDeliveryRoles} from './notice-delivery-roles.mjs'

const source='【关于提交实验结项报告的通知】\n一、适用范围：已完成实验的研究小组。\n二、材料要求：请填写《实验结项报告》，名单按贡献排序；文件名为“项目号+小组名+结项报告”。\n三、邮件正文要求：邮件正文注明所有成员已确认结果。\n四、提交方式：请在11月9日18:00前将Word版及PDF版实验结项报告一同提交至管理邮箱\u00a0lab@example.edu。'
const raw={items:[{id:'a',kind:'任务',name:'开具实验结项报告',quote:'关于提交实验结项报告的通知'},{id:'b',kind:'任务',name:'提交结项报告材料',quote:'提交方式'}],facts:[{type:'条件',quote:'已完成实验的研究小组',item:'a'},{type:'材料',quote:'请填写《实验结项报告》',item:'a'},{type:'材料',quote:'名单按贡献排序',item:'a'},{type:'截止',quote:'11月9日18:00前',item:'b'},{type:'材料',quote:'Word版及PDF版实验结项报告',item:'b'},{type:'渠道',quote:'管理邮箱 lab@example.edu',item:'b'}],noAction:false}
const compile=(text=source)=>compileTwoStep(raw,{source:text,referenceTime:'2026-11-01T04:00:00Z',timezone:'Asia/Shanghai',version:'recognition-two-step-2.4.0'})
test('role sections preserve a single delivery, both formats and editable requirements',()=>{
 const c=compile(),r=c.result
 assert.equal(r.standaloneTasks.length,1);assert.equal(r.events.length,0)
 assert.equal(r.standaloneTasks[0].actionObject,'实验结项报告')
 assert.equal(r.timePoints[0].normalizedValue,'2026-11-09T18:00')
 assert.deepEqual(r.materials[0].formatRequirements,['Word','PDF'])
 assert.ok(r.materials[0].submissionChannel.includes('lab@example.edu'))
 assert.ok(r.standaloneTasks[0].description.includes('名单按贡献排序'))
 assert.ok(r.standaloneTasks[0].description.includes('邮件正文注明所有成员已确认结果'))
 assert.ok(r.materials[0].namingRequirements.some(x=>x.includes('项目号+小组名+结项报告')))
 for(const e of r.evidence)assert.equal(source.slice(e.textStart,e.textEnd),e.quotedText)
 assert.equal(r.standaloneTasks[0].selected,false)
})
test('ordinary, emoji and unnumbered role labels carry the same delivery facts',()=>{
 for(const text of [source,source.replaceAll('一、','1️⃣ ').replaceAll('二、','2️⃣\u00a0').replaceAll('三、','3️⃣ ').replaceAll('四、','4️⃣'),source.replace(/[一二三四]、/gu,'')]){
  const group=noticeDeliveryRoles(text);assert.equal(group.delivery.object,'实验结项报告');assert.deepEqual(group.delivery.formats,['Word','PDF'])
 }
})
test('independent destinations, optional formats and cancelled delivery do not become one obligation',()=>{
 assert.equal(noticeDeliveryRoles(source.replace('一同提交','任选一种格式提交')),null)
 assert.equal(noticeDeliveryRoles(source.replace('请在11月9日18:00前将','请勿将')),null)
 assert.equal(noticeDeliveryRoles(source+'\n五、提交方式：请将结项报告提交至另一邮箱 other@example.edu。'),null)
})
