export interface SourceNoticeContext {
  /** These are verbatim excerpts from one source, not newly inferred tasks. */
  sections: Array<{kind:'roles'|'notice'|'overview'|'time'|'context'|'process'; text:string}>
  omitted:boolean
  sourceText:string
}

const stripDecoration=(line:string)=>line.replace(/^[\s\p{Extended_Pictographic}\uFE0F\u200D]+/gu,'').replace(/^(?:#{1,6}|[-*•])\s+/u,'')
const compact=(value:string)=>value.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'')

/** Keep an author's labelled groups together, including each role's original
 * count and duties. This only selects source passages; it does not decide that
 * the reader has any of the roles or create a separate obligation. */
export function extractSourceNoticeContext(source:string,kind:'task'|'event',knownText='',missingEnd=false):SourceNoticeContext {
  const webStart=source.search(/\r?\n\s*\r?\n【(?:网页正文|公开操作说明)\s+\d+[：:]/u)
  const primary=webStart<0?source:source.slice(0,webStart)
  const lines=primary.replace(/\r\n?/gu,'\n').split('\n')
  const isGroup=(line:string)=>/^[^：:\n]{0,32}(?:组|小队|岗位|职位|分工)(?:[·•/／][^：:\n]{1,20})?(?:[（(][^（）()]{1,20}[）)])?[：:]\s*.*$/u.test(stripDecoration(line))
  const isOtherHeading=(line:string)=>/^(?:【[^】]{1,28}】|[^：:\n]{1,24}[：:])\s*$/u.test(stripDecoration(line))
  const isInlineDatedHeader=(line:string)=>/^【[^】]*[0-9０-９][^】]*】\s*$/u.test(stripDecoration(line))
  const selected:SourceNoticeContext['sections']=[]
  const groupLines=new Set<number>()
  // Preserve a source-wide, labelled conditions section as context. Its
  // contents are not interpreted as additional actions or assumed to apply to
  // the current reader. Keep the original formatting, count and wording.
  for(let i=0;i<lines.length;i++){
    const heading=stripDecoration(lines[i]).trim()
    const numbered=/^[一二三四五六七八九十]+[、.．]\s*([^。；;！？]{1,36})$/u.exec(heading)
    const bracketed=/^【([^】]{1,36})】/u.exec(heading)
    const label=numbered?.[1]??bracketed?.[1]??''
    if(!/(?:条件|资格|岗位|职责|分工|类别|类型|要求)/u.test(label))continue
    const block=[lines[i]]
    while(i+1<lines.length&&!/^(?:[一二三四五六七八九十]+[、.．]|【[^】]{1,36}】)/u.test(stripDecoration(lines[i+1]).trim()))block.push(lines[++i])
    const value=block.join('\n').trim()
    if(value.length>heading.length||Boolean(bracketed&&heading.slice(bracketed[0].length).trim()))selected.push({kind:'context',text:value})
  }
  // Source-wide, explicitly attributed processing is useful context. It is
  // labelled as a quotation and never becomes a personal calendar event.
  const processStatement=/(?:由[^，,。；;]{1,24}(?:审核|评审|复核|核对|汇总|报送|发证|公布结果)|^[^，,。；;]{1,18}(?:部门|单位|中心|学院|委员会|负责人|学校|平台|系统)[^，,。；;]{0,30}(?:审核|评审|复核|核对|汇总|报送|发证|公布结果))/u
  for(const match of primary.matchAll(/[^。；;！？\n]{6,240}/gu)){
    const text=match[0].trim()
    if(processStatement.test(text)
      &&!/(?:请|须|需|应)[^，,。；;]{0,24}(?:参加|出席|担任)/u.test(text))selected.push({kind:'process',text})
  }
  for(let i=0;i<lines.length;i++){
    if(!isGroup(lines[i]))continue
    const start=i,block=[lines[i]]
    while(i+1<lines.length){
      const next=lines[i+1]
      if(!next.trim()||isGroup(next)||isOtherHeading(next))break
      block.push(next);i++
    }
    if(block.length>1||/[：:]\s*\S/u.test(stripDecoration(block[0]))) {
      selected.push({kind:'roles',text:block.join('\n').trim()})
      for(let j=start;j<=i;j++)groupLines.add(j)
    }
  }
  // A separately headed benefit or attendance section is a source note, not a
  // promise that an award has been obtained or a new action to perform.
  for(let i=0;i<lines.length;i++){
    const heading=stripDecoration(lines[i]).trim()
    if(!/^[^：:\n]{0,16}(?:福利|待遇|报名方式|参加须知|准备事项|岗位要求|小提示|温馨提示|注意事项)[：:]/u.test(heading))continue
    const block=[lines[i]]
    while(i+1<lines.length&&lines[i+1].trim()&&!isGroup(lines[i+1])&&(!isOtherHeading(lines[i+1])||isInlineDatedHeader(lines[i+1])))block.push(lines[++i])
    if(block.length>1||/[：:]\s*\S/u.test(heading))selected.push({kind:'notice',text:block.join('\n').trim()})
  }
  if(kind==='event'){
    for(let i=0;i<lines.length;i++){
      const heading=stripDecoration(lines[i]).trim()
      if(!/^(?:【(?:活动内容|活动介绍|活动简介|内容简介|讲座内容|报告内容)】|(?:活动内容|活动介绍|活动简介|内容简介|讲座内容|报告内容)[：:])/u.test(heading))continue
      const block=[lines[i]]
      while(i+1<lines.length&&lines[i+1].trim()&&!isGroup(lines[i+1])&&!isOtherHeading(lines[i+1]))block.push(lines[++i])
      if(block.length>1||/[：:]\s*\S/u.test(heading))selected.push({kind:'overview',text:block.join('\n').trim()})
    }
    // A source-wide paragraph is explicitly labelled as such in the UI. It
    // does not become an event fact and is never used to assign a date.
    let paragraph:string[]=[],indices:number[]=[]
    const push=()=>{
      const text=paragraph.join('\n').trim(),clean=stripDecoration(text)
      if(text.length>=24&&text.length<=1600&&!indices.some(i=>groupLines.has(i))&&
        !/^(?:【|https?:\/\/|报名|请|须|需|注意|温馨提示)/u.test(clean)&&
        !/(?:报名|填写|提交|截止|上传|缴费|问卷)/u.test(clean)&&/[，,。；;]/u.test(clean))selected.push({kind:'overview',text})
      paragraph=[];indices=[]
    }
    for(let i=0;i<=lines.length;i++){
      if(i===lines.length||!lines[i].trim()){push();continue}
      paragraph.push(lines[i]);indices.push(i)
    }
    if(missingEnd&&!/(?:改期|延期|更正|调整至|取消|不再举办)/u.test(primary)){
      const times=lines.map(line=>stripDecoration(line).trim()).filter(line=>/^(?:【(?:活动|会议|宣讲|讲座|报告|培训|分享)?时间】|(?:活动|会议|宣讲|讲座|报告|培训|分享)?时间[：:])/u.test(line))
      if(times.length===1&&/\d{1,2}[:：]\d{2}\s*[-—–－~～至到]\s*\d{1,2}[:：]\d{2}/u.test(times[0]))selected.unshift({kind:'time',text:times[0]})
    }
  }
  const known=compact(knownText),seen=new Set<string>(),sections:SourceNoticeContext['sections']=[]
  let length=0,omitted=webStart>=0
  for(const item of selected){
    const normalized=compact(item.text)
    if(!normalized||seen.has(normalized)||known.includes(normalized))continue
    if(sections.length>=12||length+item.text.length>2600){omitted=true;continue}
    seen.add(normalized);sections.push(item);length+=item.text.length
  }
  return {sections,omitted,sourceText:source}
}
