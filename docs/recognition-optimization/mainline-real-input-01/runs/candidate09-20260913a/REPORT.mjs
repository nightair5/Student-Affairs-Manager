// Retrospective business adjudication; never imported by model requests or product.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {inspectPaired09Protection} from '../../../../../scripts/check-mainline-real-input-01.mjs'
const d='docs/recognition-optimization/mainline-real-input-01/runs/candidate09-20260913a/'
const read=p=>JSON.parse(readFileSync(p,'utf8')),hash=b=>createHash('sha256').update(b).digest('hex')
const rows=read(d+'BUSINESS_INPUTS.json')
const adjudications={
 U01:[{}, {}, '两个任务、截止和三份材料正确。submission_deadline与task_deadline在本例均表示同一提交截止；截图格式、来源引用差异不改变实际办理。'],
 U02:[{}, {}, '近期及另行通知均保留；没有具体日期。两个待定时间的粒度需要核对，不计假日期或漏任务。'],
 U03:[{}, {materialExtra:1}, '09把保存对象服务现场原始照片重复生成必需材料；03没有此项额外材料核对。'],
 U04:[{}, {materialExtra:1}, '09多造采样瓶材料；独立检查的not_applicable带否定关联条件依据，另触发CONDITION_CONTRADICTION。条件假本身未被改为真。'],
 U05:[{}, {}, '行程证明PDF及已成立条件、截止均正确；03退回报销单背景事件不算新增任务。'],
 U06:[{}, {taskExtra:1,materialOwner:1,dependency:1}, '09把出示工作证件拆成额外动作并只把证件归该动作，领取仍声明material present，转换拒绝TYPED_COVERAGE_MATERIAL。原文是领取时携带材料。'],
 U07:[{}, {}, '旧寄送作废、新PDF上传、日期、命名和系统正确。旧纸质材料required差异单列历史表示，不影响有效新要求。'],
 U08:[{revision:1}, {revision:1}, '两臂取消无替代却使用superseded，页面会显示已被替代，需要改回与纯取消一致的状态；独立课程反思保留。'],
 U09:[{}, {}, '纯信息未生成任务；结束时刻缺日历日期导致现有时间归一化待核对，不是模型编造或漏读。'],
 U10:[{}, {}, '灯光与音频两任务、各自材料和截止正确。照片已拍信息保留在来源，准备状态仍由用户核对。'],
 U11:[{taskExtra:1,materialOwner:1,condition:1}, {materialAttribute:1,condition:1}, '03多造准备密封袋动作并错误归属；09修复这两点但把袋的两个数量写到检测样本上。两臂均把前置状态未知写成true。09共享材料关联引发本机跨任务MULTIPLE_DEADLINES，日期原答并未错配。'],
 U12:[{materialOwner:1,dependency:1,revision:1}, {cancelledTaskMissing:1,materialExtra:1,time:1,revision:1}, '03无依据增加保存依赖制作、A6材料归保存动作及纯取消superseded。09缺旧取消实体、悬空修订目标被拒绝，重复最终版展签材料，未指定日期却声明提取了时间。每作品一张A6在完成标准内已保留，不再重复计漏规格。'],
 V01:[{}, {materialExtra:1,time:1}, '09多造耳麦材料，并把9点领取的开始安排表达为截止。03规格字段分散在完成标准但事实未丢；扫描件与原件粒度差异不当漏材料。'],
 V02:[{}, {}, '两臂共享A5材料、数量、任务归属和未知前置均正确。09正确共享图触发本机MULTIPLE_DEADLINES；当日17点未规范化属于上下文时间承接限制。'],
 V03:[{}, {}, '近期和另行通知仍在任务与时间中，未伪装无日期。09把日志内容拆为关联材料清单；温度读数、校准说明有原文依据，按预定粒度口径不算凭空材料，但增加两次核对。'],
 V04:[{}, {materialExtra:1}, '真正无日期保存回执：09把任务对象回执重复成必需材料。'],
 V05:[{}, {materialExtra:1}, '未知条件和工作证正确；09多造领取对象配电板作为材料。'],
 V06:[{}, {}, '旧数据包取消与CSV校验清单替代正确。03的命名和SHA256在完成标准中，09在材料属性中；位置差异不是实际遗漏。'],
 V07:[{}, {}, '录音WAV附授权编号、纪要DOCX附校对人姓名均保留且归属正确。附属内容拆成四个材料是粒度差异，不将原严格差异直接翻译为实质错误；两臂多两项核对负担。'],
 V08:[{}, {}, '植物开放时间为纯信息，两臂无任务；结束时刻日期归一化仍待核对，来源未丢。']
}
const structure09={U04:'CONDITION_CONTRADICTION: condition evidence scope on independent task',U06:'TYPED_COVERAGE_MATERIAL',U11:'MULTIPLE_DEADLINES: shared-material local traversal',U12:'TYPED_REVISION_TARGET',V02:'MULTIPLE_DEADLINES: shared-material local traversal'}
const cases=rows.map(row=>{const [a,b,note]=adjudications[row.id];return {id:row.id,cohort:row.cohort,note,
 arms:Object.fromEntries(['03','09'].map((arm,i)=>[arm,{businessErrors:i?b:a,noSubstantiveCorrection:Object.keys(i?b:a).length===0,
 extraStructuralBlock:arm==='09'?structure09[row.id]??null:null,conversion:row.arms[arm].conversion,
 strict:row.arms[arm].strict??null,strictCompleteCase:row.arms[arm].completeCase??null,scoreError:row.arms[arm].scoreError??null}]))}})
