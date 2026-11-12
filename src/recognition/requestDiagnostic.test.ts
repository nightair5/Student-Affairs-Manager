import {afterEach,describe,it,expect,vi} from 'vitest'
import {ProxyDeepSeekExtractionService} from '../lib/deepseekExtraction'
import {buildLocalRecognition} from './pipeline'
import {recognitionDiagnostic,failureDiagnostic,ObservedRecognitionError} from './requestDiagnostic'
import {CapturePersistenceService} from '../domain/v2/capture'
import {CanonicalWorkspaceRepository,MemoryWorkspaceRecordStore} from '../domain/v2/repository'
import {createGoldenWorkspaceV8} from '../domain/v2/fixtures'

const input={sourceType:'text' as const,sourceTitle:'匿名通知',content:'请于11月7日17:00前提交报告。',now:new Date('2026-11-01T04:00:00Z')}
const result=()=>buildLocalRecognition({...input,referenceTime:input.now,timezone:'Asia/Shanghai',projects:[]})
afterEach(()=>vi.unstubAllGlobals())
describe('capture-bound AI observations',()=>{
 it('does not label an unobserved historical request as definitely not sent',()=>{
  expect(failureDiagnostic(Error('old unknown failure'))).toMatchObject({state:'unobserved',reason:'UNOBSERVED',actualModels:[]})
 })
 it('records status failure as not sent without inventing a model or usage',async()=>{
  const fetch=vi.fn().mockRejectedValue(new TypeError('network'));vi.stubGlobal('fetch',fetch)
  const service=new ProxyDeepSeekExtractionService();await service.status()
  const error=await service.recognize(input).catch(e=>e)
  expect(failureDiagnostic(error)).toMatchObject({state:'not_sent',reason:'STATUS_UNAVAILABLE',actualModels:[],inputTokens:null})
  expect(fetch).toHaveBeenCalledTimes(1)
 })
 it('records actual model, usage, losses, and response reuse from the Worker response',async()=>{
  const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({result:result(),execution:{generationMode:'two-step-2.4',tokenUsage:{input:300,output:70},twoStep:{compilerVersion:'two-step-compiler-2.1.16',losses:[{layer:'OWNERSHIP'}]},modelFactSamples:[{actualModel:'deepseek-flash',facts:{items:[{kind:'任务'}]}}]}}),{status:200}));vi.stubGlobal('fetch',fetch)
  const service=new ProxyDeepSeekExtractionService(),first=await service.recognize(input),repeat=await service.recognize(input)
  expect(recognitionDiagnostic(first)).toMatchObject({state:'response',actualModels:['deepseek-flash'],inputTokens:300,outputTokens:70,compilerLossCount:1,modelActionCount:1,responseReuse:false})
  expect(recognitionDiagnostic(repeat)?.responseReuse).toBe(true);expect(fetch).toHaveBeenCalledTimes(1)
 })
 it('distinguishes an invalid response and a network-unknown send',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('not-json',{status:200})))
  const invalid=await new ProxyDeepSeekExtractionService().recognize(input).catch(e=>e)
  expect(invalid).toBeInstanceOf(ObservedRecognitionError);expect(failureDiagnostic(invalid)).toMatchObject({state:'response',reason:'INVALID_JSON',httpStatus:200})
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('offline')))
  const unknown=await new ProxyDeepSeekExtractionService().recognize(input).catch(e=>e)
  expect(failureDiagnostic(unknown)).toMatchObject({state:'uncertain',reason:'TIMEOUT_OR_NETWORK',actualModels:[]})
 })
 it('retains observed usage on an invalid model response without claiming zero actions',async()=>{
  const body={error:'INVALID_AI_RESPONSE',message:'识别未完成',failureCategory:'semantic_root',failureReason:'INVALID_SEMANTIC_ROOT',execution:{generationMode:'semantic-notice-3.11',tokenUsage:{input:101,output:22},twoStep:{compilerVersion:'compiler-test'},modelFactSamples:[{actualModel:'observed-flash',usage:{prompt_tokens:101,completion_tokens:22}}]}}
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(body),{status:502})))
  const error=await new ProxyDeepSeekExtractionService().recognize(input).catch(e=>e)
  expect(failureDiagnostic(error)).toMatchObject({state:'response',reason:'HTTP_ERROR',httpStatus:502,actualModels:['observed-flash'],inputTokens:101,outputTokens:22,failureCategory:'semantic_root',failureReason:'INVALID_SEMANTIC_ROOT',modelActionCount:null})
 })
 it('persists a failed status observation on the source run while retaining its full input',async()=>{
  const workspace=createGoldenWorkspaceV8(),repo=new CanonicalWorkspaceRepository(new MemoryWorkspaceRecordStore());await repo.save(workspace)
  const service=new CapturePersistenceService(repo),handle=await service.beginCapture({operationId:'root-status-failure',sourceType:'text',title:input.sourceTitle,rawText:input.content,provider:'deepseek',modelName:null,promptVersion:null,pipelineVersion:'root-repair'})
  await expect(service.recognize(handle,async()=>{throw Error('DEEPSEEK_STATUS_UNAVAILABLE')})).rejects.toThrow()
  const saved=(await repo.load())!,run=saved.recognitionRuns.find(r=>r.id===handle.recognitionRunId)!
  expect(run.legacyData?.requestDiagnostic).toMatchObject({state:'not_sent',reason:'STATUS_UNAVAILABLE'})
  expect(saved.sourceVersions.find(v=>v.id===handle.sourceVersionId)?.rawText).toBe(input.content)
 })
})
