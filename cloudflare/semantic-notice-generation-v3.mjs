import {extractionRequestOptions} from './extraction-profile.mjs'
import {decodeRecognitionOutput} from './recognition-output-recovery.mjs'
import {compileSemanticNotice} from './semantic-notice-compiler-v3.mjs'
import {SEMANTIC_NOTICE_MODE,SEMANTIC_NOTICE_VERSION,semanticNoticeRequest} from './semantic-notice-contract-v3-2-0.mjs'
import {SEMANTIC_NOTICE_VERSION as ACTOR_VERSION,semanticNoticeRequest as actorNoticeRequest} from './semantic-notice-contract-v3-3-0.mjs'
import {SEMANTIC_NOTICE_VERSION as ACTOR_CONTEXT_VERSION,semanticNoticeRequest as actorContextNoticeRequest} from './semantic-notice-contract-v3-4-0.mjs'
import {SEMANTIC_NOTICE_VERSION as SERVICE_CONTEXT_VERSION,semanticNoticeRequest as serviceContextNoticeRequest} from './semantic-notice-contract-v3-5-0.mjs'
import {SEMANTIC_NOTICE_VERSION as EVENT_NOTICE_VERSION,semanticNoticeRequest as eventNoticeRequest} from './semantic-notice-contract-v3-6-0.mjs'
import {SEMANTIC_NOTICE_VERSION as INTEGRITY_VERSION,semanticNoticeRequest as integrityNoticeRequest} from './semantic-notice-contract-v3-7-0.mjs'
import {SEMANTIC_NOTICE_VERSION as UNIFIED_VERSION,semanticNoticeRequest as unifiedNoticeRequest} from './semantic-notice-contract-v3-8-0.mjs'
import {SEMANTIC_NOTICE_VERSION as REFINED_VERSION,semanticNoticeRequest as refinedNoticeRequest} from './semantic-notice-contract-v3-9-0.mjs'
import {SEMANTIC_NOTICE_VERSION as TIMED_ACTION_VERSION,semanticNoticeRequest as timedActionNoticeRequest} from './semantic-notice-contract-v3-10-0.mjs'
import {SEMANTIC_NOTICE_VERSION as GOAL_VERSION,semanticNoticeRequest as goalNoticeRequest} from './semantic-notice-contract-v3-11-0.mjs'
import {SEMANTIC_NOTICE_VERSION as MATTER_VERSION,semanticNoticeRequest as matterNoticeRequest} from './semantic-notice-contract-v3-12-0.mjs'

/** One full-notice request. No hidden retry or second semantic rewrite. */
export async function runSemanticNoticeGeneration({fetcher,apiKey,profile,userText,source,referenceTime,timezone,actorRoles=false,goalContextVersion=''}) {
  const started=Date.now()
  const actorContext=actorRoles==='semantic-notice-3.4'
  const serviceContext=actorRoles==='semantic-notice-3.5'
  const eventNotice=actorRoles==='semantic-notice-3.6'
  const integrity=actorRoles==='semantic-notice-3.7'
  const unified=actorRoles==='semantic-notice-3.8',refined=actorRoles==='semantic-notice-3.9',timedAction=actorRoles==='semantic-notice-3.10',goal=actorRoles==='semantic-notice-3.11',matter=actorRoles==='semantic-notice-3.12'
  const promptVersion=matter?MATTER_VERSION:goal?GOAL_VERSION:timedAction?TIMED_ACTION_VERSION:refined?REFINED_VERSION:unified?UNIFIED_VERSION:integrity?INTEGRITY_VERSION:eventNotice?EVENT_NOTICE_VERSION:serviceContext?SERVICE_CONTEXT_VERSION:actorContext?ACTOR_CONTEXT_VERSION:actorRoles?ACTOR_VERSION:SEMANTIC_NOTICE_VERSION
  const request=matter?matterNoticeRequest:goal?goalNoticeRequest:timedAction?timedActionNoticeRequest:refined?refinedNoticeRequest:unified?unifiedNoticeRequest:integrity?integrityNoticeRequest:eventNotice?eventNoticeRequest:serviceContext?serviceContextNoticeRequest:actorContext?actorContextNoticeRequest:actorRoles?actorNoticeRequest:semanticNoticeRequest
  let response,payload
  try {
    response=await fetcher('https://api.deepseek.com/chat/completions',{method:'POST',headers:{authorization:'Bearer '+apiKey,'content-type':'application/json'},body:JSON.stringify(request(profile,userText,extractionRequestOptions)),signal:AbortSignal.timeout(Math.min(45000,profile.timeoutMs))})
    if(!response.ok)return {ok:false,status:response.status,error:'UPSTREAM_UNAVAILABLE',samples:[{status:response.status,elapsedMs:Date.now()-started}]}
    payload=await response.json()
  } catch(error) {
    return {ok:false,status:502,error:error?.name==='TimeoutError'||error?.name==='AbortError'?'UPSTREAM_TIMEOUT':'UPSTREAM_UNAVAILABLE',samples:[{status:null,elapsedMs:Date.now()-started}]}
  }
  const decoded=decodeRecognitionOutput(payload?.choices?.[0]?.message?.content,{finishReason:payload?.choices?.[0]?.finish_reason})
  const actualModel=typeof payload?.model==='string'&&payload.model.trim()?payload.model.trim().slice(0,80):null
  const compiled=compileSemanticNotice(decoded.value,{source,referenceTime,timezone,model:actualModel??'上游未提供',promptVersion,goalContextVersion})
  if(!compiled.result)return {ok:false,status:502,error:'INVALID_AI_RESPONSE',samples:[{status:200,elapsedMs:Date.now()-started}]}
  const truncated=decoded.audit.partial||payload?.choices?.[0]?.finish_reason==='length'
  if(truncated){compiled.result.quality.needsHumanReview=true;compiled.result.quality.reviewReasons.push('本次回答未完整结束，部分内容可能尚未整理。');compiled.result.ambiguities.push({id:'sem-truncated',field:'source_reference',message:'本次回答未完整结束，原文已保留。',options:['查看原文'],evidenceIds:[]})}
  const usage=payload.usage??null,elapsedMs=Date.now()-started
  return {ok:true,result:compiled.result,execution:{generationMode:matter?'semantic-notice-3.12':goal?'semantic-notice-3.11':timedAction?'semantic-notice-3.10':refined?'semantic-notice-3.9':unified?'semantic-notice-3.8':integrity?'semantic-notice-3.7':eventNotice?'semantic-notice-3.6':serviceContext?'semantic-notice-3.5':actorContext?'semantic-notice-3.4':actorRoles?'semantic-notice-3.3':SEMANTIC_NOTICE_MODE,promptVersion,twoStep:{...compiled.audit,callCount:1,plannedCalls:1,omittedCalls:0,successfulSamples:1,elapsedMs,semanticBoundary:'Model semantic graph, source-backed time and deterministic storage mapping'},modelFactSamples:[{index:0,status:200,actualModel,finishReason:payload?.choices?.[0]?.finish_reason??null,facts:decoded.value,usage,elapsedMs,truncated}],tokenUsage:Number.isFinite(usage?.prompt_tokens)&&Number.isFinite(usage?.completion_tokens)?{input:usage.prompt_tokens,output:usage.completion_tokens,total:usage.total_tokens??usage.prompt_tokens+usage.completion_tokens}:null}}
}
