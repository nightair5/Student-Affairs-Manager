import {describe,expect,it} from 'vitest'
import {indexImmutableScopesV11} from '../../recognition/scopeIndexV11'
import {denyCandidate13D5Dispatch,prepareCandidate13D5,validateCandidate13D5Prepared} from './preparedIdentity'

async function context(){const source='[D5匿名工程例]\n请于10月8日前提交申请表。';return {index:await indexImmutableScopesV11('D5-T','D5-T-v1',source),
  referenceTime:'2026-09-22T09:00:00+08:00',timezone:'Asia/Shanghai'}}

describe('Candidate13 D5 zero-call identity',()=>{
  it('normalizes both arms to one model and differs only by the prompt',async()=>{
    const c=await context(),a=await prepareCandidate13D5(c,'A'),b=await prepareCandidate13D5(c,'B')
    await expect(validateCandidate13D5Prepared(a)).resolves.toEqual(a)
    const left=structuredClone(a.request),right=structuredClone(b.request)
    left.input[0].content[0].text='__PROMPT__';right.input[0].content[0].text='__PROMPT__'
    expect(left).toEqual(right);expect(a.identity.modelConfig).toEqual(b.identity.modelConfig)
    expect(a.identity.requestSha).not.toBe(b.identity.requestSha)
  })
  it('blocks drift and every dispatch before any transport exists',async()=>{
    const value=await prepareCandidate13D5(await context(),'B')
    await expect(denyCandidate13D5Dispatch(value)).rejects.toThrow('D5_MODEL_CALL_NOT_AUTHORIZED')
    const changed=structuredClone(value);Reflect.set(changed,'dispatchAuthorized',true)
    await expect(validateCandidate13D5Prepared(changed)).rejects.toThrow('D5_PREPARED_IDENTITY_CHANGED')
  })
})
