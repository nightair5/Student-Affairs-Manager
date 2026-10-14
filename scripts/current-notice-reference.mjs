import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
export const MATERIAL_ROOT='docs/recognition-optimization/candidate19-public-development/current-notice-mainline'
export const SELECTED_IDS=Object.freeze(['FRESH-02','FRESH-04','FRESH-05','FRESH-06'])
const specifications={
 'FRESH-02':[
  ['task','大陆本科2026级新生在窗口内激活账号、登录并完成网上预注册；可无损拆合，不漏预注册，不新增改密码等动作。'],
  ['time','开放窗口为2026-08-13至2026-08-27，date_only，不补时刻；保留窗口两端及用途，不把开始日当提交截止。'],
  ['condition','2026级、大陆地区、本科身份与个人适用状态分开；未提供个人身份，不能断言资格true或false。'],
  ['revision','本通知窗口优先于入学须知；旧窗口未给出，保留修订说明，不猜旧日期或不存在的任务端点。'],
  ['information','窗口外账号密码错误是系统说明，不能变成普遍重置密码、联系管理员或立即登录任务。']
 ],
 'FRESH-04':[
  ['task','各位同学完成暑假离留校登记是核心义务；条件下的字段要求不机械拆成无对象待办。'],
  ['time','登记截止原文7月16日前，年份由2026原referenceTime确定，date_only；不补23:59、18:00或个人计划。'],
  ['channel','明确操作入口为学工系统的暑假离留校登记应用及给定URL；陌生但明确目的地不能清空，也不虚构材料格式。'],
  ['completion','登记信息须完整、准确；离校条件下包含去向、联系方式、返校安排。不能假定已填写或已完成。'],
  ['condition','短期离厦的留校同学也按离校管理并及时登记；个人是否外出未知，不默认所有人离校或删除基本登记义务。']
 ],
 'FRESH-05':[
  ['task','有意参加者可网络/扫码报名；兴趣、身份和录取状态未提供，不默认所有人必须或已经报名。'],
  ['event','线上暑期学校是活动事实；开始2026-07-06、结束2026-07-10，date_only，保留起止和线上形式。'],
  ['time','报名截止2026-06-30T17:00，与7月6至10日活动起止正确归属，不能错挂或遗漏。'],
  ['condition','正式学员准备终端设备用于连线；被录取前置未说明完成，等待/资格未知不能改true或全部删掉。'],
  ['information','目标人群、免费、学习结束可获结业证书保留；证书是结果说明，不制造提交证书任务。二维码未读取，不猜URL。']
 ],
 'FRESH-06':[
  ['event','独立活动在海韵园办公楼A栋302室；日期2026-10-12，起止12:30至14:00，同一事件正确owner，不漏结束。'],
  ['task','感兴趣听众可扫码报名；个人兴趣未知，不默认强制参加或已报名。未读二维码不猜入口URL。'],
  ['time','听众报名截止2026-10-11T12:00；与10月12日活动起止分清，不能互换或改个人计划。'],
  ['information','50份免费午餐按报名顺序先到先得；不是讲座听众上限或只有前50人有资格听课。'],
  ['condition','听众人数不限、感兴趣均可报名；午餐条件与参加资格分开，不能新增错误资格门槛。']
 ]
}
const sha=v=>createHash('sha256').update(v).digest('hex')
export function currentNoticeMaterialPlan(){
 const bytes=readFileSync(MATERIAL_ROOT+'/SOURCES.json'),provenance=readFileSync(MATERIAL_ROOT+'/PROVENANCE.json'),all=JSON.parse(bytes).sources
 const sources=SELECTED_IDS.map((id,i)=>{const s=all.find(s=>s.id===id);if(!s||sha(s.sourceText)!==s.sourceSha256||s.modelOutput!=='NOT_RUN')throw Error('CURRENT_MATERIAL_DRIFT_'+id)
  return {sourceId:'C19-CURRENT-REAL-'+String(i+1).padStart(2,'0'),sourceVersionId:'C19-CURRENT-REAL-'+String(i+1).padStart(2,'0')+'-v1',originalMaterialId:id,title:s.title,sourceText:s.sourceText,sourceSha256:s.sourceSha256,url:s.url,published:s.published,referenceTime:s.referenceTime,timezone:s.timezone,role:s.role,seenStatus:s.seenStatus}})
 const references=sources.map(s=>({sourceId:s.sourceId,originalMaterialId:s.originalMaterialId,sourceSha256:s.sourceSha256,truth:'SINGLE_AUTHOR_MODEL_ASSISTED_PROVISIONAL',coverage:'FULL_EXCERPT_NOT_FULL_PAGE',assertions:[...specifications[s.originalMaterialId],['evidence','所有必要事实有本来源版本的真实依据；错值、错对象、跨来源、矛盾证据或错误关系不通过。'],['prose-extras','逐项核查标题、自由描述、全部额外任务/事件/材料/时间、覆盖及关系；未裁决不能整份正确，无据义务或关键遗漏不被正确字段抵消。']].map(([category,statement],i)=>({id:s.sourceId+'-F'+(i+1),category,statement})),unresolved:all.find(row=>row.id===s.originalMaterialId).disputes,adjudication:'Source-first provisional per assertion with original/output pointers; unadjudicated or critical unresolved -> UNKNOWN; legal equivalent representations allowed, no arm-specific exception'}))
 return {sources,references,selection:{version:'current-real-notice-selection-1',selected:SELECTED_IDS,excluded:[{id:'FRESH-01',reason:'2021 historical maintenance; retain only as reference-time/boundary regression'},{id:'FRESH-07',reason:'High-school population; retain only as midnight/condition boundary regression'}],materialSha256:sha(bytes),provenanceSha256:sha(provenance),newOutputs:0,missingCoverage:['New explicit unannounced-time source','Full current cancellation source','Representative tasks/assignment population'],selectionBeforeAnyNewOutput:true,diagnosticPurpose:'Current C19 single-arm college-notice first output; not relative improvement or Holdout'}}
}
