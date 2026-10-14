import {it,expect} from 'vitest'
import {prepareCandidate11,validateCandidate11Prepared,candidate11StageRecord,denyCandidate11Dispatch} from './identity'
import {indexImmutableScopesV11} from '../../recognition/scopeIndexV11'
import {sha256Text} from '../realInput01/inputReceipt'
import {stableJson} from '../mainline04/semanticContract'
const packet=async()=>prepareCandidate11({index:await indexImmutableScopesV11('engineering-c11','engineering-v1','请检查器材清单。'),referenceTime:'2026-09-21T09:00:00+08:00',timezone:'Asia/Shanghai'},'V11')
it('carries actual candidate hashes through all stages without fabricating a result',async()=>{
  const p=await packet();for(const stage of ['binding','result','analysis'] as const){
    const r=await candidate11StageRecord(p,stage);expect(r.identity).toEqual(p.identity);expect(r.identitySha).toBe(p.identitySha)
    expect(r.resultStatus).toBe('NOT_RUN');expect(r.responseSha).toBe(null)
  }
  expect(await packet()).toEqual(p)
})
it.each(['request','identity','flag'])('rejects %s drift before any execution',async kind=>{
  const p=await packet()
  if(kind==='request')p.request.input[1].content[0].text='{}'
  if(kind==='identity')p.identity.exampleVersion=null
  if(kind==='flag')Object.assign(p,{modelCallsEnabled:true})
  await expect(validateCandidate11Prepared(p)).rejects.toThrow('IDENTITY_CHANGED')
})
it('valid prepared construction is still not a model authorization',async()=>{
  await expect(denyCandidate11Dispatch(await packet())).rejects.toThrow('MODEL_CALL_NOT_AUTHORIZED')
})
it('rejects falsely relabeled input, example or model metadata even after rehashing the envelope',async()=>{
  for(const field of ['inputSha','exampleSha','modelConfig'] as const){
    const p=await packet()
    if(field==='modelConfig')p.identity.modelConfig.temperature=1
    else p.identity[field]='0'.repeat(64)
    p.identitySha=await sha256Text(stableJson(p.identity))
    await expect(validateCandidate11Prepared(p)).rejects.toThrow('IDENTITY_CHANGED')
  }
})
