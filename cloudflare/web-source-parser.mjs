/** Inert extraction for public documents. No page scripts or forms are run. */
const sensitiveKey=/^(?:access[_-]?token|token|auth(?:orization)?|auth[_-]?key|secret|password|passwd|pwd|signature|sig|ticket|api[_-]?key|key|code|session(?:id)?|afc|ossaccesskeyid|x-amz-.+|x-goog-.+|x-oss-.+)$/iu
export function sensitiveWebUrl(url){
 let hash=url.hash;try{hash=decodeURIComponent(hash)}catch{/* retain opaque malformed fragments */}
 return Boolean(url.username||url.password||[...url.searchParams.keys()].some(key=>sensitiveKey.test(key))||/(?:token|secret|password|signature|session|ticket|code)\s*=/iu.test(hash))
}
function entities(value){
 return value.replace(/&(#x[\da-f]+|#\d+|nbsp|ensp|emsp|amp|lt|gt|quot|apos|ldquo|rdquo|lsquo|rsquo|mdash|ndash);/giu,(_all,body)=>{
  const named={nbsp:' ',ensp:' ',emsp:' ',amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",ldquo:'“',rdquo:'”',lsquo:'‘',rsquo:'’',mdash:'—',ndash:'–'}
  if(body[0]!=='#')return named[body.toLowerCase()]??_all
  const value=body[1]?.toLowerCase()==='x'?Number.parseInt(body.slice(2),16):Number.parseInt(body.slice(1),10)
  return Number.isInteger(value)&&value>0&&value<=0x10ffff&&!(value>=0xd800&&value<=0xdfff)?String.fromCodePoint(value):'�'
 })
}
function anchorTarget(raw,base){
 try{
  const value=entities(raw.trim())
  if(/^mailto:/iu.test(value))return /^mailto:([^?\s<>]+@[^?\s<>]+)$/iu.exec(value)?.[1]??''
  const url=new URL(value,base)
  if(url.protocol!=='https:'||sensitiveWebUrl(url))return ''
  url.hash=''
  return url.toString()
 }catch{return ''}
}
/** Prefer a substantial semantic content container when a page has no article/main. */
function contentContainer(body){
 const candidates=[]
 let checked=0
 const openings=/<div\b([^<>]*)>/giu
 for(const opening of body.matchAll(openings)){
  const attrs=opening[1],identity=[...attrs.matchAll(/\b(?:id|class)\s*=\s*(?:"([^"]*)"|'([^']*)')/giu)].map(match=>match[1]??match[2]).join(' ')
  if(!/(?:^|[\s_-])(?:article|notice|news|post|entry|content|detail)(?:$|[\s_-])/iu.test(identity))continue
  if(++checked>24)break
  const start=opening.index+opening[0].length,tags=/<\/?div\b[^<>]*>/giu;tags.lastIndex=start
  let depth=1,end=-1,tag
  while((tag=tags.exec(body))!==null){depth+=/^<\//u.test(tag[0])?-1:1;if(depth===0){end=tag.index;break}}
  if(end<0)continue
  const content=body.slice(start,end),plain=content.replace(/<[^<>]*>/gu,'').replace(/\s/gu,'')
  if(plain.length>=200)candidates.push({content,score:plain.length-(content.match(/<a\b/giu)?.length??0)*20})
 }
 return candidates.sort((a,b)=>b.score-a.score)[0]?.content??null
}
function stripNonContent(body){
 const opening=/<(script|style|noscript|nav|footer|aside|iframe|svg|template|textarea)\b[^<>]*>/giu
 let result='',cursor=0,match
 while((match=opening.exec(body))!==null){
  result+=body.slice(cursor,match.index)
  const closing=new RegExp(`</${match[1]}\\s*>`,'igu');closing.lastIndex=opening.lastIndex
  if(!closing.exec(body))return {text:result,partial:true}
  cursor=closing.lastIndex;opening.lastIndex=cursor
 }
 return {text:result+body.slice(cursor),partial:false}
}
function firstElementBody(body,tagPattern){
 const start=tagPattern.exec(body)
 if(!start)return null
 const closing=new RegExp(`</${start[1]}\\s*>`,'iu'),after=body.slice(start.index+start[0].length),end=closing.exec(after)
 return end?after.slice(0,end.index):null
}
export function decodeWebBytes(bytes,contentType){
 const ascii=new TextDecoder('utf-8').decode(bytes.slice(0,2048))
 const charset=/charset\s*=\s*["']?([\w-]+)/iu.exec(contentType)?.[1]??/<meta[^>]+charset\s*=\s*["']?([\w-]+)/iu.exec(ascii)?.[1]??'utf-8'
 try{
  const decoded=new TextDecoder(charset.toLowerCase()==='gbk'?'gb18030':charset,{fatal:false}).decode(bytes)
  return {text:decoded,partial:(decoded.match(/�/gu)?.length??0)>Math.max(2,decoded.length/100)}
 }catch{throw Error('WEB_CHARSET_UNSUPPORTED')}
}
export function extractWebSource(value,{baseUrl,html=true,maxChars=80_000}={}){
 const title=html?entities((firstElementBody(value.slice(0,16_384),/<(title)\b[^<>]*>/iu)??'').replace(/<[^<>]*>/gu,' ').trim()):''
 const password=html&&/<input\b[^<>]*\btype\s*=\s*["']?password/iu.test(value)
 let body=html?(firstElementBody(value,/<(body)\b[^<>]*>/iu)??value):value
 let hasArticle=false,incomplete=false
 if(html){
  const scrubbed=stripNonContent(body);body=scrubbed.text;incomplete=scrubbed.partial
  const main=firstElementBody(body,/<(main|article)\b[^<>]*>/iu)
  if(main!==null){body=main;hasArticle=true}
  else {const content=contentContainer(body);if(content){body=content;hasArticle=true}}
  body=body.replace(/<a\b([^<>]*)>((?:(?!<a\b)[\s\S])*?)<\/a\s*>/giu,(_all,attrs,label)=>{
   const href=/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/iu.exec(attrs)
   const target=href?anchorTarget(href[1]??href[2]??href[3],baseUrl):''
   const visible=label.replace(/<[^<>]+>/gu,'').trim()
   return visible+(target&&!visible.includes(target)?`（${target}）`:'')
  })
  body=body.replace(/<(?:input|button)\b[^<>]*>/giu,' ')
    .replace(/<\/(?:td|th)\s*>/giu,'\t').replace(/<\/(?:tr|p|div|li|h[1-6]|section|article|main)\s*>|<br\s*\/?\s*>/giu,'\n')
    .replace(/<[^<>]+>/gu,'')
 }
 const all=entities(body).replace(/\r\n?/gu,'\n').split('\n').map(line=>line.replace(/[ \f\v]+/gu,' ').replace(/\s*\t\s*/gu,' · ').trim()).filter(Boolean).join('\n')
 if((password&&!hasArticle)||all.length<800&&/(?:请先登录|登录后(?:查看|阅读)|请完成(?:安全)?验证|访问受限|验证码验证)/u.test(all))throw Error('WEB_ACCESS_RESTRICTED')
 if(all.length<200&&/(?:请启用\s*(?:javascript|脚本)|页面加载中|正在加载|loading\.\.\.)/iu.test(all))throw Error('WEB_TEXT_UNAVAILABLE')
 if(!all.trim())throw Error('WEB_TEXT_EMPTY')
 // A very large script shell with almost no visible text cannot demonstrate
 // that its actual document was read. Never execute scripts or claim success
 // from a login/navigation shell; short legitimate text remains available but
 // is marked partial when its surrounding page is overwhelmingly script.
 const scriptShell=html&&!hasArticle&&value.length>=50_000&&all.length<300&&all.length*100<value.length&&/<script\b/iu.test(value)
 if(scriptShell&&/(?:登录|验证码|授权)/u.test(all))throw Error('WEB_TEXT_UNAVAILABLE')
 return {title:title.slice(0,160),text:all.slice(0,maxChars),partial:incomplete||all.length>maxChars||scriptShell}
}
