import {describe,expect,it} from 'vitest'
import {indexImmutableScopesV11} from '../../recognition/scopeIndexV11'
import {buildCandidate14Request,CANDIDATE14_INSTRUCTIONS,CANDIDATE14_PROMPT_VERSION} from './candidate14'

describe('candidate14 request',()=>{
  it('uses one complete prompt and excludes expected answers',async()=>{
    const source='请于9月30日前提交报名表。',index=await indexImmutableScopesV11('s','v',source)
    const built=await buildCandidate14Request({index,referenceTime:'2026-09-22T00:00:00.000Z',timezone:'Asia/Shanghai'})
    expect(built.promptVersion).toBe(CANDIDATE14_PROMPT_VERSION)
    expect(built.body.input[0].content[0].text).toBe(CANDIDATE14_INSTRUCTIONS)
    expect(built.serialized).not.toMatch(/Expected|expectedAnswer|referenceSha256/u)
  })
})
