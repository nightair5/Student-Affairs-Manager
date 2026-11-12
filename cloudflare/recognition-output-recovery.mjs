import {parseRecognitionJson} from './recognition-json.mjs'
export const OUTPUT_RECOVERY_VERSION='recognition-closed-prefix-recovery-1.1.0'
export const MAX_EXTRACTION_RESPONSE_CHARACTERS=160_000
const record=v=>v&&typeof v==='object'&&!Array.isArray(v)
// Read only complete JSON values. Never close an unfinished string/object,
// fill an entity field, skip a malformed token, or search through prose.
function closedArrayPrefix(text){
 if(text[0]!=='[')return null
 const values=[];let depth=1,string=false,escape=false,start=1
 for(let i=1;i<text.length;i++){const c=text[i];if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;continue}if(c==='"'){string=true;continue}if(c==='{'||c==='[')depth++;if(c==='}'||c===']')depth--;if((c===','&&depth===1)||(c===']'&&depth===0)){const part=text.slice(start,i).trim();if(part){try{const value=JSON.parse(part);if(!record(value))return null;values.push(value)}catch{return null}}start=i+1;if(depth===0)return values}}
 if(!string&&depth===1){const part=text.slice(start).trim();if(part){try{const value=JSON.parse(part);if(record(value))values.push(value)}catch{ /* unfinished tail is not recovered */ }}}
 return values
}
function rootPrefix(text){
 if(text[0]!=='{')return null
 const value={},keys=new Set();let depth=1,string=false,escape=false,start=1
 const add=part=>{try{const entry=JSON.parse('{'+part+'}'),names=Object.keys(entry);if(names.length!==1||keys.has(names[0]))return false;keys.add(names[0]);Object.assign(value,entry);return true}catch{return false}}
 for(let i=1;i<text.length;i++){const c=text[i];if(string){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')string=false;continue}if(c==='"'){string=true;continue}if(c==='{'||c==='[')depth++;if(c==='}'||c===']')depth--;if(c===','&&depth===1){if(!add(text.slice(start,i)))return null;start=i+1}else if(c==='}'&&depth===0){if(!add(text.slice(start,i)))return null;return value}if(depth<0)return null}
 const tail=text.slice(start).trim(),match=/^"([A-Za-z][A-Za-z0-9]*)"\s*:\s*(\[)/u.exec(tail)
 if(match&&keys.has(match[1]))return null
 if(match&&!keys.has(match[1])){const values=closedArrayPrefix(tail.slice(match[0].length-1));if(values)value[match[1]]=values}
 return value
}
export function decodeRecognitionOutput(content,{finishReason}={}){
 const audit={version:OUTPUT_RECOVERY_VERSION,finishReason:finishReason??null,partial:false,recoveredFields:[],missingFields:[],inferredFacts:0}
 if(typeof content!=='string')return {value:null,audit,error:'MODEL_OUTPUT_MISSING'}
 if(content.length>MAX_EXTRACTION_RESPONSE_CHARACTERS)return {value:null,audit,error:'MODEL_OUTPUT_TOO_LARGE'}
 if(!content.trim())return {value:null,audit,error:'MODEL_OUTPUT_EMPTY'}
 try{const value=parseRecognitionJson(content);if(finishReason!=='length')return {value,audit,error:null};audit.partial=true;return {value:markPartial(value,audit),audit,error:null}}catch{/* strict decoding first */}
 const text=content.trim().replace(/^```(?:json)?\s*\n/u,''),value=rootPrefix(text)
 if(!record(value)||value.schemaVersion!=='2.0'||!record(value.sourceSummary)||!record(value.projectMatch)||!Array.isArray(value.evidence))return {value:null,audit,error:'MODEL_OUTPUT_UNRECOVERABLE_ROOT'}
 const entityFields=['milestones','standaloneTasks','materials','timePoints','events'];if(!entityFields.some(k=>Array.isArray(value[k])&&value[k].length))return {value:null,audit,error:'MODEL_OUTPUT_NO_CLOSED_ENTITY'}
 audit.partial=true;audit.recoveredFields=Object.keys(value)
 for(const key of [...entityFields,'conflicts','ambiguities','ignoredContent'])if(!Array.isArray(value[key])){audit.missingFields.push(key);value[key]=[]}
 if(value.projectSuggestion===undefined){audit.missingFields.push('projectSuggestion');value.projectSuggestion=null}
 if(!record(value.quality)){audit.missingFields.push('quality');value.quality={overallConfidence:0,hierarchyConfidence:0,dateConfidence:0,evidenceCoverage:0,duplicateRisk:0,overFragmentationRisk:0,missingActionRisk:1,needsHumanReview:true,reviewReasons:[]}}
 return {value:markPartial(value,audit),audit,error:null}
}

// The semantic-notice contract is a different root from RecognitionResult 2.0.
// A length-truncated answer may still contain closed, independently valid items;
// retain those items for source validation rather than discarding the batch.
// Never use this path for malformed non-truncated responses or incomplete roots.
export function decodeSemanticNoticeOutput(content,{finishReason}={}){
 const decoded=decodeRecognitionOutput(content,{finishReason})
 const usable=value=>record(value)&&typeof value.topic==='string'&&Boolean(value.topic.trim())&&['action','event','mixed'].includes(value.kind)&&Array.isArray(value.items)&&value.items.length>0&&value.items.length<=20&&value.items.some(item=>record(item)&&['task','event'].includes(item.kind)&&typeof item.key==='string'&&item.key.trim()&&typeof item.title==='string'&&item.title.trim())
 // Some otherwise valid JSON omits the whole top-level material container.
 // Preserve evidenced items, but explicitly mark material coverage unknown.
 if(decoded.value!==null){
  if(!usable(decoded.value)||'materials' in decoded.value)return decoded
  return {value:{...decoded.value,materials:[],partial:true},audit:{...decoded.audit,partial:true,reason:'MATERIALS_FIELD_MISSING',recoveredFields:Object.keys(decoded.value),missingFields:['materials'],inferredFacts:0},error:null}
 }
 if(finishReason!=='length'||typeof content!=='string'||content.length>MAX_EXTRACTION_RESPONSE_CHARACTERS)return decoded
 const text=content.trim().replace(/^```(?:json)?\s*\n/u,''),value=rootPrefix(text)
 if(!usable(value))return decoded
 if('materials' in value&&!Array.isArray(value.materials))return decoded
 if(Array.isArray(value.materials)&&value.materials.length>60)return decoded
 const missingFields=[]
 if(!('materials' in value)){value.materials=[];missingFields.push('materials')}
 value.partial=true
 return {value,audit:{...decoded.audit,partial:true,reason:'LENGTH_TRUNCATED',recoveredFields:Object.keys(value).filter(key=>!missingFields.includes(key)),missingFields,inferredFacts:0},error:null}
}

function markPartial(input,audit){
 const value=structuredClone(input);if(!Array.isArray(value.ambiguities))value.ambiguities=[]
 value.ambiguities.push({id:'local-isolation:truncated-output',field:'source_coverage',message:'通知较长，后半部分未处理，请核对原文。这里只保留已完整返回且通过依据校验的部分。',options:['核对尚未处理的原文'],evidenceIds:[]})
 if(record(value.quality)){value.quality.needsHumanReview=true;value.quality.reviewReasons=[...new Set([...(value.quality.reviewReasons??[]),'通知较长，后半部分未处理，请核对原文。'])].slice(0,20)}
 audit.partial=true;return value
}
