import type {ParsedSuggestion} from '../types'

/** A section describes its contents; it does not by itself create obligations.
 * This index is deliberately limited to visibly headed sections. Unrecognised
 * layout stays undecided instead of being treated as evidence for suppression. */
export interface LocalSection {start:number; end:number; kind:'context'|'action'|'other'}

export function indexLocalSections(source:string):LocalSection[] {
 const headings:Array<{start:number;kind:LocalSection['kind']}>=[]
 let offset=0
 let mixedChapter=false
 for(const line of source.split('\n')){
  const plain=line.trim().replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu,'')
  // Chinese section numbers or an independently labelled heading. Numeric
  // list items and prose sentences are not chapter boundaries.
  const numbered=/^(?:[一二三四五六七八九十]+[、.．]|[（(][一二三四五六七八九十]+[）)])\s*([^。；;！？]{1,60})$/u.exec(plain)
  const labelled=/^(?:【([^】]{1,30})】|([^：:。；;！？]{1,30})[：:])\s*$/u.exec(plain)
  const name=(numbered?.[1]??labelled?.[1]??labelled?.[2]??'').trim()
  if(name){
   const context=/(?:条件|资格|岗位|职责|分工|人员要求|类别|分类|(?:申请|报名|适用|招募|参与)范围|类型|背景|简介|介绍|奖项|薪资|待遇|费用|作品要求|作品内容)/u.test(name)
   const action=/(?:报名|申请|办理|提交|参加|工作|受理|操作)(?:方式|流程|安排|时间|须知|步骤|事项|网址|链接|入口)?$/u.test(name)
   if(/^[一二三四五六七八九十]+[、.．]/u.test(plain))mixedChapter=context&&action
   // A subheading such as "项目甲：" does not terminate its enclosing
   // conditions section. Only a new numbered chapter or a known scope does.
   if(numbered||context||action)headings.push({start:offset,kind:context&&action||mixedChapter&&!action?'other':context?'context':action?'action':'other'})
  }
  offset+=line.length+1
 }
 return headings.map((h,i)=>({...h,end:headings[i+1]?.start??source.length}))
}

/** Suppress only a candidate grounded in a descriptive section with no
 * explicit reader-directed instruction. SourceVersion remains authoritative;
 * this decision does not erase the notice or its role/eligibility details. */
export function isDescriptiveLocalCandidate(item:ParsedSuggestion,source:string,sections:LocalSection[]):boolean {
 const quote=item.evidence.trim()
 if(!quote)return false
 const ref=item.evidenceRefs?.find(value=>typeof value.textStart==='number'&&typeof value.textEnd==='number'&&source.slice(value.textStart,value.textEnd)===quote)
 const first=source.indexOf(quote),last=source.lastIndexOf(quote)
 const at=ref?.textStart??(first===last?first:-1)
 if(at<0)return false
 const scope=sections.find(section=>section.start<=at&&at<section.end)
 if(scope?.kind!=='context')return false
 const title=item.title.trim()
 // A direct instruction to the reader or a conditionally applicable action
 // can occur even in a requirements section; leave it for the normal path.
 const directive=/(?:请(?:各位|同学|学生|申请人|报名者|入选者|大家)?|(?:申请人|报名者|入选者|同学|学生)(?:须|需|应|请)|入选后(?:须|需|请)|报名后(?:须|需|请))[^。；;\n]{0,36}(?:提交|填写|报名|参加|上传|递交|申请|登记|预约|领取|缴费|准备|联系)/u
 return !directive.test(title)&&!directive.test(quote)
}
