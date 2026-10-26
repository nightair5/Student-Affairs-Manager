import {parseTwoStepTime} from './two-step-time.mjs'
export const DIRECT_SOURCE_TIME_VERSION='direct-source-time-1.0.0'
const weekdays={日:0,天:0,一:1,二:2,三:3,四:4,五:5,六:6}
const next=v=>{if(!v)return v;const d=new Date(v.slice(0,10)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)+v.slice(10)}
/** Formatting adapter for the opt-in direct path. Evidence remains the exact
 * original span. It neither changes the legacy parser nor resolves ambiguity. */
export function parseDirectSourceTime(raw,options){
 const compact=raw.normalize('NFKC').replace(/\s/gu,''),decorations=[...compact.matchAll(/\((?:周|星期)([一二三四五六日天])\)/gu)],clean=compact.replace(/\((?:周|星期)[一二三四五六日天]\)/gu,'')
 let parsed=parseTwoStepTime(clean,options),rule=decorations.length?'SOURCE_WEEKDAY_DECORATION_REMOVED':null
 const midnight=/24(?::00(?::00)?|时(?:00分)?|点)(?![0-9:])/u
 if((parsed.needsConfirmation||parsed.issues.includes('invalid_clock'))&&midnight.test(clean)&&!/24:[0-5][1-9]|24:[1-5][0-9]/u.test(clean)){
  const canonical=clean.replace(/(?:晚上|夜间|夜里|晚间)(?=24(?::00|时|点))/u,'').replace(midnight,'00:00'),p=parseTwoStepTime(canonical,options)
  const range=/^(.*?)(?:至|到|[-—–~～])((?:\d{4}年)?\d{1,2}月\d{1,2}日)?(?:晚上|夜间|夜里|晚间)?24(?::00(?::00)?|时(?:00分)?|点)(?![0-9:])/u.exec(clean)
  if(range){const start=parseTwoStepTime(range[1],options),end=range[2]?parseTwoStepTime(range[2]+'00:00',options):null;if(start.normalizedValue?.includes('T')&&!start.needsConfirmation&&(!end||end.normalizedValue&&!end.needsConfirmation)){const civilMidnight=end?.normalizedValue??start.normalizedValue.slice(0,10)+'T00:00';Object.assign(p,start,{rangeEndNormalizedValue:next(civilMidnight),needsConfirmation:false,precision:'exact',isAllDay:false})}}
  if(p.normalizedValue&&p.precision==='exact'&&!p.needsConfirmation){
   if(p.rangeEndNormalizedValue){if(!range&&p.rangeEndNormalizedValue.slice(0,10)<=p.normalizedValue.slice(0,10))p.rangeEndNormalizedValue=next(p.rangeEndNormalizedValue)}else p.normalizedValue=next(p.normalizedValue)
   parsed=p;rule='EXPLICIT_24H_CIVIL_DAY_ROLLOVER'
  }
 }
 if(decorations.length&&parsed.normalizedValue){const date=rule==='EXPLICIT_24H_CIVIL_DAY_ROLLOVER'&&!parsed.rangeEndNormalizedValue?new Date(parsed.normalizedValue.slice(0,10)+'T00:00:00Z'):null;if(date)date.setUTCDate(date.getUTCDate()-1);const day=(date??new Date(parsed.normalizedValue.slice(0,10)+'T00:00:00Z')).getUTCDay();if(decorations.length===1&&weekdays[decorations[0][1]]!==day)return{...parsed,rawText:raw,normalizedValue:null,rangeEndNormalizedValue:null,precision:'vague',isAllDay:false,needsConfirmation:true,issues:[...parsed.issues,'weekday_date_conflict'],formatRule:'SOURCE_WEEKDAY_CONFLICT_NOT_RESOLVED'}}
 if(/下班前|午休前|上班前/u.test(clean)&&!/[0-2]?[0-9]:[0-5][0-9]/u.test(clean))return{...parsed,rawText:raw,normalizedValue:null,rangeEndNormalizedValue:null,precision:'vague',isAllDay:false,needsConfirmation:true,issues:[...parsed.issues,'office_clock_not_stated'],formatRule:'UNSTATED_OFFICE_CLOCK_NOT_RESOLVED'}
 return{...parsed,rawText:raw,formatRule:rule}
}
