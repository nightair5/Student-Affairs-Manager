import {afterEach, describe, expect, it, vi} from 'vitest'
import {ProxyDeepSeekExtractionService} from './deepseekExtraction'
import {ordinaryWorkflowFixture, ordinaryWorkflowText} from '../recognition/ordinaryProviderSupport.fixture'

afterEach(()=>vi.unstubAllGlobals())
describe('explicit status recovery',()=>{
  it('rechecks after a transient failure and sends only once after recovery',async()=>{
    let available=false
    const calls:string[]=[]
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
      calls.push(url)
      if(url.endsWith('/status'))return available?Response.json({configured:true}):new Response('',{status:503})
      return Response.json({result:ordinaryWorkflowFixture()})
    }))
    const service=new ProxyDeepSeekExtractionService()
    expect((await service.status()).configured).toBe(false)
    available=true
    expect((await service.status()).configured).toBe(true)
    await service.recognize({sourceType:'text',content:ordinaryWorkflowText})
    expect(calls.filter(c=>c.endsWith('/extract'))).toHaveLength(1)
  })
  it('joins concurrent status checks, and never sends when the server explicitly says unconfigured',async()=>{
    const fetcher=vi.fn(async()=>Response.json({configured:false}))
    vi.stubGlobal('fetch',fetcher)
    const service=new ProxyDeepSeekExtractionService()
    await Promise.all([service.status(),service.status()])
    expect(fetcher).toHaveBeenCalledTimes(1)
    await expect(service.recognize({sourceType:'text',content:'匿名通知'})).rejects.toThrow('尚未配置')
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockResolvedValueOnce(Response.json({configured:true}))
    expect((await service.status()).configured).toBe(true)
  })
  it('does not permanently label transport or malformed status failures as missing configuration',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(Response.json({})).mockResolvedValueOnce(Response.json({configured:true})))
    const service=new ProxyDeepSeekExtractionService()
    expect((await service.status()).configured).toBe(false)
    expect((await service.status()).configured).toBe(false)
    expect((await service.status()).configured).toBe(true)
  })
})
