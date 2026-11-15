import type {RecognitionResult, TaskSuggestionV2} from './types'

export interface LocalSourceSpan { text:string; start:number; end:number }

export function localSourceLines(source:string):LocalSourceSpan[] {
  return [...source.matchAll(/[^\r\n]+/gu)].flatMap(match=>{
    const text=match[0].trim(),start=match.index!+match[0].indexOf(text)
    return text?[{text,start,end:start+text.length}]:[]
  })
}

/** A standalone heading closes the preceding context. Ordinary line wrapping
 * does not. Headings are boundaries, never evidence for sharing a date. */
export function localHeading(line:LocalSourceSpan):string|null {
  const text=line.text.replace(/^(?:\d+[.．、)]|[一二三四五六七八九十]+、)\s*/u,'')
  const delimited=/^(?:【([^】]+)】|\[([^\]]+)\]|([^：:]+)[：:])$/u.exec(text)
  const title=(delimited?.[1]??delimited?.[2]??delimited?.[3]??text).trim()
  if(title.length<2||title.length>60||/[，,。；;！？\d@/]/u.test(title))return null
  if(delimited)return title
  return /(?:申请|申报|认定|评选|报销|预约|借用|办理|安排|说明|须知|要求|事项|流程)$/u.test(title)&&!/(?:^请|须|需|将|应|前|后)/u.test(title)?title:null
}

/** Locate the action's own object inside its citations, rather than treating
 * a broad quotation (which may span headings) as the entire action scope. */
export function localTaskSourceSpan(result:RecognitionResult,source:string,task:TaskSuggestionV2):LocalSourceSpan|null {
  if(!task.actionObject||!task.actionVerb)return null
  const candidates=new Map<number,LocalSourceSpan>()
  for(const id of task.evidenceIds){
    const ref=result.evidence.find(e=>e.id===id)
    if(!ref?.quote)continue
    const offset=ref.textStart!==undefined&&source.slice(ref.textStart,ref.textStart+ref.quote.length)===ref.quote?ref.textStart:source.indexOf(ref.quote)===source.lastIndexOf(ref.quote)?source.indexOf(ref.quote):-1
    if(offset<0)continue
    for(const match of ref.quote.matchAll(/[^，,。；;！？\n]+/gu)){
      if(!match[0].includes(task.actionObject)||!match[0].includes(task.actionVerb))continue
      const text=match[0].trim(),start=offset+match.index!+match[0].indexOf(text)
      candidates.set(start,{text,start,end:start+text.length})
    }
  }
  return candidates.size===1?[...candidates.values()][0]:null
}

export function hasLocalScopeBoundary(source:string,start:number,end:number):boolean {
  return localSourceLines(source).some(line=>line.start>start&&line.start<end&&Boolean(localHeading(line)))
    ||/(?:另外|此外|另请|另一(?:件|项|个)|彼此独立|互不相关)/u.test(source.slice(start,end))
}
