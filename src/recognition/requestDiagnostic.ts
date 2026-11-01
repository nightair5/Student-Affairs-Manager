import type {RecognitionResult} from './types'

export interface RecognitionRequestDiagnostic {
 version:'recognition-request-observation-1'
 state:'not_sent'|'response'|'uncertain'|'unobserved'
 reason:'LOCAL_MODE'|'STATUS_UNAVAILABLE'|'NOT_CONFIGURED'|'AI_RESPONSE'|'HTTP_ERROR'|'INVALID_JSON'|'SCHEMA_ERROR'|'TIMEOUT_OR_NETWORK'|'UNOBSERVED'
 httpStatus:number|null
 actualModels:string[]
 generationMode:string|null
 compilerVersion:string|null
 inputTokens:number|null
 outputTokens:number|null
 modelActionCount:number|null
 compilerLossCount:number|null
 elapsedMs:number|null
 responseReuse:boolean
}
const observations=new WeakMap<RecognitionResult,RecognitionRequestDiagnostic>()
export const unobservedDiagnostic=(reason:RecognitionRequestDiagnostic['reason']='UNOBSERVED'):RecognitionRequestDiagnostic=>({version:'recognition-request-observation-1',state:reason==='UNOBSERVED'?'unobserved':'not_sent',reason,httpStatus:null,actualModels:[],generationMode:null,compilerVersion:null,inputTokens:null,outputTokens:null,modelActionCount:null,compilerLossCount:null,elapsedMs:null,responseReuse:false})
export class ObservedRecognitionError extends Error {
 constructor(message:string,readonly requestDiagnostic:RecognitionRequestDiagnostic,options?:ErrorOptions){super(message,options);this.name='ObservedRecognitionError'}
}
const record=(v:unknown):v is Record<string,unknown>=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v)
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:null
export function responseDiagnostic(body:unknown,status:number,elapsedMs:number):RecognitionRequestDiagnostic {
 const result={...unobservedDiagnostic('AI_RESPONSE'),state:'response' as const,httpStatus:status,elapsedMs}
 if(!record(body)||!record(body.execution))return result
 const execution=body.execution,samples=Array.isArray(execution.modelFactSamples)?execution.modelFactSamples.filter(record):[]
 result.actualModels=[...new Set(samples.flatMap(s=>typeof s.actualModel==='string'?[s.actualModel.slice(0,80)]:[]))]
 result.generationMode=typeof execution.generationMode==='string'?execution.generationMode.slice(0,80):null
 result.compilerVersion=record(execution.twoStep)&&typeof execution.twoStep.compilerVersion==='string'?execution.twoStep.compilerVersion.slice(0,80):null
 result.compilerLossCount=record(execution.twoStep)&&Array.isArray(execution.twoStep.losses)?execution.twoStep.losses.length:null
 if(record(execution.tokenUsage)){result.inputTokens=count(execution.tokenUsage.input);result.outputTokens=count(execution.tokenUsage.output)}
 result.modelActionCount=samples.length?samples.reduce((total,s)=>total+(record(s.facts)&&Array.isArray(s.facts.items)?s.facts.items.filter(i=>record(i)&&['任务','活动','task','event'].includes(String(i.kind))).length:0),0):null
 return result
}
export function registerRecognitionDiagnostic(result:RecognitionResult,diagnostic:RecognitionRequestDiagnostic):RecognitionResult {
 observations.set(result,structuredClone(diagnostic));return result
}
export function recognitionDiagnostic(result:RecognitionResult):RecognitionRequestDiagnostic|null {return observations.get(result)??null}
export function failureDiagnostic(error:unknown):RecognitionRequestDiagnostic {
 if(error instanceof ObservedRecognitionError)return error.requestDiagnostic
 if(error instanceof Error&&error.message==='DEEPSEEK_STATUS_UNAVAILABLE')return unobservedDiagnostic('STATUS_UNAVAILABLE')
 return unobservedDiagnostic()
}
