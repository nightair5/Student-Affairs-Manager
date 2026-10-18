import{projectLiteralSourceEvidence}from'./recognition-literal-evidence.mjs'
export const SOURCE_SEGMENT_VERSION='numbered-source-evidence-1.0.0'
export const usesSourceSegments=version=>version==='recognition-product-contract-1.8.0'
/** Segments are an index into the unchanged original, never business entities. */
export function sourceSegments(source,max=420){
 const rows=[];let start=0
 while(start<source.length){let end=Math.min(source.length,start+max);if(end<source.length){const nl=source.lastIndexOf('\n',end-1);if(nl>=start+120)end=nl+1;if(/[\uD800-\uDBFF]/u.test(source[end-1]))end--;if(source[end-1]==='\r'&&source[end]==='\n')end--}
  rows.push({id:'S'+(rows.length+1),start,end,text:source.slice(start,end)});start=end
 }
 return rows
}
export function recognitionSourceBody(source,version){return usesSourceSegments(version)?sourceSegments(source).map(s=>`[${s.id}]\n${s.text}`).join('\n'):source}
export function projectSegmentEvidence(input,source){
 const result=structuredClone(input),segments=new Map(sourceSegments(source).map(s=>[s.id,s])),audit={version:SOURCE_SEGMENT_VERSION,role:'PROGRAM_ORIGINAL_SOURCE_SPAN_VALIDATION_NOT_NEW_FACT',inferredFacts:0,accepted:[],rejected:[]}
 if(!result||!Array.isArray(result.evidence))return{result,audit}
 result.evidence=result.evidence.flatMap(e=>{
  const segment=segments.get(e?.segmentId),quote=e?.quote??e?.quotedText
  const reject=reason=>{audit.rejected.push({evidenceId:e?.id??null,reason,original:structuredClone(e)});return[]}
  if(!segment||typeof quote!=='string'||!quote.trim())return reject('SEGMENT_OR_QUOTE_MISSING')
  const p=projectLiteralSourceEvidence({evidence:[{...e,quote}]},segment.text),literal=p.result.evidence[0].quotedText??p.result.evidence[0].quote,at=segment.text.indexOf(literal)
  if(typeof literal!=='string'||at<0||segment.text.indexOf(literal,at+1)>=0||literal.length>500)return reject('QUOTE_NOT_UNIQUE_IN_DECLARED_SEGMENT')
  if(e.quote&&e.quotedText&&e.quote!==e.quotedText){const second=projectLiteralSourceEvidence({evidence:[{id:e.id,quote:e.quotedText}]},segment.text).result.evidence[0].quote;if(second!==literal)return reject('CONTRADICTORY_QUOTE_FIELDS')}
  const{segmentId,...rest}=e,textStart=segment.start+at,textEnd=textStart+literal.length
  audit.accepted.push({evidenceId:e.id,segmentId,textStart,textEnd,originalQuote:quote,literalQuote:literal,typographyMapped:literal!==quote})
  return[{...rest,quote:literal,quotedText:literal,textStart,textEnd}]
 })
 return{result,audit}
}
