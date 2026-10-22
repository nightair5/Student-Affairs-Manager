import {parseChineseTimeAst} from './chinese-time-ast.generated.mjs'
// Program parsing of source text; the original quote and offsets stay unchanged.
export function parseTwoStepTime(raw,options){
 let input=raw.replace(/((?:下周|本周|这周|星期|周)[一二三四五六日天])(?=[0-9])/gu,'$1 ')
 input=input.replace(/([0-9]{1,2})月([0-9]{1,2})日\s*([-—–至到])\s*([0-9]{1,2})日/gu,(_,month,day,join,end)=>month+'月'+day+'日'+join+month+'月'+end+'日')
 if(/deadline$/u.test(options.type)&&/^(?:本月底|本月末|月底|月末)(?:前|之前)$/u.test(input.trim())&&!/公布|通知|预计|另行/u.test(input)){
  const date=new Date(options.referenceTime),parts=new Intl.DateTimeFormat('en-CA',{timeZone:options.timezone??'Asia/Shanghai',year:'numeric',month:'2-digit'}).formatToParts(date),year=Number(parts.find(p=>p.type==='year').value),month=Number(parts.find(p=>p.type==='month').value),day=new Date(Date.UTC(year,month,0)).getUTCDate()
  input=year+'年'+month+'月'+day+'日'
 }
 const result=parseChineseTimeAst(input,options);return {...result,rawText:raw}
}
