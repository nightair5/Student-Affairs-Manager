import {test} from 'node:test'
import assert from 'node:assert/strict'
import {parseDirectSourceTime as parse} from './direct-source-time.mjs'
import {compileTwoStep} from './recognition-two-step-compiler-direct-v1.mjs'
import {deadlineRangeRoleIssue} from './deadline-range-role.mjs'
import {boundedNetworkRetry} from './upstream-network-retry.mjs'
const options={type:'task_deadline',referenceTime:'2026-10-10T00:00:00+08:00',timezone:'Asia/Shanghai'}
for(const [quote,value]of [
 ['2026年10月19日至10月22日17：00前','2026-10-22T17:00'],['10月19日至22日17:00前','2026-10-22T17:00'],['2026年12月1-2日16:00前','2026-12-02T16:00'],['9月29日至10月9日前','2026-10-09'],['2026年12月28日至1月3日17:00前','2027-01-03T17:00'],['即日起至10月22日','2026-10-22'],['10月19日至22日24:00前','2026-10-23T00:00']
])test('cutoff uses right endpoint: '+quote,()=>assert.equal(parse(quote,options).normalizedValue,value))
test('unqualified windows and alternatives are still blocked as deadlines',()=>{for(const q of ['10月19日至22日','10月19日或10月22日任选一天'])assert.ok(deadlineRangeRoleIssue(q,'task_deadline',q));assert.equal(parse('原定10月19日17:00，延期至10月22日17:00',options).normalizedValue,'2026-10-22T17:00')})
test('locations merge in source order only within the same owner',()=>{
 const source='学术讲座在图书馆三楼举行。地点：302会议室。地址：大学路8号。另一场报告在A101。'
 const raw={items:[{id:'a',kind:'活动',name:'学术讲座',quote:'学术讲座在图书馆三楼举行'},{id:'b',kind:'活动',name:'另一场报告',quote:'另一场报告在A101'}],facts:[{type:'地点',item:'a',quote:'地址：大学路8号'},{type:'地点',item:'a',quote:'地点：302会议室'},{type:'地点',item:'a',quote:'图书馆三楼'},{type:'地点',item:'b',quote:'A101'}],noAction:false}
 const r=compileTwoStep(raw,{source,referenceTime:options.referenceTime}).result
 assert.match(r.events[0].location,/图书馆三楼.*302会议室.*大学路8号/u);assert.equal(r.events[1].location,'A101')
})
test('network error retries once and reports unknown failed usage',async()=>{let calls=0;const x=boundedNetworkRetry(async()=>{if(++calls===1)throw new TypeError('network');return new Response('{}')},{enabled:true});assert.equal((await x.fetcher('https://api.deepseek.com/chat/completions',{})).status,200);assert.equal(calls,2);assert.equal(x.attempts[0].usage,'NOT_OBSERVABLE')})
test('two network failures stop; HTTP billing and limits never retry',async()=>{let calls=0;const x=boundedNetworkRetry(async()=>{calls++;throw new TypeError('network')},{enabled:true});await assert.rejects(x.fetcher('url',{}));assert.equal(calls,2);for(const status of [400,401,402,429,500]){let n=0;const y=boundedNetworkRetry(async()=>{n++;return new Response('{}',{status})},{enabled:true});assert.equal((await y.fetcher('url',{})).status,status);assert.equal(n,1)}})
