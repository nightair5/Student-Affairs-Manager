import{parseChineseTimeAst}from'./chinese-time-ast.generated.mjs'
import{projectLiteralSourceEvidence}from'./recognition-literal-evidence.mjs'
import{sourceSegments}from'./recognition-source-segments.mjs'
export const RELATIVE_CUTOFF_VERSION='cited-relative-cutoff-1.0.1'
const compact=s=>String(s??'').replace(/\s/gu,'')
function sourceSpan(e,source){
 const q=e?.quote??e?.quotedText;if(typeof q!=='string'||!q)return null
 if(Number.isInteger(e.textStart)||Number.isInteger(e.textEnd))return Number.isInteger(e.textStart)&&Number.isInteger(e.textEnd)&&source.slice(e.textStart,e.textEnd)===q?{start:e.textStart,end:e.textEnd,quote:q}:null
 const segment=e.segmentId?sourceSegments(source).find(s=>s.id===e.segmentId):{start:0,text:source};if(!segment)return null
 const at=segment.text.indexOf(q);return at>=0&&segment.text.indexOf(q,at+1)<0?{start:segment.start+at,end:segment.start+at+q.length,quote:q}:null
}
/** Only a declared cutoff formula plus one existing, cited event anchor can
 * derive a date. This never invents a missing time point, event or owner. */
export function citedRelativeCutoff(point,result,evidence,source,{referenceTime,timezone='Asia/Shanghai'}={}){
 if(!/^(?:registration|submission|task)_deadline$/u.test(point?.type??'')||typeof source!=='string'||/更正|作废|不再提前|以[^。]{0,20}为准/u.test(source))return null
 const spans=new Map((evidence??[]).map(e=>[e.id,sourceSpan(e,source)]).filter(([,s])=>s)),map=new Map([...spans].map(([id,s])=>[id,s.quote])),cited=(point.evidenceIds??[]).filter(id=>map.has(id))
 const formulas=cited.filter(id=>{const q=compact(map.get(id)),m=/(?:预约|报名)(?:的)?截止(?:时间)?(?:为|是|[:：])?(?:讲座|活动|培训|报告会)?(?:开场|开始)(?:时间)?前(?:一|1)周/u.exec(q);return m&&!/不|非|取消|作废/u.test(q.slice(Math.max(0,m.index-6),m.index))})
 if(!formulas.length)return null
 const anchors=[]
 const tasks=[...(result.standaloneTasks??[]),...(result.milestones??[]).flatMap(m=>[...(m.tasks??[]),...(m.workPackages??[]).flatMap(w=>w.tasks??[])])],owners=new Set([...(point.relatedTaskTempIds??[]),...tasks.filter(t=>t.timePointTempIds?.includes(point.tempId)).map(t=>t.tempId)])
 for(const event of result.events??[]){
  const start=(result.timePoints??[]).find(p=>p.tempId===event.startTimePointTempId);if(!start||start.type!=='event_start')continue
  if(owners.size&&event.relatedTaskTempIds?.length&&!event.relatedTaskTempIds.some(id=>owners.has(id)))continue
  // Evidence IDs are model-local names. Compare the verified occurrence in
  // the unchanged source, and require this cutoff to cite that occurrence.
  const ids=(start.evidenceIds??[]).filter(id=>!formulas.includes(id)&&spans.has(id)),matches=ids.flatMap(id=>{const s=spans.get(id),p=projectLiteralSourceEvidence({evidence:[{id:'anchor',quote:start.rawText}]},s.quote),literal=p.result.evidence[0].quote,at=s.quote.indexOf(literal);if(at<0||s.quote.indexOf(literal,at+1)>=0)return[];const begin=s.start+at,end=begin+literal.length;return cited.some(cid=>!formulas.includes(cid)&&spans.get(cid).start<=begin&&spans.get(cid).end>=end)?[{id,q:s.quote,begin,end}]:[]})
  if(!matches.length||new Set(matches.map(s=>s.begin+':'+s.end)).size!==1)continue
  const q=matches[0].q
  let anchorLiteral=start.rawText
  const range=/^((?:\d{4}年)?\d{1,2}月\d{1,2}日)(\d{1,2}:[0-5]\d)[-—–至到](\d{1,2}:[0-5]\d)$/u.exec(compact(start.rawText))
  if(range){const a=range[2].split(':').map(Number),b=range[3].split(':').map(Number);if(a[0]>=24||b[0]>=24||a[0]*60+a[1]>=b[0]*60+b[1])continue;anchorLiteral=range[1]+range[2]}
  const a=parseChineseTimeAst(anchorLiteral,{referenceTime,timezone,type:'event_start'});if(a.precision!=='exact'||a.needsConfirmation||!a.normalizedValue)continue
  const local=String(a.normalizedValue).replace(/(?:Z|[+-]\d{2}:\d{2})$/u,''),stamp=Date.parse(local+'Z');if(!Number.isFinite(stamp))continue
  const date=new Date(stamp-7*86400000).toISOString().slice(0,16),[day,clock]=date.split('T'),[y,m,d]=day.split('-')
  anchors.push({dateLiteral:`${y}年${Number(m)}月${Number(d)}日`,endpoint:`${y}年${Number(m)}月${Number(d)}日${clock}`,expectedLocal:date,context:map.get(formulas[0])+'\n'+q,evidenceIds:[...new Set([...formulas,...matches.map(m=>m.id)])],anchorEventId:event.tempId,anchorPointId:start.tempId,rule:'EXPLICIT_ONE_WEEK_BEFORE_UNIQUE_CITED_EVENT_START',version:RELATIVE_CUTOFF_VERSION})
 }
 return anchors.length===1?anchors[0]:null
}
