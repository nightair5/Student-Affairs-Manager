// Server configuration only: client notification bodies cannot select a model.
export const MAX_THINKING_EXTRACTION_TOKENS=32_768
const allowed=new Set(['deepseek-v4-flash','deepseek-flash','deepseek-v4-pro'])
export function extractionProfile(env={}){
 const requested=env.DEEPSEEK_EXTRACTION_MODEL??env.DEEPSEEK_MODEL
 const model=allowed.has(requested)?requested:'deepseek-v4-flash'
 const thinking=env.DEEPSEEK_EXTRACTION_THINKING==='enabled'
 const ceiling=thinking?MAX_THINKING_EXTRACTION_TOKENS:16_384
 const limit=Number(env.DEEPSEEK_EXTRACTION_MAX_TOKENS)
 return {model,thinking,temperature:env.DEEPSEEK_EXTRACTION_TEMPERATURE==='0'||env.DEEPSEEK_EXTRACTION_TEMPERATURE===0?0:.1,
 maxTokens:Math.min(ceiling,Math.max(1,Number.isFinite(limit)&&limit>0?Math.floor(limit):thinking?ceiling:6_000)),
 timeoutMs:thinking||model==='deepseek-v4-pro'?180_000:45_000}
}
export function extractionRequestOptions(profile){
 return {model:profile.model,thinking:{type:profile.thinking?'enabled':'disabled'},
 ...(profile.thinking?{reasoning_effort:'high'}:{temperature:profile.temperature}),
 max_tokens:profile.maxTokens,response_format:{type:'json_object'}}
}
