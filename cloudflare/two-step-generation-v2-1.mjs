import {twoStepSystemPrompt as twoStep22SystemPrompt,TWO_STEP_VERSION as TWO_STEP22_VERSION} from './recognition-two-step-contract-v2-2.mjs'
import {extractionRequestOptions} from './extraction-profile.mjs'
import {TWO_STEP_VERSION,twoStepSystemPrompt,validateTwoStep} from './recognition-two-step-contract-v2-1.mjs'
import {compileTwoStep as compileLegacy} from './recognition-two-step-compiler-v2-1.mjs'
import {compileTwoStep as compileDirect} from './recognition-two-step-compiler-v2-1-10.mjs'
import {compileTwoStep as compileRetained} from './recognition-two-step-compiler-direct-v1.mjs'
import {alignSourceQuote} from './two-step-source-alignment.mjs'
import {decodeRecognitionOutput} from './recognition-output-recovery.mjs'
export function chunkTwoStepSource(source,limit=1500){
 if(source.length<=limit)return [{start:0,end:source.length,text:source}]
 const chunks=[];let start=0
 while(start<source.length){let end=Math.min(source.length,start+limit);if(end<source.length){const part=source.slice(start,end);let cut=-1;for(const m of part.matchAll(/\n(?=(?:[一二三四五六七八九十]+[、.]|[（(][一二三四五六七八九十0-9]+[）)]|[0-9]+[、.]))|\n\n|[。；;]/gu))if(m.index>limit/3)cut=m.index+m[0].length;if(cut>0)end=start+cut}chunks.push({start,end,text:source.slice(start,end)});start=end}return chunks
}
export function twoStep21Request(profile,userText,mode='two-step-2.1'){return {...extractionRequestOptions(profile),messages:[{role:'system',content:mode==='two-step-2.2'?twoStep22SystemPrompt():twoStepSystemPrompt()},{role:'user',content:userText}]}}
// Sequential extraction passes, first aligned proposal wins for the same object.
// Distinct evidence is retained; conflicting key times remain explicit conflicts.
export function mergeAlignedExtractions(samples,source,{preserveWithinPass=false}={}){
 const raw={items:[],facts:[],noAction:true},hints={items:[],facts:[]},audit={version:TWO_STEP_VERSION,passes:samples.length,unmatched:[],itemMappings:[]},items=[],factKeys=new Set()
 for(const [pass,sample]of samples.entries()){
  const value=sample.value??sample,chunk=sample.chunk??{start:0,end:source.length,text:source};if(!validateTwoStep(value).valid){audit.unmatched.push({pass,reason:'INVALID_ROOT'});continue}
  const map=new Map()
  for(const item of value.items){const local=alignSourceQuote(item.quote,chunk.text),span=local?{...local,start:local.start+chunk.start,end:local.end+chunk.start}:null
   const prior=span?items.find(x=>(!preserveWithinPass||x.pass!==pass)&&x.kind===item.kind&&x.span&&x.span.start<span.end&&span.start<x.span.end&&(x.name===item.name||x.name.includes(item.name)||item.name.includes(x.name))):null
   const id=prior?.id??'u'+(raw.items.length+1);map.set(item.id,id)
   if(!prior){raw.items.push({...item,id});items.push({id,name:item.name,kind:item.kind,span,pass});if(span)hints.items.push({id,span});else audit.unmatched.push({pass,item:item.id,reason:'UNALIGNED_ITEM'})}
   audit.itemMappings.push({pass,from:item.id,to:id,start:span?.start??null,end:span?.end??null})
  }
  for(const fact of value.facts){const local=alignSourceQuote(fact.quote,chunk.text),span=local?{...local,start:local.start+chunk.start,end:local.end+chunk.start}:null,item=map.get(fact.item)??null,key=[item,fact.type,span?.start??fact.quote,span?.end??''].join(':');if(factKeys.has(key))continue;factKeys.add(key);const index=raw.facts.length;raw.facts.push({...fact,item});if(span)hints.facts.push({index,span});else audit.unmatched.push({pass,type:fact.type,reason:'UNALIGNED_FACT'})}
  raw.noAction=raw.noAction&&value.noAction
 }
 return {raw,hints,audit}
}
export async function runTwoStep21Generation({fetcher,apiKey,profile,userText,source,referenceTime,timezone,mode='two-step-2.1',budgetMs=45000,compilerVersion='2.1.9'}){
 const version=mode==='two-step-2.2'?TWO_STEP22_VERSION:TWO_STEP_VERSION
 const started=Date.now(),passes=mode==='two-step-2.1x2'?2:1,chunks=chunkTwoStepSource(source),samples=[],deadline=started+Math.max(1,Math.min(45000,budgetMs)),plannedCalls=passes*chunks.length
 for(let pass=0;pass<passes;pass++)for(const [chunkIndex,chunk]of chunks.entries()){
  if(Date.now()>=deadline)break;
  const start=Date.now(),sourceAt=userText.lastIndexOf(source),input=chunks.length===1?userText:(sourceAt<0?userText+'\n':userText.slice(0,sourceAt))+'[原文分段 '+(chunkIndex+1)+'/'+chunks.length+'，只提取本段]\n'+chunk.text
  try{const res=await fetcher('https://api.deepseek.com/chat/completions',{method:'POST',headers:{authorization:'Bearer '+apiKey,'content-type':'application/json'},body:JSON.stringify(twoStep21Request(profile,input,mode)),signal:AbortSignal.timeout(Math.max(1,Math.min(profile.timeoutMs,deadline-Date.now())))});if(!res.ok){samples.push({pass,chunkIndex,chunk,status:res.status,value:null,usage:null,elapsedMs:Date.now()-start});continue}const p=await res.json(),d=decodeRecognitionOutput(p.choices?.[0]?.message?.content,{finishReason:p.choices?.[0]?.finish_reason});samples.push({pass,chunkIndex,chunk,status:200,value:d.value,usage:p.usage??null,actualModel:p.model??null,truncated:d.audit.partial||p.choices?.[0]?.finish_reason==='length',elapsedMs:Date.now()-start})}catch(e){samples.push({pass,chunkIndex,chunk,status:null,value:null,usage:null,error:e?.name==='TimeoutError'||e?.name==='AbortError'?'UPSTREAM_TIMEOUT':'UPSTREAM_UNAVAILABLE',elapsedMs:Date.now()-start})}
 }
 const usable=samples.filter(s=>s.status===200&&validateTwoStep(s.value).valid)
 if(!usable.length)return {ok:false,status:samples.find(s=>s.status&&s.status!==200)?.status??502,error:samples.some(s=>s.error==='UPSTREAM_TIMEOUT')?'UPSTREAM_TIMEOUT':'INVALID_AI_RESPONSE',samples:samples.map(({value,chunk,...s})=>({...s,sourceStart:chunk.start,sourceEnd:chunk.end}))}
 const merged=mergeAlignedExtractions(usable,source,{preserveWithinPass:mode==='two-step-2.2'}),compiled=(compilerVersion==='direct-1.0'?compileRetained:compilerVersion==='2.1.10'?compileDirect:compileLegacy)(merged.raw,{source,referenceTime,timezone,model:profile.model,version,alignmentHints:merged.hints})
 if(!compiled.result)return {ok:false,status:502,error:'INVALID_AI_RESPONSE',samples:[]}
 if(usable.length<samples.length||samples.length<plannedCalls||samples.some(s=>s.truncated)){const message=usable.length<samples.length||samples.length<plannedCalls?'部分提取未完成，成功内容已保留，请核对原文。':'通知较长，后半部分可能尚未处理，请核对原文。';compiled.result.quality.needsHumanReview=true;compiled.result.quality.reviewReasons.push(message);compiled.result.ambiguities.push({id:'g21-incomplete',field:'source_reference',message,options:['查看原文','保留待核对'],evidenceIds:[]})}
 const all=samples.every(s=>Number.isFinite(s.usage?.prompt_tokens)&&Number.isFinite(s.usage?.completion_tokens)),sum=k=>samples.reduce((n,s)=>n+(s.usage?.[k]??0),0)
 return {ok:true,result:compiled.result,execution:{generationMode:mode,promptVersion:version,twoStep:{...compiled.audit,merge:merged.audit,callCount:samples.length,plannedCalls,omittedCalls:plannedCalls-samples.length,overallBudgetMs:Math.max(1,Math.min(45000,budgetMs)),successfulSamples:usable.length,chunkCount:chunks.length,passes,elapsedMs:Date.now()-started,semanticBoundary:'Literal span-grounded program projection, not independent raw semantic truth'},modelFactSamples:samples.map(({chunk,value,...s})=>({...s,facts:value,sourceStart:chunk.start,sourceEnd:chunk.end})),tokenUsage:all?{input:sum('prompt_tokens'),output:sum('completion_tokens'),total:samples.reduce((n,s)=>n+(s.usage.total_tokens??s.usage.prompt_tokens+s.usage.completion_tokens),0)}:null}}
}
