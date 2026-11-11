import test from 'node:test'
import assert from 'node:assert/strict'
import {parseDirectSourceTime} from './direct-source-time.mjs'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'

const options={referenceTime:'2026-11-11T09:00:00+08:00',timezone:'Asia/Shanghai',type:'task_deadline'}
test('units and recurrences do not turn academic weeks, class numbers or counts into dates',()=>{
 for(const raw of ['每学期1-17周每周一、二下午14：30-17：30受理','第1—17周','1-17班','需要1-17页','每周五下午领取']){
  const parsed=parseDirectSourceTime(raw,options)
  assert.equal(parsed.normalizedValue,null,raw)
  assert.equal(parsed.rangeEndNormalizedValue,null,raw)
  assert.equal(parsed.rawText,raw)
 }
 assert.equal(parseDirectSourceTime('1-17班于11月20日17:00前提交',options).normalizedValue,'2026-11-20T17:00')
 assert.equal(parseDirectSourceTime('每周一受理；11月20日17:00前提交申请',options).normalizedValue,'2026-11-20T17:00')
 assert.equal(parseDirectSourceTime('自11月20日起每周一受理',options).normalizedValue,null)
 assert.equal(parseDirectSourceTime('11月20日24:00前',options).normalizedValue,'2026-11-21T00:00')
 assert.equal(parseDirectSourceTime('11月20日至11月25日前',options).normalizedValue,'2026-11-25')
})

const source='助学项目资助延期申请通知\n现将申请延长助学项目资助期限的有关工作通知如下。\n适用对象\n本项目受助学生\n办理流程\n登录学籍平台办理学籍延期。\n4月20日前在资助平台提交年度报告。\n5月15日前在资助平台提交延长期限申请。\n如委托他人办理，须提供委托书（PDF版）。'
const fixture=()=>({topic:'助学项目资助延期申请通知',kind:'action',items:[
 {key:'a',kind:'task',title:'办理学籍延期',action:'办理',object:'学籍延期',evidence:['登录学籍平台办理学籍延期']},
 {key:'b',kind:'task',title:'提交年度报告',action:'提交',object:'年度报告',evidence:['4月20日前在资助平台提交年度报告'],times:[{role:'deadline',raw:'4月20日前'}]},
 {key:'c',kind:'task',title:'提交延长期限申请',action:'提交',object:'延长期限申请',evidence:['5月15日前在资助平台提交延长期限申请'],times:[{role:'deadline',raw:'5月15日前'}]},
 ],materials:[{key:'proxy',name:'委托书',formats:['PDF'],required:false,owners:[],evidence:['如委托他人办理，须提供委托书（PDF版）']}],
 goals:[{key:'extension',title:'申请延长助学项目资助期限',anchor:'延长',evidence:'申请延长助学项目资助期限的有关工作',taskKeys:['a','b','c']}]})
const opts=(s=source)=>({...options,source:s,promptVersion:'recognition-semantic-notice-3.11.0',goalContextVersion:'1.0.31'})
test('cited prose goal preserves abbreviated members, their deadlines and unassigned source materials',()=>{
 const {result,audit}=compileSemanticNotice(fixture(),opts())
 assert.equal(audit.compilerVersion,'semantic-notice-compiler-1.0.31')
 assert.equal(result.goalGroups?.[0].taskTempIds.length,3)
 assert.equal(result.standaloneTasks.length,3)
 assert.deepEqual(result.timePoints.map(p=>p.normalizedValue),['2026-04-20','2026-05-15'])
 assert.equal(result.materials.length,1)
 assert.deepEqual(result.materials[0].relatedTaskTempIds,[])
 assert.ok(result.materials[0].requirements.includes('适用事项待关联'))
 assert.ok(result.materials[0].requirements.some(r=>r.includes('委托他人')))
 assert.equal(result.quality.needsHumanReview,true)
 const old=compileSemanticNotice(fixture(),{...opts(),goalContextVersion:'1.0.29'})
 assert.equal(old.result.goalGroups,undefined)
 assert.equal(old.result.materials.length,0)
})
test('a generic introduction or a new notice cannot establish membership across independent goals',()=>{
 const generic=fixture();generic.topic='本周事项';generic.goals[0]={...generic.goals[0],title:'本周事项',anchor:'事项',evidence:'有关事项'}
 assert.equal(compileSemanticNotice(generic,opts(source.replace('申请延长助学项目资助期限的有关工作','有关事项'))).result.goalGroups,undefined)
 const changed=source.replace('5月15日前','【宿舍服务】\n5月15日前')
 const bounded=compileSemanticNotice(fixture(),opts(changed))
 assert.equal(bounded.result.goalGroups[0].taskTempIds.length,2)
 assert.ok(bounded.audit.losses.some(l=>l.reason==='GOAL_MEMBER_UNRESOLVED'))
})
