import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeSourceWithOffsets,locateSourceQuote,alignRecognitionEvidence} from './source-text-index.mjs'

test('layout changes retain original UTF-16 coordinates including emoji and CRLF',()=>{
 const source='  📄\r\n材料：Word版及PDF版\t\u00a0报告  \r\n'
 const normalized=normalizeSourceWithOffsets(source)
 assert.equal(normalized.text,'📄\n材料：Word版及PDF版 报告')
 const span=locateSourceQuote('Word版及PDF版 报告',source)
 assert.equal(span.literal,'Word版及PDF版\t\u00a0报告')
 assert.equal(source.slice(span.start,span.end),span.literal)
 for(let i=0;i<normalized.text.length;i++)assert.ok(normalized.starts[i]>=0&&normalized.ends[i]>normalized.starts[i])
})
test('repeated quotations need a valid source coordinate or bounded owner scope',()=>{
 const source='第一项：提交报告。\n第二项：提交报告。'
 assert.equal(locateSourceQuote('提交报告',source),null)
 const start=source.lastIndexOf('提交报告')
 assert.equal(locateSourceQuote('提交报告',source,{start}).start,start)
 assert.equal(locateSourceQuote('提交报告',source,{within:{start:source.indexOf('第二项'),end:source.length}}).start,start)
})
test('alignment never edits dates, negation, or English word boundaries',()=>{
 assert.equal(locateSourceQuote('11月8日提交', '11月7日提交'),null)
 assert.equal(locateSourceQuote('请提交报告','请勿提交报告'),null)
 assert.equal(locateSourceQuote('nowhere','now here'),null)
 assert.equal(locateSourceQuote('11月7日23:59前','11月7日23：59前').literal,'11月7日23：59前')
})
test('evidence projection preserves business data and source immutability',()=>{
 const input={title:'提交报告',evidence:[{id:'x',quote:'邮箱 a@example.edu'}]},source='邮箱\u00a0a@example.edu'
 const out=alignRecognitionEvidence(input,source)
 assert.equal(out.result.title,input.title);assert.equal(input.evidence[0].quote,'邮箱 a@example.edu')
 assert.equal(source.slice(out.result.evidence[0].textStart,out.result.evidence[0].textEnd),out.result.evidence[0].quote)
})
