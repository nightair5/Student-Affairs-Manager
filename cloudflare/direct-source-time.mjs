import {parseTwoStepTime} from './two-step-time.mjs'
import {sourceTimeKind} from './source-time-kind.mjs'
export const DIRECT_SOURCE_TIME_VERSION='direct-source-time-1.0.9'
const weekdays={日:0,天:0,一:1,二:2,三:3,四:4,五:5,六:6}
const next=v=>{if(!v)return v;const d=new Date(v.slice(0,10)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10)+v.slice(10)}
/** Formatting adapter for the opt-in direct path. Evidence remains the exact
 * original span. It neither changes the legacy parser nor resolves ambiguity. */
export function parseDirectSourceTime(raw,options){
 options={...options,resolveBareWeekday:true}
 // Compact clocks are accepted only with an explicit day period and cutoff
 // marker. Ordinary quantities such as “700人” are never clock candidates.
 let invalidCompactClock=false
 const compactClock=raw.normalize('NFKC').replace(/(凌晨|早上|上午|中午|下午|傍晚|晚上|夜间|夜里|晚)([0-9]{3,4})(?=(?:之前|以前|前|截止|为止)(?:[^\d]|$))/gu,(match,period,digits)=>{
  const hour=Number(digits.slice(0,-2)),minute=Number(digits.slice(-2))
  if(hour<1||hour>23||minute>=60){invalidCompactClock=true;return match}
  return `${period}${hour}:${String(minute).padStart(2,'0')}`
 })
 if(invalidCompactClock)return {rawText:raw,normalizedValue:null,rangeEndNormalizedValue:null,timezone:options.timezone,precision:'vague',isAllDay:false,needsConfirmation:true,issues:['invalid_compact_clock'],formatRule:'INVALID_COMPACT_CLOCK_NOT_RESOLVED'}
 if(compactClock!==raw.normalize('NFKC'))return {...parseDirectSourceTime(compactClock,options),rawText:raw,formatRule:'EXPLICIT_PERIOD_COMPACT_CLOCK'}
 const typed=sourceTimeKind(raw)
 if(typed.calendarText===null)return {rawText:raw,normalizedValue:null,rangeEndNormalizedValue:null,precision:'vague',isAllDay:false,needsConfirmation:true,issues:[typed.kind==='recurrence'?'recurring_schedule_requires_anchor':'non_calendar_range'],formatRule:'SOURCE_TIME_KIND_PRESERVED'}
 if(typed.calendarText!==raw)return {...parseDirectSourceTime(typed.calendarText,options),rawText:raw,formatRule:'NON_CALENDAR_QUANTITIES_EXCLUDED'}
 // Normalize the grammar of a source time before interpreting its meaning.
 // This is a parsing view only: evidence and rawText retain original UTF-16
 // positions. A date separator, layout break or range glyph is not a role.
 const typography=raw.normalize('NFKC')
  .replace(/(?<!\d)(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})(?!\d)/gu,'$1年$2月$3日')
  .replace(/(?<=日)T(?=\d)/gu,'')
  .replace(/(?<=\d)\s*[~～]\s*(?=\d)/gu,'至')
 if(typography!==raw.normalize('NFKC'))return {...parseDirectSourceTime(typography,options),rawText:raw,formatRule:'SOURCE_TIME_TYPOGRAPHY_NORMALIZED'}
 // Preserve the date/clock boundary before removing layout. A published
 // ISO-like timestamp is not a date interval separated by hyphens.
 const iso=/^(\d{4})-(\d{2})-(\d{2})[ T]+(\d{1,2}):(\d{2})(?::00)?$/u.exec(raw.normalize('NFKC').trim())
 if(iso){
  const [,year,month,day,hour,minute]=iso
  return {...parseDirectSourceTime(year+'年'+month+'月'+day+'日'+hour+':'+minute,options),rawText:raw,formatRule:'EXPLICIT_DATE_CLOCK_SEPARATOR'}
 }
 const compact=raw.normalize('NFKC').replace(/\s/gu,'').replace(/(?<![\d.])(\d{1,2})\.(\d{1,2})(?=日|号)/gu,'$1月$2').replace(/(\d{1,2})月(\d{1,2})([-—–至到])(\d{1,2})日/gu,'$1月$2日$3$1月$4日'),decorations=[...compact.matchAll(/\((?:周|星期)([一二三四五六日天])\)/gu)],unadorned=compact.replace(/\((?:周|星期)[一二三四五六日天]\)/gu,''),revision=/原定|原截止|旧截止|原时间/u.test(unadorned)&&/调整至|调整为|更正为|更改为|变更为|改至|延期至/u.test(unadorned),clean=revision?unadorned.replace(/调整至|调整为|更正为|更改为|变更为|改至|延期至/gu,'改为'):unadorned
 const closedApplication=/申请|申报|报名/u.test(clean)&&/逾期[^。；]{0,20}(?:不再受理|不予受理|不受理)/u.test(clean)&&!/办理窗口|开放时间/u.test(clean)
 const cutoffInput=closedApplication?clean.replace(/((?:\d{4}年)?(?:\d{1,2}月)?\d{1,2}日(?:\d{1,2}:\d{2})?)(?=[，,。])/u,'$1前'):clean
 let parsed=parseTwoStepTime(clean,options),rule=revision?'EXPLICIT_REVISION_CUE_CANONICALIZED':decorations.length?'SOURCE_WEEKDAY_DECORATION_REMOVED':null
 const midnight=/24(?::00(?::00)?|时(?:00分)?|点)(?![0-9:])/u
 if((parsed.needsConfirmation||parsed.issues.includes('invalid_clock'))&&midnight.test(clean)&&!/24:[0-5][1-9]|24:[1-5][0-9]/u.test(clean)){
  const canonical=clean.replace(/(?:晚上|夜间|夜里|晚间|晚)(?=24(?::00|时|点))/u,'').replace(midnight,'00:00'),p=parseTwoStepTime(canonical,options)
  const range=/^(.*?)(?:至|到|[-—–~～])((?:\d{4}年)?\d{1,2}月\d{1,2}日)?(?:晚上|夜间|夜里|晚间|晚)?24(?::00(?::00)?|时(?:00分)?|点)(?![0-9:])/u.exec(clean)
  if(range){const start=parseTwoStepTime(range[1],options),end=range[2]?parseTwoStepTime(range[2]+'00:00',options):null;if(start.normalizedValue?.includes('T')&&!start.needsConfirmation&&(!end||end.normalizedValue&&!end.needsConfirmation)){const civilMidnight=end?.normalizedValue??start.normalizedValue.slice(0,10)+'T00:00';Object.assign(p,start,{rangeEndNormalizedValue:next(civilMidnight),needsConfirmation:false,precision:'exact',isAllDay:false})}}
  if(p.normalizedValue&&p.precision==='exact'&&!p.needsConfirmation){
   if(p.rangeEndNormalizedValue){if(!range&&p.rangeEndNormalizedValue.slice(0,10)<=p.normalizedValue.slice(0,10))p.rangeEndNormalizedValue=next(p.rangeEndNormalizedValue)}else p.normalizedValue=next(p.normalizedValue)
   parsed=p;rule='EXPLICIT_24H_CIVIL_DAY_ROLLOVER'
  }
 }
 if(decorations.length&&parsed.normalizedValue){const date=rule==='EXPLICIT_24H_CIVIL_DAY_ROLLOVER'&&!parsed.rangeEndNormalizedValue?new Date(parsed.normalizedValue.slice(0,10)+'T00:00:00Z'):null;if(date)date.setUTCDate(date.getUTCDate()-1);const day=(date??new Date(parsed.normalizedValue.slice(0,10)+'T00:00:00Z')).getUTCDay();if(decorations.length===1&&weekdays[decorations[0][1]]!==day)return{...parsed,rawText:raw,normalizedValue:null,rangeEndNormalizedValue:null,precision:'vague',isAllDay:false,needsConfirmation:true,issues:[...parsed.issues,'weekday_date_conflict'],formatRule:'SOURCE_WEEKDAY_CONFLICT_NOT_RESOLVED'}}
 const weekdayBeforeDate=[...compact.matchAll(/(?:周|星期|礼拜)([一二三四五六日天])\((?=(?:\d{4}年)?\d{1,2}月\d{1,2}[日号]?\))/gu)]
 if(weekdayBeforeDate.length===1&&parsed.normalizedValue&&weekdays[weekdayBeforeDate[0][1]]!==new Date(parsed.normalizedValue.slice(0,10)+'T00:00:00Z').getUTCDay())return{...parsed,rawText:raw,normalizedValue:null,rangeEndNormalizedValue:null,precision:'vague',isAllDay:false,needsConfirmation:true,issues:[...parsed.issues,'weekday_date_conflict'],formatRule:'SOURCE_WEEKDAY_CONFLICT_NOT_RESOLVED'}
 if(/下班前|午休前|上班前/u.test(clean)&&!/[0-2]?[0-9]:[0-5][0-9]/u.test(clean))return{...parsed,rawText:raw,normalizedValue:null,rangeEndNormalizedValue:null,precision:'vague',isAllDay:false,needsConfirmation:true,issues:[...parsed.issues,'office_clock_not_stated'],formatRule:'UNSTATED_OFFICE_CLOCK_NOT_RESOLVED'}
 // For an explicitly qualified cutoff range, parse the endpoint on its own.
 // The generic parser may attach the last clock to the first date. Never let
 // that accidental combination become an earlier submission deadline.
 if(/deadline$/u.test(options.type)&&!revision&&!/任选|备选|可选择|或/u.test(clean)){
  const range=/(?:(?<sy>\d{4})年)?(?<sm>\d{1,2})月(?<sd>\d{1,2})日(?:[^，。；;]{0,16}?)(?:至|到|[-—–~～])(?:(?<ey>\d{4})年)?(?:(?<em>\d{1,2})月)?(?<ed>\d{1,2})日(?<clock>(?:(?:上午|下午|晚上|中午|凌晨)?\d{1,2}(?::\d{2}|[时点](?:\d{1,2}分?)?)(?:分)?)?)(?:之前|以前|前|截止|为止)/u.exec(closedApplication?cutoffInput:clean)
  const relative=/即日起(?:至|到)(?<end>(?:\d{4}年)?(?:\d{1,2}月)?\d{1,2}日(?:(?:上午|下午|晚上|中午|凌晨)?\d{1,2}(?::\d{2}|[时点](?:\d{1,2}分?)?))?)/u.exec(clean)
  if(range){const g=range.groups,year=g.ey??(g.sy?String(Number(g.sy)+(g.em&&Number(g.em)<Number(g.sm)?1:0)):null),month=g.em??g.sm,base=parseTwoStepTime((g.sy?g.sy+'年':'')+g.sm+'月'+g.sd+'日',options),inferredYear=year??(base.normalizedValue?String(Number(base.normalizedValue.slice(0,4))+(Number(month)<Number(g.sm)?1:0)):null),endpoint=(inferredYear?inferredYear+'年':'')+month+'月'+g.ed+'日'+g.clock,end=parseDirectSourceTime(endpoint,options);if(end.normalizedValue&&!end.needsConfirmation){parsed={...end,rangeEndNormalizedValue:end.normalizedValue};rule='EXPLICIT_CUTOFF_RANGE_USES_ENDPOINT'}}
  else if(relative){const end=parseTwoStepTime(relative.groups.end,options);if(end.normalizedValue&&!end.needsConfirmation){parsed={...end,rangeEndNormalizedValue:end.normalizedValue};rule='FROM_NOW_RANGE_USES_ENDPOINT'}}
 }
 return{...parsed,rawText:raw,formatRule:rule}
}
