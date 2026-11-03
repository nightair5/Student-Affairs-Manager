import {afterEach,describe,expect,it,vi} from 'vitest'
import {ProxyDeepSeekExtractionService} from './deepseekExtraction'
import {ordinaryWorkflowFixture,ordinaryWorkflowText} from '../recognition/ordinaryProviderSupport.fixture'
import {recognitionDiagnostic} from '../recognition/requestDiagnostic'

const input={sourceType:'text' as const,sourceTitle:'匿名通知',content:ordinaryWorkflowText,now:new Date('2026-11-03T02:00:00Z')}
const context={projects:[],tasks:[]}
afterEach(()=>vi.unstubAllGlobals())

describe('explicit user recognition attempts',()=>{
  it('sends a fresh request for a new retry while joining the same retry attempt',async()=>{
    const bodies:string[]=[]
    const fetcher=vi.fn(async(_url:string|URL|Request,options?:RequestInit)=>{
      bodies.push(String(options?.body))
      return Response.json({result:ordinaryWorkflowFixture()})
    })
    vi.stubGlobal('fetch',fetcher)
    const service=new ProxyDeepSeekExtractionService()
    await service.recognize(input,context)
    const options={attemptId:'attempt-1'}
    const [first,joined]=await Promise.all([service.recognize(input,context,options),service.recognize(input,context,options)])
    const repeated=await service.recognize(input,context,options)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(recognitionDiagnostic(first)).toMatchObject({responseReuse:false,attemptId:'attempt-1'})
    expect(recognitionDiagnostic(joined)).toMatchObject({responseReuse:true,attemptId:'attempt-1'})
    expect(recognitionDiagnostic(repeated)).toMatchObject({responseReuse:true,attemptId:'attempt-1'})
    expect(bodies[0]).toBe(bodies[1])
    await service.recognize(input,context,{attemptId:'attempt-2'})
    expect(fetcher).toHaveBeenCalledTimes(3)
  })

  it('permits a user-initiated extraction after an unavailable status check',async()=>{
    const calls:string[]=[]
    vi.stubGlobal('fetch',vi.fn(async(url:string|URL|Request)=>{
      calls.push(String(url))
      return String(url).endsWith('/status')?new Response('',{status:503}):Response.json({result:ordinaryWorkflowFixture()})
    }))
    const service=new ProxyDeepSeekExtractionService()
    await service.status()
    await service.recognize(input,context,{allowStatusUnknown:true})
    expect(calls.filter(call=>call.endsWith('/extract'))).toHaveLength(1)
  })

  it('still does not send if the server explicitly reports no configuration',async()=>{
    const fetcher=vi.fn(async()=>Response.json({configured:false}))
    vi.stubGlobal('fetch',fetcher)
    const service=new ProxyDeepSeekExtractionService()
    await service.status()
    await expect(service.recognize(input,context,{allowStatusUnknown:true})).rejects.toThrow('尚未配置')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
