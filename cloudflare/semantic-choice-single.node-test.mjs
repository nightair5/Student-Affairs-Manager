import test from 'node:test'
import assert from 'node:assert/strict'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'

const source='电子版申请表11月5日17:00前上传资料平台，纸质版申请表11月7日12:00前交服务台，两种方式任选一种。'
const facts=()=>({topic:'申请表提交',kind:'action',items:[{key:'submission',kind:'task',title:'提交申请表（电子版或纸质版任选一种）',action:'提交',object:'申请表',status:'active',evidence:['电子版申请表11月5日17:00前上传资料平台','纸质版申请表11月7日12:00前交服务台','两种方式任选一种'],times:[{role:'deadline',raw:'11月5日17:00前'},{role:'deadline',raw:'11月7日12:00前'}],channel:'资料平台（电子版）；服务台（纸质版）',materials:['form'],requirements:['任选一项：电子版申请表于11月5日17:00前上传资料平台；或纸质版申请表于11月7日12:00前交服务台'],dependsOn:[]}],materials:[{key:'form',name:'申请表',formats:['电子版','纸质版'],quantity:null,naming:[],requirements:['两种方式任选一种'],channel:'资料平台（电子版）；服务台（纸质版）',owners:['submission'],evidence:['电子版申请表11月5日17:00前上传资料平台','纸质版申请表11月7日12:00前交服务台','两种方式任选一种']}],sharedRequirements:[]})
const compile=(raw,text=source)=>compileSemanticNotice(raw,{source:text,referenceTime:'2026-11-03T02:00:00Z',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.2.0'})

test('a model-combined choice becomes two independently timed source-backed alternatives',()=>{
 const input=facts(),snapshot=structuredClone(input),{result,audit}=compile(input)
 assert.deepEqual(input,snapshot)
 assert.deepEqual(result.standaloneTasks.map(task=>task.title),['提交电子版申请表','提交纸质版申请表'])
 assert.deepEqual(result.timePoints.map(time=>time.normalizedValue),['2026-11-05T17:00','2026-11-07T12:00'])
 assert.deepEqual(result.materials.map(material=>material.submissionChannel),['资料平台','服务台'])
 assert.deepEqual(result.materials.map(material=>material.formatRequirements),[['电子版'],['纸质版']])
 assert.equal(result.conflicts.filter(conflict=>conflict.id.startsWith('sem-choice-')).length,1)
 assert.ok(audit.facts.some(fact=>fact.role==='choice_expanded'))
})

test('an ambiguous destination does not create or attach a guessed option',()=>{
 const input=facts();input.items[0].channel='资料平台（电子版）；服务台（电子版）'
 const {result,audit}=compile(input)
 assert.equal(result.standaloneTasks.length,1)
 assert.ok(!audit.facts.some(fact=>fact.role==='choice_expanded'))
 assert.ok(result.timePoints.every(point=>point.normalizedValue===null))
})

test('branch citations on a shared material retain separate channels, deadlines and the choice relation',()=>{
 const text='提交登记表任选一种：电子件11月8日17:00前发事务邮箱，纸质件11月9日12:00前交事务窗口，不必两种都提交。'
 const input={topic:'登记表提交',kind:'action',items:[{key:'submission',kind:'task',title:'提交登记表',action:'提交',object:'登记表',evidence:[text],times:[{role:'deadline',raw:'11月8日17:00前'},{role:'deadline',raw:'11月9日12:00前'}],channel:'事务邮箱或事务窗口',materials:['form'],requirements:['任选一项：电子件11月8日17:00前发事务邮箱，或纸质件11月9日12:00前交事务窗口','不必两种都提交'],dependsOn:[]}],materials:[{key:'form',name:'登记表',formats:['电子件','纸质件'],channel:'事务邮箱（电子件）；事务窗口（纸质件）',owners:['submission'],evidence:['电子件11月8日17:00前发事务邮箱','纸质件11月9日12:00前交事务窗口'],requirements:['电子件11月8日17:00前发事务邮箱','纸质件11月9日12:00前交事务窗口']}]}
 const {result,audit}=compile(input,text)
 assert.deepEqual(result.standaloneTasks.map(task=>task.title),['提交电子件登记表','提交纸质件登记表'])
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-11-08T17:00','2026-11-09T12:00'])
 assert.deepEqual(result.materials.map(material=>material.submissionChannel),['事务邮箱','事务窗口'])
 assert.equal(result.conflicts.filter(conflict=>conflict.id.startsWith('sem-choice-')).length,1)
 assert.ok(!audit.losses.some(loss=>loss.reason==='CHOICE_OPTIONS_NOT_UNIQUELY_GROUNDED'))
 const contradictory=text.replace('不必两种都提交','两种都要提交')
 assert.ok(!compile(input,contradictory).audit.facts.some(fact=>fact.role==='choice_expanded'))
})

test('a separately cited choice does not override an explicit all-required statement',()=>{
 const mandatory='电子版申请表11月5日17:00前上传资料平台，纸质版申请表11月7日12:00前交服务台，均须提交，两种方式任选一种。'
 const {audit}=compile(facts(),mandatory)
 assert.ok(!audit.facts.some(fact=>fact.role==='choice_expanded'))
})

test('the same relation works for different form labels and destinations',()=>{
 const text='线上版登记表11月5日17:00前上传服务平台，线下版登记表11月7日12:00前交咨询窗口，两种方式任选一种。'
 const input=facts(),replace=value=>typeof value==='string'?value.replaceAll('电子版','线上版').replaceAll('纸质版','线下版').replaceAll('申请表','登记表').replaceAll('资料平台','服务平台').replaceAll('服务台','咨询窗口'):Array.isArray(value)?value.map(replace):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,replace(v)])):value
 const {result}=compile(replace(input),text)
 assert.deepEqual(result.standaloneTasks.map(task=>task.title),['提交线上版登记表','提交线下版登记表'])
 assert.deepEqual(result.materials.map(material=>material.submissionChannel),['服务平台','咨询窗口'])
 assert.equal(result.conflicts.filter(conflict=>conflict.id.startsWith('sem-choice-')).length,1)
})

