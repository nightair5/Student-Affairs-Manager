// Public excerpts only; no model transport, grant, ledger writer or real user store.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
export const ROOT='docs/recognition-optimization/candidate19-public-development/current-notice-mainline'
export const sha=v=>createHash('sha256').update(v).digest('hex')
const definitions=[
 {id:'FRESH-01',url:'https://inc.xmu.edu.cn/inc2024/info/1031/1124.htm',published:'2021-11-16',title:'统一身份认证服务停机维护通知',referenceTime:'2021-11-16T09:00:00+08:00',segments:['学校统一身份认证服务(https://ids.xmu.edu.cn)将在本周三(11月17日）晚上 11点到次日1点间停机维护，计划停机时间2小时，维护完成后服务将正常恢复。请各位老师、同学事先安排好工作，避开该时间段。'],facts:['停机为独立事件，不把泛化避开时段提醒拆成无对象任务','起点2021-11-17T23:00，终点2021-11-18T01:00；次日及2小时共同消除1点歧义','维护后服务正常恢复；未要求重置密码或重新认证'],disputes:['事先安排好工作是一般提醒；不存在明确独立交付物']},
 {id:'FRESH-02',url:'https://welcome.xmu.edu.cn/info/1150/1453.htm',published:'2026-07-24',title:'2026级新生迎新系统预注册（节选）',referenceTime:'2026-07-24T09:00:00+08:00',segments:['为方便新生更好地了解校园文化、简化注册流程，2026级新生须于指定时间内登录迎新系统完成网上预注册流程。','由于系统维护和升级，迎新系统开放时间与入学须知中规定的时间略有不同，请以本通知的时间为准。新生请在指定时间内激活账号和登录系统，不在指定时间内激活账号和登录都会显示“账号和密码错误”。','本科生（大陆地区）：8月13—27日'],facts:['激活账号、登录并完成预注册；可无损拆合','该类别开放窗口2026-08-13至2026-08-27，仅日期，不编造时刻','类别资格未提供个人信息时未知，不默认适用','新版窗口优先，旧窗口端点未给出，不能造历史日期'],disputes:['仅摘录大陆本科生类别，不声称覆盖全部身份']},
 {id:'FRESH-04',url:'https://chinese.xmu.edu.cn/info/1731/45482.htm',published:'2026-07-10',title:'暑假离留校登记（第一条节选）',referenceTime:'2026-07-10T09:00:00+08:00',segments:['一、各位同学应于7月16日前通过学工系统“暑假离留校登记”应用完成相关信息登记（https://xmuxg.xmu.edu.cn/app/182），并确保填写的信息完整、准确。离校同学应如实登记去向、联系方式及返校安排；暑期留校同学如短期离厦外出，视同离校学生管理，亦应及时做好相关登记。'],facts:['登记为一个核心义务；去向、联系方式、返校安排是条件下的字段要求，不分拆无谓待办','2026-07-16日期截止，无具体时刻','学工系统应用是明确操作入口，不是接收回执','短期离厦条件未知，不假定所有人离校'],disputes:['日前是否包含当天的日终边界未独立裁决；保持日期精度']},
 {id:'FRESH-05',url:'https://sbd.xmu.edu.cn/info/1057/12910.htm',published:'2026-06-23',title:'微纳制造暑期学校（活动信息节选）',referenceTime:'2026-06-23T09:00:00+08:00',segments:['招生对象：在读本科生和研究生、青年研究人员等','收费情况：免费','活动时间：2026年7月6日-7月10日','活动形式：线上讲座，被录取的正式学员可以进入线上会议室听课并提问互动，各学员需自行准备相关终端设备，以便连线','报名方式：网络报名，有意参加活动可通过下方二维码报名','学习结束后可获得暑期学校结业证书，欢迎大家踊跃报名，我们期待与您相聚云端。','报名截止时间：2026年6月30日17:00'],facts:['报名为有意参加者的条件义务；是否已录取未知','活动起止2026-07-06至2026-07-10，日期精度，线上','报名截止2026-06-30T17:00，与活动起止不同','正式学员准备终端设备，不能把录取前置写完成','二维码内容不在文本内，不能推测具体URL'],disputes:['节选未包含课程海报与全部场次，不宣称读全图片']},
 {id:'FRESH-06',url:'https://ssa.xmu.edu.cn/info/1166/32512.htm',published:'2026-09-29',title:'青年学者成长沙龙（活动信息节选）',referenceTime:'2026-09-29T09:00:00+08:00',segments:['活动信息\n\n**时间**\n\n2026年10月12日（周一）\n\n12:30-14:00\n\n**地点**\n\n海韵园办公楼A栋302室\n\n**报名**\n\n扫描下方二维码进行报名，听众报名截止时间为2026年10月11日中午12:00，主办方提供50份免费午餐，按报名顺序先到先得（讲座的听众总人数不作限制，感兴趣均可报名）。'],facts:['讲座为独立事件，2026-10-12T12:30至14:00，地点海韵园办公楼A栋302室','感兴趣者扫码报名，截止2026-10-11T12:00；不与活动时间混挂','50份午餐限制不是听众人数限制，不虚构前50名才可听课','具体二维码链接不在文本中'],disputes:['海报主讲内容不在本节选，不补标题中的业务义务']},
 {id:'FRESH-07',url:'https://chem.xmu.edu.cn/info/1272/125385.htm',published:'2026-05-20',title:'化学夏令营（报名及缴费时序节选）',referenceTime:'2026-05-20T09:00:00+08:00',segments:['全国对化学学科感兴趣的新初一至新高三学生（即2026年秋季学期就读初一至初三、高一至高三的中学生），300人左右。','报名截止日期：2026年6月30日24:00','申请人请于相应截止日期前登录报名网站: https://centralscience.xmu.edu.cn/进行网上申报（推荐使用Edge、Chrome、Firefox浏览器或360浏览器极速模式），待审核通过、缴费完成后即可收到录取通知邮件。营员手册将在开营前一周左右通过邮件发送。','报名提交后3个工作日内会有邮件或短信通知，若没有收到任何通知，请及时联系文末工作人员。','请在收到缴费通知后三日内（含收到通知当天）将学费转入指定汇款账号，并注明“姓名+中心科学营”，否则将视为自动放弃报名资格。'],facts:['网上申报截止2026-07-01T00:00；原文仍2026年6月30日24:00','兴趣与年级资格未知，不能默认true','缴费须收到通知；审核和缴费均未说明完成；付款账号不在摘录内不能虚构','缴费三日包括收到当天，缺通知日期不可编造具体截止','三工作日未收到通知才联系；不是普遍立即联系义务','手册发送为主办方信息，开营日期不在摘录内不能猜具体发送日'],disputes:['工作日历及是否需把等待通知记独立事件尚待具体输出裁决']},
]
export function materials(){return definitions.map(d=>({...d,sourceText:d.segments.join('\n'),sourceSha256:sha(d.segments.join('\n')),timezone:'Asia/Shanghai',role:'PUBLIC_OPERATIONAL_DEVELOPMENT_NOT_HOLDOUT',referenceAuthorship:'single-author/model-assisted/provisional',seenStatus:'SEEN_DURING_LOCAL_DEVELOPMENT_NO_MODEL_OUTPUT',modelOutput:'NOT_RUN'}))}
if(process.argv[1]?.endsWith('current-notice-materials.mjs')){
 const data={version:'current-real-notice-materials-1',sources:materials()}
 if(process.argv[2]==='--verify'){
  const saved=JSON.parse(readFileSync(ROOT+'/SOURCES.json','utf8'));if(JSON.stringify(saved)!==JSON.stringify(data))throw Error('CURRENT_MATERIALS_DRIFT')
 }else if(process.argv[2]==='--write'){
  mkdirSync(ROOT,{recursive:true});const provenance=[]
  for(const s of data.sources){
   const base='.data/current-notice-mainline-20261005/'+s.id,bytes=readFileSync(base+'-receipt.json'),receipt=JSON.parse(bytes),result=JSON.parse(readFileSync(base+'-result.json','utf8'))
   if(result.status!=='SUCCESS'||receipt.isError)throw Error('SOURCE_ACQUISITION_NOT_VERIFIED_'+s.id)
   const normalize=v=>v.replace(/\*|\s/gu,'')
   const checks=s.segments.map(segment=>({sha256:sha(segment),verbatimApartFromMarkdownAndWhitespace:normalize(receipt.markdown).includes(normalize(segment))}))
   if(checks.some(c=>!c.verbatimApartFromMarkdownAndWhitespace))throw Error('SOURCE_EXCERPT_MISMATCH_'+s.id)
   provenance.push({id:s.id,url:s.url,published:s.published,retrievedAt:new Date().toISOString(),receiptSha256:sha(bytes),anonymousSourceSha256:s.sourceSha256,backend:result.selected_backend,checks,localOriginal:base+'-receipt.json',boundary:'Operative excerpts only, not full webpage/image; excludes contacts and payment account. No business fact changed.'})
  }
  writeFileSync(ROOT+'/SOURCES.json',JSON.stringify(data,null,2)+'\n',{flag:'wx'})
  writeFileSync(ROOT+'/PROVENANCE.json',JSON.stringify({version:'current-notice-provenance-1',sources:provenance,acquisitionFailure:{id:'FRESH-03',code:'HOST_RECEIPT_NOT_PERSISTED',includedInModelPlan:false,reason:'Scrape returned but receipt storage failed; no repeat fetch; original request/result retained locally.'}},null,2)+'\n',{flag:'wx'})
 }else throw Error('CURRENT_MATERIALS_MODE')
 console.log(JSON.stringify({sources:data.sources.length,modelCalls:0,ledgerWrites:0,role:'DEVELOPMENT_PROVISIONAL'}))
}