function summarize(selected,arm){const errors={};for(const r of selected)for(const [k,v]of Object.entries(r.arms[arm].businessErrors))errors[k]=(errors[k]??0)+v
 return {denominator:selected.length,noSubstantiveCorrection:selected.filter(r=>r.arms[arm].noSubstantiveCorrection).length,
 noSubstantiveOrExtraStructuralCorrection:selected.filter(r=>r.arms[arm].noSubstantiveCorrection&&!r.arms[arm].extraStructuralBlock).length,
 parsed:selected.filter(r=>r.arms[arm].conversion==='PARSED').length,extraStructuralBlock:selected.filter(r=>r.arms[arm].extraStructuralBlock).length,businessErrors:errors}}
const results=readdirSync(d).filter(f=>f.endsWith('_RESULT.json')).map(f=>read(d+f))
const comparison={version:'paired09-business-adjudication-1',claim:'已见材料开发回归；代理依据预先BUSINESS_RULES裁决，不是独立盲测或真人研究',
 adoption:'NOT_ADOPT',baseline:'candidate03',candidate:'candidate09',model:'deepseek-flash',immutableProviderVersion:'NOT_AVAILABLE',
 groups:Object.fromEntries(['original12','later8','all20'].map(g=>[g,Object.fromEntries(['03','09'].map(a=>[a,summarize(g==='all20'?cases:cases.filter(c=>c.cohort===g),a)]))])),cases,
 calls:{new:results.length,total:208,waitingMs:results.reduce((s,r)=>s+r.waitingMs,0),costUpperMicroCny:results.reduce((s,r)=>s+r.costUpperMicroCny,0),totalCostUpperMicroCny:Math.max(...results.map(r=>r.totalCostUpperMicroCny)),providerBilledCny:'NOT_OBSERVABLE',capMicroCny:20000000,permanentA01UnknownMicroCny:3300000},
 caveats:['空数组未替换为原文没有；准备状态仍须用户明确核对。','严格分数原样保留；两份09转换失败留在20份分母。','任务实体遗漏中cancelledTaskMissing是历史作废实体，不冒充有效动作遗漏。','用户主动编辑时间与省时效果NOT_RUN；结构可用不等于语义正确。'],
 next:'优先定位共享材料的时间遍历：已有正确归属却引入另一任务截止；冻结MAINLINE04未改，需后续最小授权后零调用修复。不能据本批支持立即再开Prompt付费轮次。'}
writeFileSync(d+'COMPARISON.json',JSON.stringify(comparison,null,2)+'\n')
const snapshot=inspectPaired09Protection();writeFileSync(d+'IMPLEMENTATION_SNAPSHOT.json',JSON.stringify(snapshot,null,2)+'\n')
const freeze=read(d+'CANDIDATE_FREEZE.json');for(const r of freeze.dependencies)if(hash(readFileSync(r.path))!==r.sha256)throw Error('FROZEN_CHANGED:'+r.path)
const baseline=read(d+'BASELINE.json'),ledger=readFileSync(baseline.ledger.path),lines=ledger.toString().trim().split('\n').map(JSON.parse)
if(hash(ledger.subarray(0,baseline.ledger.bytes))!==baseline.ledger.sha256)throw Error('OLD_LEDGER_CHANGED')
const checks={head:snapshot.head,sources:snapshot.sources.length,protected:snapshot.protectedCount,oldEvidence:snapshot.historyCount,candidateFreezeUnchanged:true,
 ledger:{lines:lines.length,sha256:hash(ledger),tail:lines.at(-1).hash,oldPrefixPreserved:true,totalAttempts:208},
 tests:{fullOriginal:'target-1789308444655.json',originalPassed:1369,originalFailed:1,originalSkipped:1,
 failure:'Acceptance test occupied live user port 6632; no product failure or user service stopped.',failedLayerRerun:'target-1789309478759.json',failedLayerPassed:1,distinctPassed:1370,skipped:1},
 type:'PASS app/node',lint:'PASS latest lint-1789309597072.log',build:'PASS temporary candidate09-final-MLLKjq; root.env disabled',node:'PASS budget/gateway-1789308482113.log',
 artifacts:readdirSync(d).filter(f=>/^(target-.*json|.*\.log)$/.test(f)).map(path=>({path,sha256:hash(readFileSync(d+path))})),
 noProductionDeployment:true,knownWarnings:'Existing lint/toolchain/chunk warnings retained; not a full dependency audit.'}
writeFileSync(d+'CHECKS.json',JSON.stringify(checks,null,2)+'\n')
console.log(JSON.stringify({groups:comparison.groups,calls:comparison.calls,checks:{sources:checks.sources,ledger:checks.ledger}}))
