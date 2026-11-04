import {fetchAuthorizedLinkText,LinkExtractionError,type LinkExtractionResult} from './linkExtraction'

type Role='notice'|'action'|'meeting'|'unsupported'
export interface NoticeLink {url:string;role:Role;start:number;end:number}
export interface NoticeLinkPlan {links:NoticeLink[];meaningfulText:boolean}
export interface NoticeLinkOutcome {
 content:string
 partial:boolean
 failed:boolean
 unreadCount:number
 segments:Array<{kind:'input'|'web';start:number;end:number;url?:string;title?:string;fetchedAt?:string;role?:Role}>
 links:Array<{url:string;role:Role;status:'read'|'failed'|'skipped'|'limit'|'disabled';partial?:boolean;reason?:string}>
}
const URL_PATTERN=/https?:\/\/[^\s<>"'“”‘’，。；！？、]+/giu
const SECRET_KEY=/^(?:access[_-]?token|token|auth(?:orization)?|auth[_-]?key|secret|password|passwd|pwd|signature|sig|ticket|api[_-]?key|key|code|session(?:id)?|afc|ossaccesskeyid|x-amz-.+|x-goog-.+|x-oss-.+)$/iu
const trimTail=(value:string)=>value.replace(/[，。；;！!？?、\]】）》〉]+$/u,'').replace(/\)+$/u,tail=>tail.length>(value.match(/\(/gu)?.length??0)?tail.slice(1):tail)
const sensitive=(url:URL)=>{let hash=url.hash;try{hash=decodeURIComponent(hash)}catch{/* invalid encoded fragments stay opaque */}return Boolean(url.username||url.password||[...url.searchParams.keys()].some(key=>SECRET_KEY.test(key))||/(?:token|secret|password|signature|session|ticket|code)\s*=/iu.test(hash))}

/** Only explicit, user-pasted URLs are candidates; page links are not crawled. */
export function planNoticeLinks(input:string):NoticeLinkPlan {
 const matches=[...input.matchAll(URL_PATTERN)],only=matches.length===1&&input.replace(matches[0][0],'').trim()===''
 const links:NoticeLink[]=matches.flatMap(match=>{
  const raw=trimTail(match[0]);let parsed:URL
  try{parsed=new URL(raw)}catch{return []}
  if(sensitive(parsed))throw Error('链接可能包含访问凭据；请移除凭据或粘贴通知正文，输入不会发送。')
  const start=match.index,end=start+raw.length
  const line=input.slice(Math.max(...['\n','。','；',';', '，',','].map(mark=>input.lastIndexOf(mark,start-1)))+1,start)
  const near=line.slice(-50),host=parsed.hostname.toLowerCase(),path=parsed.pathname.toLowerCase()
  const meeting=/(?:会议(?:链接|入口|地址)|线上参会|参会链接)/u.test(near)||/(?:^|\.)(?:zoom\.us|meeting\.tencent\.com|teams\.microsoft\.com)$/u.test(host)||/\/meeting(?:\/|$)/u.test(path)
  const action=/(?:问卷|报名(?:表|链接|入口)|提交(?:链接|入口|地址)|填写(?:链接|入口)|签到链接)/u.test(near)||/(?:^|\/)(?:form|forms|survey|questionnaire)(?:\/|$)/u.test(path)
  const explicit=/(?:通知原文|通知详情|原文链接|原通知|具体通知|详情(?:链接|见)?|政策原文|公告链接)/u.test(near)
  const last=(pattern:RegExp)=>[...near.matchAll(pattern)].at(-1)?.index??-1
  const lastNotice=last(/通知原文|通知详情|原文链接|原通知|具体通知|详情(?:链接|见)?|政策原文|公告链接/gu)
  const lastAction=last(/问卷|报名(?:表|链接|入口)|提交(?:链接|入口|地址)|填写(?:链接|入口)|签到链接/gu)
  const role:Role=parsed.protocol!=='https:'?'unsupported':meeting?'meeting':only?'notice':action&&(!explicit||lastAction>lastNotice)?'action':'notice'
  return [{url:parsed.toString(),role,start,end}]
 })
 const remainder=links.reduceRight((text,link)=>text.slice(0,link.start)+text.slice(link.end),input).replace(/[\s\p{P}\p{S}]/gu,'')
 const meaningfulText=remainder.length>=4&&!/^(?:请查看|请阅读|查看|阅读|通知原文|详情|原文链接|具体通知|通知详情|会议链接|报名链接|问卷链接|链接)+$/u.test(remainder)
 return {links,meaningfulText}
}

function redactPageSecrets(text:string):{text:string;redacted:boolean}{
 let redacted=false
 const cleaned=text.replace(URL_PATTERN,raw=>{
  const value=trimTail(raw)
  try{const url=new URL(value);if(!sensitive(url))return raw;redacted=true;return `${url.origin}${url.pathname}[敏感链接参数已隐藏]${raw.slice(value.length)}`}catch{return raw}
 })
 return {text:cleaned,redacted}
}

