import{parseChineseTimeAst}from'./chinese-time-ast.generated.mjs'
import{projectLiteralSourceEvidence}from'./recognition-literal-evidence.mjs'
export const RELATIVE_CUTOFF_VERSION='cited-relative-cutoff-1.0.0'
const compact=s=>String(s??'').replace(/\s/gu,'')
/** Only a declared cutoff formula plus one existing, cited event anchor can
 * derive a date. This never invents a missing time point, event or owner. */
export function citedRelativeCutoff(point,result,evidence,source,{referenceTime,timezone='Asia/Shanghai'}={}){
 if(!/^(?:registration|submission|task)_deadline$/u.test(point?.type??'')||typeof source!=='string'||/更正|作废|不再提前|以[^。]{0,20}为准/u.test(source))return null
 const map=new Map((evidence??[]).filter(e=>typeof e.quote==='string'&&source.includes(e.quote)).map(e=>[e.id,e.quote])),cited=(point.evidenceIds??[]).filter(id=>map.has(id))
 const formulas=cited.filter(id=>{const q=compact(map.get(id)),m=/(?:预约|报名)(?:的)?截止(?:时间)?(?:为|是|[:：])?(?:讲座|活动|培训|报告会)?(?:开场|开始)(?:时间)?前(?:一|1)周/u.exec(q);return m&&!/不|非|取消|作废/u.test(q.slice(Math.max(0,m.index-6),m.index))})
 if(!formulas.length)return null
 const anchors=[]
 for(const event of result.events??[]){
  const start=(result.timePoints??[]).find(p=>p.tempId===event.startTimePointTempId);if(!start||start.type!=='event_start')continue
  const ids=(start.evidenceIds??[]).filter(id=>cited.includes(id)&&!formulas.includes(id)&&map.has(id));if(!ids.length)continue
  const q=ids.map(id=>map.get(id)).find(q=>{const p=projectLiteralSourceEvidence({evidence:[{id:'anchor',quote:start.rawText}]},q);return q.includes(p.result.evidence[0].quote)});if(!q)continue
  let anchorLiteral=start.rawText
  const range=/^((?:\d{4}年)?\d{1,2}月\d{1,2}日)(\d{1,2}:[0-5]\d)[-—–至到](\d{1,2}:[0-5]\d)$/u.exec(compact(start.rawText))
  if(range){const a=range[2].split(':').map(Number),b=range[3].split(':').map(Number);if(a[0]>=24||b[0]>=24||a[0]*60+a[1]>=b[0]*60+b[1])continue;anchorLiteral=range[1]+range[2]}
  const a=parseChineseTimeAst(anchorLiteral,{referenceTime,timezone,type:'event_start'});if(a.precision!=='exact'||a.needsConfirmation||!a.normalizedValue)continue
  const local=String(a.normalizedValue).replace(/(?:Z|[+-]\d{2}:\d{2})$/u,''),stamp=Date.parse(local+'Z');if(!Number.isFinite(stamp))continue
  const date=new Date(stamp-7*86400000).toISOString().slice(0,16),[day,clock]=date.split('T'),[y,m,d]=day.split('-')
  anchors.push({dateLiteral:`${y}年${Number(m)}月${Number(d)}日`,endpoint:`${y}年${Number(m)}月${Number(d)}日${clock}`,expectedLocal:date,context:map.get(formulas[0])+'\n'+q,evidenceIds:[...new Set([...formulas,...ids])],anchorEventId:event.tempId,anchorPointId:start.tempId,rule:'EXPLICIT_ONE_WEEK_BEFORE_UNIQUE_CITED_EVENT_START',version:RELATIVE_CUTOFF_VERSION})
 }
 return anchors.length===1?anchors[0]:null
}
