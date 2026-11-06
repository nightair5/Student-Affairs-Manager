import test from 'node:test'
import assert from 'node:assert/strict'
import {parseDirectSourceTime} from './direct-source-time.mjs'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {sourceTimeModality} from './semantic-time-context.mjs'

const options={referenceTime:'2026-11-01T10:00:00+08:00',timezone:'Asia/Shanghai',promptVersion:'recognition-semantic-notice-3.7.0'}
const compile=(source,items,materials=[])=>compileSemanticNotice({topic:'匿名通知',kind:'mixed',items,materials},{source,...options})
const event=(source,times,overrides={})=>({key:'e',kind:'event',title:'资料说明会',evidence:[source],times,...overrides})
const task=(source,overrides={})=>({key:'t',kind:'task',title:'提交登记表',action:'提交',object:'登记表',evidence:[source],...overrides})

test('date typography and line layout preserve the same explicit range',()=>{
 for(const date of ['2026年11月9日','2026-11-09','2026.11.09','2026/11/09'])for(const separator of ['—','-','~','～']){
  const raw=date+'\n\u00a0 14：00'+separator+'15：30'
  const value=parseDirectSourceTime(raw,{...options,type:'event_start'})
  assert.equal(value.normalizedValue,'2026-11-09T14:00',raw)
  assert.equal(value.rangeEndNormalizedValue,'2026-11-09T15:30',raw)
  assert.equal(value.rawText,raw)
 }
})
test('typography normalization preserves date validity, midnight and ambiguity checks',()=>{
 for(const raw of ['2026-02-30 14:00','2026/11/09 24:01','2026.11.09（周二）14:00','2026-11-09 14:00或15:00']){
  assert.equal(parseDirectSourceTime(raw,{...options,type:'event_start'}).normalizedValue,null,raw)
 }
 const midnight=parseDirectSourceTime('2026-11-09 23:30~24:00',{...options,type:'event_start'})
 assert.equal(midnight.normalizedValue,'2026-11-09T23:30')
 assert.equal(midnight.rangeEndNormalizedValue,'2026-11-10T00:00')
})
test('model-owned adjacent date and clock fields remain exact; intervening scope does not transfer dates',()=>{
 const source='资料说明会\n时间：2026年11月9日（周一）\n14:00 - 15:30\n地点：二楼'
 const times=[{role:'start',raw:'2026年11月9日（周一）'},{role:'start',raw:'14:00 - 15:30'},{role:'end',raw:'14:00 - 15:30'}]
 assert.deepEqual(compile(source,[event(source,times)]).result.timePoints.map(p=>p.normalizedValue),['2026-11-09T14:00','2026-11-09T15:30'])
 const different='报名截止2026年11月9日。\n资料说明会日期另行通知。\n时间14:00 - 15:30'
 const result=compile(different,[event(different,times.map(t=>({...t,raw:t.raw.replace('（周一）','')})))])
 assert.ok(!result.result.timePoints.some(p=>p.normalizedValue?.includes('T')))
})
test('an explicit cutoff label survives web layout, without using a nearby different deadline',()=>{
 const source='提交登记表。\n提交截止时间为\n11\n月\n9\n日下午\n14\n：\n00。'
 assert.equal(compile(source,[task(source,{times:[{role:'deadline',raw:'11月9日下午14：00'}]})]).result.timePoints[0].normalizedValue,'2026-11-09T14:00')
 const unrelated='登记表截止11月8日。\n参观活动11月9日14:00。'
 assert.equal(compile(unrelated,[task('登记表截止11月8日',{times:[{role:'deadline',raw:'11月9日14:00'}]})]).result.timePoints[0].normalizedValue,null)
})
test('closed from-now application period uses its endpoint, not an ordinary opening window',()=>{
 const source='提交登记表。即日起至11月9日9:00，逾期申报不予受理。'
 assert.equal(compile(source,[task(source,{times:[{role:'deadline',raw:'即日起至11月9日9:00'}]})]).result.timePoints[0].normalizedValue,'2026-11-09T09:00')
 const window='登记服务开放时间为11月8日至11月9日。'
 assert.equal(compile(window,[task(window,{times:[{role:'deadline',raw:'11月8日至11月9日'}]})]).result.timePoints[0].normalizedValue,null)
})
test('tentative dates and suggested completion dates are retained as qualified text',()=>{
 for(const time of ['11月9日（暂定）','11月9日']){
  const source='资料说明会时间：11月9日（暂定）。'
  const out=compile(source,[event(source,[{role:'start',raw:time}])]).result
  assert.equal(out.timePoints[0].normalizedValue,null)
  assert.match(out.events[0].description,/暂定时间/u)
 }
 const source='建议提交登记表在11月9日前完成。'
 const out=compile(source,[task(source,{times:[{role:'deadline',raw:source}]})]).result
 assert.equal(out.timePoints[0].normalizedValue,null)
 assert.match(out.standaloneTasks[0].description,/建议完成时间/u)
 const fixed='资料说明会时间：11月9日14:00；其他场次暂定。'
 assert.equal(compile(fixed,[event(fixed,[{role:'start',raw:'11月9日14:00'}])]).result.timePoints[0].normalizedValue,'2026-11-09T14:00')
})
test('time certainty binds before a literal date as well as within its quote',()=>{
 assert.equal(sourceTimeModality('11月9日前','建议于11月9日前提交登记表'),'suggested')
 assert.equal(sourceTimeModality('11月9日','资料说明会暂定时间：11月9日'),'tentative')
 assert.equal(sourceTimeModality('11月9日','预计日期为11月9日'),'tentative')
 assert.equal(sourceTimeModality('11月9日前','11月9日前提交登记表；其他活动暂定'),'confirmed')
 const source='资料说明会暂定时间：\n11月9日14:00。'
 assert.equal(compile(source,[event(source,[{role:'start',raw:'11月9日14:00'}])]).result.timePoints[0].normalizedValue,null)
})
test('repeated citations cannot move the old occurrence after its own revision',()=>{
 const source='原定11月8日举办的资料说明会，由于设备维护，现取消当天的活动，顺延至11月10日14:00~15:30。'
 const old=event(source,[{role:'start',raw:'11月8日'}],{key:'old',title:'资料说明会（原11月8日场次）',status:'cancelled',evidence:['原定11月8日举办的资料说明会','现取消当天的活动']})
 const next=event(source,[{role:'start',raw:'11月10日14:00~15:30'},{role:'end',raw:'11月10日14:00~15:30'}],{key:'new',evidence:['顺延至11月10日14:00~15:30']})
 for(const evidence of [old.evidence,[...old.evidence].reverse(),[old.evidence[0],source,old.evidence[1]]]){
  const out=compile(source,[{...old,evidence},next]).result
  assert.equal(out.events.length,1)
  assert.deepEqual(out.timePoints.map(p=>p.normalizedValue),['2026-11-10T14:00','2026-11-10T15:30'])
 }
})
test('unsupported model cancellation remains uncertain instead of confirming a calendar instant',()=>{
 const source='资料说明会在11月9日14:00举行。'
 const out=compile(source,[event(source,[{role:'start',raw:'11月9日14:00'}],{status:'cancelled'})]).result
 assert.equal(out.events[0].sourceStatus,'uncertain')
 assert.equal(out.timePoints[0].normalizedValue,null)
})
test('repeated optional material references do not become mandatory',()=>{
 const source='请提交登记表（若有补充说明可一并提交）。电子版含登记表及补充说明；纸质版补充说明（如有）须打印两份。'
 const items=[task(source,{materials:['m']})]
 const out=compile(source,items,[{key:'m',name:'补充说明',owners:['t'],evidence:['若有补充说明可一并提交'],requirements:['若有补充说明可一并提交']}]).result
 assert.equal(out.materials[0].required,false)
})
test('a material example in its display name does not mask its own optional qualifier',()=>{
 const source='请提交登记表及附件材料（附件为非必须），登记表必须签字。'
 const out=compile(source,[task(source,{materials:['form','extra']})],[{key:'form',name:'登记表',owners:['t'],evidence:['登记表必须签字']},{key:'extra',name:'附件材料（如照片等）',owners:['t'],evidence:['附件材料（附件为非必须）']}]).result
 assert.equal(out.materials.find(m=>m.name==='登记表').required,true)
 assert.equal(out.materials.find(m=>m.name.startsWith('附件材料')).required,false)
})
