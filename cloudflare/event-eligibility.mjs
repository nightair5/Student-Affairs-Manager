/** Whether a source-grounded condition represents eligibility rather than a
 * voluntary invitation or a formatting instruction. */
export function isEventEligibility(quote){
 const text=String(quote??'').normalize('NFKC').replace(/\s/gu,'')
 if(!text)return false
 const qualification=/(?:仅(?:对|供|面向|限)|符合|资格|入选|录取|通过审核|审核通过|已(?:报名|登记|注册|缴费|选课|预约|通过|录取)|持(?:有|学生证|证|卡)|凭(?:学生证|证件|卡)|本(?:院|校|学院|专业|班)(?:的)?(?:学生|同学|师生|教师)|若|如果|必须|须具备|年级限制)/u.test(text)
 if(qualification)return true
 if(/^(?:建议|请|可)?(?:有意向|有意|感兴趣|自愿|欢迎)/u.test(text))return false
 if(/(?:命名|文件名|标题格式|字数|文件格式|PDF|Word|字体|字号|行距)/iu.test(text))return false
 return true
}
export function normalizeEventPolarity(clause){
 return String(clause??'').replace(/(?:并未|没有|不会|并不|未曾|不再|不|未)取消|取消(?:报名|预约|注册|资格|成绩|奖励|费用|限制)(?:限制)?/gu,'')
}
