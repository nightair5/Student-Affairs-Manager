import type {RecognitionResult} from './types'

/** Conservative local-only extraction: unambiguous event headings and explicit
 * speaker/content/attendance sentences belong to a sole event in the notice. */
export function retainLocalEventDetails(result:RecognitionResult,source:string):RecognitionResult {
 if(result.events.length!==1)return result
 if([...source.matchAll(/(?:^|\n)\s*(?:活动时间|会议时间|时间)[：:]/gu)].length>1||[...source.matchAll(/(?:^|\n)\s*(?:活动地点|会议地点|地点)[：:]/gu)].length>1)return result
 const event=result.events[0],sourceId=result.evidence[0]?.sourceId??'source'
 const webSection=source.search(/\n\n【(?:网页正文|公开操作说明) \d+：/u)
 const blocks=[...source.matchAll(/[^\n。！？；;]+[。！？；;]?/gu)]
 let contentSection=false,speakerContinuation=false,biographySection=false,biographyHasContent=false,noticeSection=false,previousEnd=0
 const details:{label:string;quote:string;start:number}[]=[]
 for(const block of blocks){
  const quote=block[0].trim(),start=block.index!+block[0].indexOf(quote)
  if(!quote)continue
  if(webSection>=0&&start>=webSection){
   const reason='网页部分内容尚未完整整理，请核对原文'
   if(!result.quality.reviewReasons.includes(reason))result.quality.reviewReasons.push(reason)
   result.quality.needsHumanReview=true
   break
  }
  // A labelled schedule is metadata, not an activity description. The
  // recovered event already carries it as separately editable time/location.
  if(event.tempId==='local-labelled-event'&&/^(?:【[^】]*(?:时间|地点)】|[^：:\n]{0,12}(?:时间|地点)[：:])/u.test(quote))continue
  if(event.tempId==='local-labelled-event'&&/^(?:活动|讲座|报告|会议|分享|培训)?(?:主题|名称)[：:]/u.test(quote)&&quote.includes(event.title))continue
  const paragraphBreak=/\n\s*\n/u.test(source.slice(previousEnd,start))
  previousEnd=block.index!+block[0].length
  if(paragraphBreak&&biographyHasContent){biographySection=false;biographyHasContent=false}
  if(paragraphBreak)noticeSection=false
  if(details.length===0&&quote.length>=8&&source.slice(0,start).trim().match(/^【[^】]+】$/u)&&!/^\s*#/u.test(quote)&&!/^(?:各位|各|同学|老师|大家好|尊敬|时间|地点|主讲|主持|报名|活动内容)/u.test(quote))details.push({label:'活动内容',quote,start})
  const biography=/^(?:个人简介|嘉宾简介|主讲人简介|讲者简介|讲师简介)[：:]?\s*(.*)$/u.exec(quote)
  if(biography){contentSection=false;noticeSection=false;biographySection=true;biographyHasContent=Boolean(biography[1]);if(biography[1])details.push({label:'嘉宾简介',quote,start});continue}
  const nextSection=/^(?:活动内容(?:简介)?|讲座内容|报告内容|内容简介|参加须知|参与须知|报名须知|活动须知|注意事项|主讲(?:嘉宾|人|教师)?|报告人|讲师|(?:学术)?主持人?|时间|地点|主办|报名(?:方式|链接|二维码)?)[：:]|^本次活动.{0,15}报名/u.test(quote)
  if(nextSection){biographySection=false;biographyHasContent=false;noticeSection=false}
  if(biographySection){details.push({label:'嘉宾简介',quote,start});biographyHasContent=true;continue}
  const heading=/^(?:活动内容(?:简介)?|讲座内容|报告内容|内容简介)[：:]\s*(.*)$/u.exec(quote)
  if(heading){contentSection=true;noticeSection=false;if(heading[1])details.push({label:'活动内容',quote,start});continue}
  const notice=/^(?:参加须知|参与须知|报名须知|活动须知|注意事项)[：:]\s*(.*)$/u.exec(quote)
  if(notice){contentSection=false;noticeSection=true;if(notice[1])details.push({label:'参加须知',quote,start});continue}
  if(/^(?:主讲(?:嘉宾|人|教师)?|报告人|讲师|演讲嘉宾)[：:]/u.test(quote)){contentSection=false;speakerContinuation=true;details.push({label:'主讲人',quote,start});continue}
  if(/^(?:主持人|主持嘉宾|学术主持)(?:为|是|[：:])/u.test(quote)){contentSection=false;details.push({label:'主持人',quote,start});continue}
  if(speakerContinuation&&/(?:主任|教授|记者|研究员|教师|讲师|专家)/u.test(quote)&&!/[：:]/u.test(quote)){details.push({label:'主讲人',quote,start});speakerContinuation=false;continue}
  speakerContinuation=false
  if(/^(?:时间|地点|主办|报名|个人简介|嘉宾简介)[：:]?/u.test(quote))contentSection=false
  if(/(?:主讲|报告人|主讲嘉宾|讲师)(?:为|是|[：:]|由)|(?:老师|教授|研究员|记者)主讲/u.test(quote)){details.push({label:'主讲人',quote,start});continue}
  if(noticeSection||/(?:提前[^。]{0,10}(?:入场|到场)|(?:参与|参加).{0,15}(?:学时|集活)|参与人数|扫码|扫描.{0,5}二维码|现场咨询|有意向|感兴趣|本次活动.{0,15}报名|报名(?:方式|链接|二维码)|名额有限|先到先得|(?:自行解决|解决).{0,10}(?:入校|入馆)|现场.{0,12}(?:互动|赠书|获赠))/u.test(quote)){details.push({label:'参加须知',quote,start});continue}
  if(contentSection||/(?:将|主要|针对|围绕).{0,60}(?:讲解|介绍|分享|展开|播放)/u.test(quote)||/现场.{0,12}播放/u.test(quote)){details.push({label:'活动内容',quote,start});continue}
  if(event.tempId==='local-labelled-event'&&quote.length>=12&&!/^【[^】]+】$/u.test(quote)&&!/^【[^】]+】.*$/u.test(quote)&&!/^(?:\[[^\]\n]{1,8}\])+$/u.test(quote)&&!/(?:请|须|需|应|务必)[^。；\n]{0,35}(?:填写|提交|报名|登记|上传|申请|预约|缴费)/u.test(quote)){
   // With one explicitly labelled event, source prose is useful activity
   // information even when it does not happen to contain a stock verb.
   // Keep resource links, but leave form links with their own action.
   const before=source.slice(0,start),previousLine=before.slice(0,before.lastIndexOf('\n')).split('\n').at(-1)??''
   const nearby=before.slice(-300)
   const formLink=/^https?:\/\//u.test(quote)&&(/(?:报名|问卷|表单|提交)/u.test(previousLine)||/(?:填写|填报|提交)[^。！？\n]{0,30}(?:问卷|报名表)[\s\S]{0,180}$/u.test(nearby))
   if(!formLink&&!details.some(d=>d.quote===quote))details.push({label:/^https?:\/\//u.test(quote)?'资料入口':'活动说明',quote,start})
  }
 }
 const priority:Record<string,number>={'主讲人':0,'主持人':1,'参加须知':2,'活动内容':3,'活动说明':3,'资料入口':3,'嘉宾简介':4}
 for(const [i,d] of [...details].sort((a,b)=>priority[a.label]-priority[b.label]||a.start-b.start).entries()){
  const prefix=d.label==='主讲人'?'(?:主讲(?:嘉宾|人|教师)?|报告人|讲师|演讲嘉宾)':d.label==='主持人'?'(?:主持人|主持嘉宾|学术主持)':d.label==='活动内容'?'(?:活动内容(?:简介)?|讲座内容|报告内容|内容简介)':d.label==='嘉宾简介'?'(?:个人简介|嘉宾简介|主讲人简介|讲者简介|讲师简介)':d.label==='参加须知'?'(?:参加须知|参与须知|报名须知|活动须知|注意事项)':d.label
  const content=d.quote.replace(new RegExp('^'+prefix+'(?:[：:]|为|是)\\s*','u'),'').trim(),line=d.label+'：'+content
  if(!content||event.description.includes(d.quote)||event.description.split('\n').includes(line))continue
  if(event.description.length+line.length+1>800||event.evidenceIds.length>=20||result.evidence.length>=120||d.quote.length>500){
   const reason='部分内容尚未完整整理，可在原文查看'
   if(!result.quality.reviewReasons.includes(reason))result.quality.reviewReasons.push(reason)
   result.quality.needsHumanReview=true
   continue
  }
  const id='local-event-detail:'+d.start+':'+i
  result.evidence.push({id,sourceId,quote:d.quote,quotedText:d.quote,textStart:d.start,textEnd:d.start+d.quote.length,field:'description',extractionMethod:'parser',confidence:1})
  event.description+='\n'+line;event.evidenceIds.push(id)
 }
 return result
}
