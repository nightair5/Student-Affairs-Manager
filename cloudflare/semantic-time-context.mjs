import {parseDirectSourceTime} from './direct-source-time.mjs'

const folded=value=>value.normalize('NFKC').replace(/\s/gu,'')
/** Line breaks around a clock/cutoff are layout, while numbered headings and
 * separate sentences still bound the time's role. */
export function timeRoleContext(source,span){
 const before=source.slice(Math.max(0,span.start-100),span.start)
 const after=source.slice(span.end,Math.min(source.length,span.end+100))
 const left=Math.max(before.lastIndexOf('。'),before.lastIndexOf('；'),before.lastIndexOf(';'),before.lastIndexOf('！'),before.lastIndexOf('？'))+1
 const right=after.search(/[。；;！？]/u)
 let prefix=before.slice(left),suffix=right<0?after:after.slice(0,right)
 const beforeLines=prefix.split('\n'),afterLines=suffix.split('\n')
 // Keep only layout adjacent to an explicit cutoff label or suffix. Other
 // lines may contain another item's deadline and cannot authorize this one.
 const explicitRole=/(?:截止(?:时间)?|截至|最迟|不晚于|请于|请在)\s*(?:为|是)?\s*[：:]?\s*$/u.test(prefix)
 const explicitQualifier=/(?:暂定|拟定|预计|建议|推荐)(?:时间|日期)?\s*(?:为|是|在|于)?\s*[：:]?\s*$/u.test(prefix)
 if(beforeLines.length>1&&!explicitRole&&!explicitQualifier){
  prefix=beforeLines.at(-1)
 }
 if(afterLines.length>1&&!/^\s*(?:[（(](?:周|星期)[一二三四五六日天][）)]\s*)?(?:之前|以前|前|为止|截止(?=$|[，,。；;]))/u.test(suffix)){
  suffix=afterLines[0]
 }
 return prefix+span.literal+suffix
}

/** Certainty qualifies a specific source time, not the entire document.
 * Only adjacent modifiers in this time's bound clause are considered. */
export function sourceTimeModality(raw,context){
 const value=folded(raw),scope=folded(context),at=scope.indexOf(value)
 const before=at<0?'':scope.slice(0,at).split(/[，,。；;]/u).at(-1)
 const after=at<0?'':scope.slice(at+value.length)
 const qualifier=before?.match(/(?:暂定|拟定|预计|建议|推荐)(?:时间|日期)?(?:为|是|在|于)?[：:]?$/u)?.[0]??''
 const attached=qualifier+value
 if(/暂定|待定|尚未确定|未确定|拟定|预计/u.test(attached)||/^[（(](?:暂定|待定|拟定)[）)]/u.test(after))return 'tentative'
 if(/^(?:建议|推荐)/u.test(attached))return 'suggested'
 return 'confirmed'
}

/** A date window with daily opening hours has two dimensions. Parse the
 * calendar bounds independently, then attach the first/last opening clocks.
 * The full daily schedule remains in rawText and the saved window label. */
export function parseWindowWithDailyHours(raw,options){
 const text=folded(raw)
 const split=text.search(/(?:每天|每日)/u)
 if(split<0)return null
 const dates=text.slice(0,split).replace(/[，,]$/u,'')
 const daily=text.slice(split).replace(/^(?:每天|每日)/u,'')
 const clock='(?:凌晨|早上|上午|中午|下午|傍晚|晚上|夜间)?(?:[0-2]?\\d:[0-5]\\d|[一二两三四五六七八九十\\d]{1,3}[点时](?:半|[一二三四五六七八九十\\d]{1,3}分?)?)'
 const schedulePattern=new RegExp('('+clock+')(?:至|到|[-—–~～])('+clock+')','gu')
 const schedules=[...daily.matchAll(schedulePattern)]
 const schedule=schedules.length&&/^[、,，;；。和及\s]*$/u.test(daily.replace(schedulePattern,''))?[null,schedules[0][1],schedules.at(-1)[2]]:null
 const range=/^(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日(?:\(([^()]*)\))?(?:至|到|[-—–~～])(?:(\d{4})年)?(?:(\d{1,2})月)?(\d{1,2})日$/u.exec(dates)
 if(!range)return null
 const [,sy,sm,sd,first,ey,em,ed]=range
 const startDay=parseDirectSourceTime((sy?sy+'年':'')+sm+'月'+sd+'日',{...options,type:'event_start'})
 if(startDay.needsConfirmation||!startDay.normalizedValue)return null
 const startYear=Number(startDay.normalizedValue.slice(0,4))
 const endYear=ey??String(startYear+(!ey&&em&&Number(em)<Number(sm)?1:0))
 // If the daily schedule cannot be parsed, keep the date bounds and its raw
 // explanation. Never let a general range parser attach the opening clock
 // to the final day as though it were the closing clock.
 if(!schedule){
  const endDay=parseDirectSourceTime(endYear+'年'+(em??sm)+'月'+ed+'日',{...options,type:'event_end'})
  if(endDay.needsConfirmation||!endDay.normalizedValue||endDay.normalizedValue<startDay.normalizedValue)return null
  return {...startDay,rawText:raw,rangeEndNormalizedValue:endDay.normalizedValue,formatRule:'DATE_WINDOW_UNRESOLVED_DAILY_HOURS'}
 }
 const firstClock=first?first.replace(/(?:开放|开启|开始)$/u,''):schedule[1]
 const start=parseDirectSourceTime(startYear+'年'+sm+'月'+sd+'日'+firstClock,{...options,type:'event_start'})
 const end=parseDirectSourceTime(endYear+'年'+(em??sm)+'月'+ed+'日'+schedule[2],{...options,type:'event_end'})
 if(start.needsConfirmation||end.needsConfirmation||!start.normalizedValue?.includes('T')||!end.normalizedValue?.includes('T')||end.normalizedValue<start.normalizedValue)return null
 return {...start,rawText:raw,rangeEndNormalizedValue:end.normalizedValue,formatRule:'DATE_WINDOW_WITH_DAILY_OPENING_HOURS'}
}