export async function readNoticeLinks(input:string,plan:NoticeLinkPlan,enabled:boolean,reader:(url:string)=>Promise<LinkExtractionResult>=fetchAuthorizedLinkText):Promise<NoticeLinkOutcome>{
 // Detail pages have priority. Public form descriptions may also be read as
 // plain text, but the form is never filled or submitted; meetings are skipped.
 const candidates=[...plan.links.filter(link=>link.role==='notice'),...plan.links.filter(link=>link.role==='action')]
 const chosen=enabled?candidates.slice(0,3):[]
 const results=await Promise.all(chosen.map(async link=>{
  try{return {link,result:await reader(link.url),reason:undefined}}catch(error){
   const code=error instanceof LinkExtractionError?error.code:error instanceof Error&&['TimeoutError','AbortError'].includes(error.name)?'WEB_FETCH_TIMEOUT':'WEB_FETCH_FAILED'
   return {link,result:null,reason:code}
  }
 }))
 let content=input,partial=false
 const segments:NoticeLinkOutcome['segments']=[{kind:'input',start:0,end:input.length}]
 const links:NoticeLinkOutcome['links']=plan.links.map(link=>{
  const found=results.find(item=>item.link===link)
  if(!enabled&&(link.role==='notice'||link.role==='action'))return {url:link.url,role:link.role,status:'disabled'}
  if(link.role==='unsupported')return {url:link.url,role:link.role,status:'failed',reason:'WEB_HTTPS_REQUIRED'}
  if(link.role==='meeting')return {url:link.url,role:link.role,status:'skipped'}
  if(!chosen.includes(link))return {url:link.url,role:link.role,status:'limit'}
  if(!found?.result)return {url:link.url,role:link.role,status:'failed',reason:found?.reason??'WEB_FETCH_FAILED'}
  return {url:link.url,role:link.role,status:'read',partial:found.result.partial===true}
 })
 for(const {link,result} of results){
  if(!result)continue
  const safe=redactPageSecrets(result.text),safeTitle=redactPageSecrets(result.title),header=`\n\n【${link.role==='action'?'公开操作说明':'网页正文'} ${segments.length}：${safeTitle.text}】\n`
  content+=header
  const start=content.length;content+=safe.text
  segments.push({kind:'web',start,end:content.length,url:link.url,title:safeTitle.text,fetchedAt:result.fetchedAt,role:link.role})
  if(result.partial||safe.redacted||safeTitle.redacted)partial=true
 }
 const unreadCount=links.filter(link=>['failed','limit','disabled'].includes(link.status)).length
 partial=partial||unreadCount>0||content.length>24_000
 return {content,partial,failed:segments.length===1&&!plan.meaningfulText&&plan.links.length>0,unreadCount,segments,links}
}

/** Safe, user-facing explanations never interpolate an arbitrary URL or error. */
export function noticeLinkMessage(outcome:NoticeLinkOutcome):string {
 const reasons=outcome.links.flatMap(link=>link.reason?[link.reason]:[])
 if(outcome.failed&&outcome.links.every(link=>link.role==='meeting'||link.role==='action'))return '这是会议或操作入口，请粘贴包含具体事项的通知正文。'
 const unread=outcome.links.flatMap((link,index)=>['failed','limit','disabled'].includes(link.status)?[index+1]:[])
 const prefix=unread.length?`第 ${unread.join('、')} 个链接未读取。`:''
 const limit=outcome.links.some(link=>link.status==='limit')?'每次最多读取 3 个网页，可单独粘贴未读取的链接继续。':''
 let reason=''
 if(reasons.includes('WEB_ACCESS_RESTRICTED'))reason='目标网页需要登录或拒绝访问，请粘贴正文。'
 else if(reasons.some(value=>value==='RATE_LIMITED'||value==='WEB_TARGET_RATE_LIMITED'))reason='网页访问受到频率限制，请稍后重试或粘贴正文。'
 else if(reasons.includes('WEB_FETCH_TIMEOUT'))reason='网页读取超时，请稍后重试或粘贴正文。'
 else if(reasons.includes('WEB_NOT_FOUND'))reason='网页不存在或已失效，请检查链接或粘贴正文。'
 else if(reasons.includes('WEB_HTTPS_REQUIRED'))reason='只支持读取公开 HTTPS 网页，请粘贴正文。'
 else if(reasons.some(value=>['WEB_PRIVATE_ADDRESS_FORBIDDEN','WEB_OWN_ORIGIN_FORBIDDEN','WEB_PORT_FORBIDDEN','WEB_SENSITIVE_URL','WEB_CREDENTIALS_FORBIDDEN'].includes(value)))reason='该链接不符合安全读取条件，请粘贴正文。'
 else if(reasons.includes('WEB_CONTENT_TYPE_UNSUPPORTED'))reason='暂只读取网页和纯文本；PDF 可上传文件或粘贴正文。'
 else if(reasons.some(value=>['WEB_TEXT_UNAVAILABLE','WEB_TEXT_EMPTY'].includes(value)))reason='网页没有返回可读取正文，请粘贴正文或上传文件。'
 else if(reasons.includes('WEB_DNS_FAILED'))reason='网页地址暂时无法解析，请稍后重试或粘贴正文。'
 else if(reasons.includes('WEB_CHARSET_UNSUPPORTED'))reason='网页编码暂不受支持，请粘贴正文。'
 else if(reasons.includes('WEB_RESPONSE_TOO_LARGE'))reason='网页内容超过读取上限，请粘贴相关正文。'
 else if(outcome.links.some(link=>link.status==='disabled'))reason='本次未开启网页读取。'
 else if(unread.length&&!limit)reason='请重试或粘贴正文。'
 if(unread.length)return `${prefix}${reason}${limit}`
 if(outcome.content.length>24_000)return '网页文字较长，部分内容未进入整理，请打开原文补充。'
 if(outcome.partial)return '网页有部分内容未能处理，请打开原文补充。'
 return ''
}
