import {expect,it,vi} from 'vitest'
import {ProxyDeepSeekExtractionService} from './deepseekExtraction'
import {buildLocalRecognition} from '../recognition/pipeline'

it('keeps the original reference clock on an explicit retry and joins the same attempt',async()=>{
 const source='请周六提交登记表。',now=new Date('2026-11-15T07:30:00.000Z'),timezone='America/Los_Angeles'
 const result=buildLocalRecognition({sourceType:'text',sourceTitle:'匿名通知',content:source,referenceTime:now,timezone,projects:[],tasks:[]})
 const sent:Array<{referenceTime:string;timezone:string}>=[]
 vi.stubGlobal('fetch',vi.fn(async(_url:string|URL|Request,options?:RequestInit)=>{sent.push(JSON.parse(String(options?.body)) as {referenceTime:string;timezone:string});return Response.json({result})}))
 try{
  const proxy=new ProxyDeepSeekExtractionService(),input={sourceType:'text' as const,sourceTitle:'匿名通知',content:source,now,timezone,sourceId:'source',sourceVersionId:'source:1'}
  await proxy.recognize(input,undefined,{attemptId:'attempt-one'})
  await proxy.recognize(input,undefined,{attemptId:'attempt-one'})
  await proxy.recognize(input,undefined,{attemptId:'attempt-two'})
  expect(sent).toHaveLength(2)
  expect(sent.map(body=>[body.referenceTime,body.timezone])).toEqual([[now.toISOString(),timezone],[now.toISOString(),timezone]])
 }finally{vi.unstubAllGlobals()}
})