test('model-labelled windows in an explicitly candidate-slot survey never become opening times',()=>{
 const text='候选讲座时段为12月4日9:00和12月6日14:00，最终时间待定。请填写参加时间调查表。'
 const input={topic:'参加时间调查',kind:'action',items:[{key:'survey',kind:'task',title:'填写参加时间调查表',action:'填写',object:'参加时间调查表',evidence:['请填写参加时间调查表'],times:[{role:'window',raw:'12月4日9:00'},{role:'window',raw:'12月6日14:00'}],requirements:['候选讲座时段为12月4日9:00和12月6日14:00','最终时间待定']}],materials:[]}
 const {result,audit}=compile(input,text)
 assert.equal(result.standaloneTasks.length,1);assert.equal(result.events.length,0);assert.equal(result.timePoints.length,0)
 assert.match(result.standaloneTasks[0].description,/候选讲座时段/)
 assert.doesNotMatch(result.standaloneTasks[0].description,/办理时段/)
 assert.equal(audit.facts.filter(fact=>fact.role==='alternative').length,2)
 const withoutRequirements=structuredClone(input);withoutRequirements.items[0].requirements=[]
 const incomplete=compile(withoutRequirements,text).result
 assert.equal(incomplete.events.length,0);assert.equal(incomplete.timePoints.length,0)
 assert.match(incomplete.standaloneTasks[0].description,/备选时间/)
})

test('a material cited only in an explicit condition remains conditional with the source wording',()=>{
 const text='请到服务台领取资料。若他人代领，须携带授权书。'
 const input={topic:'领取资料',kind:'action',items:[{key:'pickup',kind:'task',title:'领取资料',action:'领取',object:'资料',evidence:['请到服务台领取资料'],materials:['letter']}],materials:[{key:'letter',name:'授权书',owners:['pickup'],evidence:['须携带授权书'],requirements:[]}]}
 const {result}=compile(input,text)
 assert.equal(result.materials[0].required,false)
 assert.deepEqual(result.materials[0].requirements,['若他人代领，须携带授权书'])
})

test('an unrelated earlier condition does not make an unconditional material optional',()=>{
 const text='请到服务台领取资料。若尚未登记请先登记，所有同学均须携带身份证。'
 const input={topic:'领取资料',kind:'action',items:[{key:'pickup',kind:'task',title:'领取资料',action:'领取',object:'资料',evidence:['请到服务台领取资料'],materials:['id']}],materials:[{key:'id',name:'身份证',owners:['pickup'],evidence:['所有同学均须携带身份证'],requirements:[]}]}
 const {result}=compile(input,text)
 assert.equal(result.materials[0].required,true)
 assert.deepEqual(result.materials[0].requirements,[])
})

test('an overflowing material keeps the condition visible and marks incompleteness',()=>{
 const details=Array.from({length:20},(_,index)=>`格式约束${String.fromCharCode(65+index)}`)
 const text=`请领取资料。${details.join('、')}。若他人代领须携带授权书。`
 const input={topic:'领取资料',kind:'action',items:[{key:'pickup',kind:'task',title:'领取资料',action:'领取',object:'资料',evidence:['请领取资料'],materials:['letter']}],materials:[{key:'letter',name:'授权书',owners:['pickup'],evidence:[details.join('、'),'若他人代领须携带授权书'],requirements:details}]}
 const {result,audit}=compile(input,text)
 assert.equal(result.materials[0].required,false)
 assert.ok(result.materials[0].requirements.includes('若他人代领须携带授权书'))
 assert.ok(audit.losses.some(loss=>loss.reason==='MATERIAL_REQUIREMENT_OVERFLOW'))
})

test('a source-backed agenda heading supplies one shared date to separately cited sessions',()=>{
 const text='12月8日安排：9:00—10:00在甲室开展作品分享，10:30—11:30在乙室开展经验交流。'
 const input={topic:'活动安排',kind:'event',items:[{key:'first',kind:'event',title:'作品分享',evidence:['12月8日安排：9:00—10:00在甲室开展作品分享'],times:[{role:'start',raw:'9:00—10:00'},{role:'end',raw:'9:00—10:00'}],location:'甲室'},{key:'second',kind:'event',title:'经验交流',evidence:['10:30—11:30在乙室开展经验交流'],times:[{role:'start',raw:'10:30—11:30'},{role:'end',raw:'10:30—11:30'}],location:'乙室'}],materials:[]}
 const {result}=compile(input,text)
 assert.deepEqual(result.timePoints.map(point=>point.normalizedValue),['2026-12-08T09:00','2026-12-08T10:00','2026-12-08T10:30','2026-12-08T11:30'])
 assert.deepEqual(result.events.map(event=>event.location),['甲室','乙室'])
})

test('a prior deadline is not a shared agenda date for a later clock',()=>{
 const text='报名截止12月8日：请参加10:30的经验交流，日期另行通知。'
 const input={topic:'经验交流',kind:'event',items:[{key:'event',kind:'event',title:'经验交流',evidence:['10:30的经验交流'],times:[{role:'start',raw:'10:30'}]}],materials:[]}
 const {result}=compile(input,text)
 assert.ok(result.timePoints.every(point=>!point.normalizedValue));assert.equal(result.events[0].startTimePointTempId,null)
})
