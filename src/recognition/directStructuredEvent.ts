import {parseChineseTimeAst} from '../lib/timeSemantics'

/** Interpret an unqualified weekday only within the current reference week.
 * The caller must label this inferred calendar date as needing confirmation. */
export function sameWeekdayTime(raw:string,referenceTime:string,timezone='Asia/Shanghai'){
 const match=/^\s*周([一二三四五六日天])(?=\s|\d|上午|中午|下午|晚上)/u.exec(raw)
 if(!match)return null
 const reference=new Date(referenceTime);if(!Number.isFinite(reference.getTime()))return null
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(reference)
 const part=(type:Intl.DateTimeFormatPartTypes)=>Number(parts.find(p=>p.type===type)?.value)
 const day=new Date(Date.UTC(part('year'),part('month')-1,part('day'))).getUTCDay()||7
 const desired=({'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':7,'天':7} as Record<string,number>)[match[1]]
 if(desired<day)return null
 const parsed=parseChineseTimeAst(raw.replace(/^\s*周/u,'本周'),{type:'event_start',referenceTime,timezone})
 return parsed.normalizedValue&&parsed.precision==='exact'&&!parsed.needsConfirmation?{...parsed,formatRule:null}:null
}

/** A single labelled, explicitly optional invitation, with no guessed owner. */
export function structuredOptionalEvent(source:string){
 // This recovery uses one contiguous evidence span, bounded by the existing
 // recognition contract. Longer or ambiguous sources remain untouched.
 if(source.length>500)return null
 if(/取消|作废|不再举办|禁止参加|不要参加|请勿参加/u.test(source))return null
 // Do not fold a separate instructed delivery into an attendance-only item.
 if(/(?:^|[，,；;。！？\n])\s*(?:请|须|需|务必|应)[^。！？\n]{0,35}(?:提交|报名|填写|登记|缴费|上传|领取|准备|完成|撰写)/u.test(source))return null
 const headings=[...source.matchAll(/【([^】\n]{3,60})】/gu)].filter(m=>/(?:培训会|说明会|讲座|宣讲会|研讨会|交流会|报告会|会议)(?:通知|公告)?$/u.test(m[1].trim()))
 const times=[...source.matchAll(/(?:^|\n)[^\S\r\n]*(?:⏰\s*)?(?:活动时间|会议时间|时间)[：:]\s*([^\n（(]+)/gu)]
 const locations=[...source.matchAll(/(?:^|\n)[^\S\r\n]*(?:📍\s*)?(?:活动地点|会议地点|地点)[：:]\s*([^\n（(]+)/gu)]
 if(headings.length!==1||times.length!==1||locations.length!==1)return null
 const invitation=source.match(/有意向[^。！？\n]{0,35}(?:建议|欢迎|可以|可)[^。！？\n]{0,20}(?:到场|参加|出席)/u)
 if(!invitation)return null
 const title=headings[0][1].trim().replace(/(?:通知|公告)$/u,'').trim(),time=times[0][1].trim(),location=locations[0][1].trim()
 if(!title||!time||time.length>160||!location||location.length>160||!source.includes(title)||!source.includes(time)||!source.includes(location)||/任选|备选|或/u.test(time))return null
 return {title,time,location}
}
