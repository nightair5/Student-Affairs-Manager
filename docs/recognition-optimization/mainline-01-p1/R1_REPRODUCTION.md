# R1 独立审查最小失败复现（已执行证据，不自动重跑）

状态：REPRODUCED_BLOCKER / NOT_A_MODEL_TEST / NO_PROMOTION。

审查者在本机内存repository中执行以下命令，退出码0；没有读写旧数据文件、没有新冻结材料，没有模型请求。主代理在触发停止条件后只归档此命令和工具输出，没有再次执行。命令中的响应仅为旧工程夹具的内存类型变形；不得把它当作新的语义答案或模型样本。

执行目录：C:\Users\Winner\student-affairs-multimodal-exp。

## 已执行命令

~~~powershell
@'
import { build } from 'esbuild';
const source = `
import { captureFixture, memoryRepository } from './src/experiments/mainline01/chain';
import { confirmationRevisionV2, confirmationStateV2, editConfirmationV2, confirmV2 } from './src/domain/v2/confirmationV2';
const repository = memoryRepository();
const handle = await captureFixture(repository, 'multi');
const initial = await repository.load();
initial.extractionDrafts[0].result.timePoints[0].type = 'planned_start';
await repository.save(initial);
const edited = await editConfirmationV2(repository, { draftId: handle.draftId, taskTempId: 'submit', revision: confirmationRevisionV2(initial), operationId: 'review-only', field: 'deadline', value: '2026-09-12T09:00' });
const state = confirmationStateV2(edited, handle.draftId, 'submit');
const saved = await confirmV2(repository, { draftId: handle.draftId, revision: confirmationRevisionV2(edited), taskTempIds: ['submit'] });
console.log(JSON.stringify({defaultSelected:state.defaultSelected, blockedReason:state.blockedReason, displayed:state.value, label:state.dateLabel, stored:saved.timePoints.map(t=>({type:t.type,value:t.normalizedValue,raw:t.rawText})),history:saved.historyRecords.filter(r=>r.action==='confirmation_v2_edit').map(r=>({before:r.before,after:r.after}))}));`;
const built = await build({stdin:{contents:source,resolveDir:process.cwd(),sourcefile:'review.ts',loader:'ts'},bundle:true,write:false,platform:'node',format:'esm'});
await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
'@ | node --input-type=module
~~~

## 已有原始输出

~~~json
{"defaultSelected":true,"displayed":"2026-09-12T09:00","label":"2026-09-12T09:00（Asia/Shanghai） · 用户修改","stored":[{"type":"planned_start","value":"2026-09-10T18:00","raw":"2026年9月10日18:00前"}],"history":[{"before":"2026-09-10T18:00","after":"2026-09-12T09:00"}]}
~~~

blockedReason为undefined，JSON.stringify因此省略该字段。

## 正确归类

- 原任务仍为explicit，动作、对象和selected未改。
- 这不是新的非explicit默认选择反例；defaultSelected=true本身不证明任务不应存在。
- 它是“用户编辑已保存，却未被确认提交采用，且无阻断”的保存一致性反例。
- 不能把这一反例换算成识别正确率、真实用户发生率或完整误选率。
- 直接原因：confirmationV2.ts:179按单个关联时间接受编辑；domainCommit.ts:552-558按类型排除planned_start/event_start/event_end的deadline覆盖。需要同一条可编辑/可提交规则，不需要增加自然语言关键词。
