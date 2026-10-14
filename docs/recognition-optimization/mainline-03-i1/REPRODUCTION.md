# MAINLINE-03-I1 独立阻断复现

来源：无上下文审查者已执行记录；主代理整理留档，停止后没有再次执行。对应REVIEW_SNAPSHOT及REJECTED_SNAPSHOT的10文件。

## 现场与调用边界

- 临时cwd：C:\Users\Winner\AppData\Local\Temp\mainline03-independent-review-022a753e-3055-4e7f-bd1d-7deef67f5801。
- 仅Node/esbuild内存bundle（write:false）、旧工程no-date内存变形、MemoryWorkspaceRecordStore；没有生成诊断源码文件。
- 现场fixture SHA256：e2d7b1c2b71c462b72f1efb9168ca57be375de3a3c0a71ce5f77e96383fa76dc。
- 非新dataset、Expected或模型调用；旧夹具与原任务语义未改。
- 下方代码为已执行命令留档，当前交付不授权或自动触发重跑。

## 已执行最小代码

PowerShell单引号here-string保存为$diagnosticSource后，使用 node --input-type=module -e $diagnosticSource：

```js
import { build } from 'file:///C:/Users/Winner/student-affairs-multimodal-exp/node_modules/esbuild/lib/main.js';
const root = 'C:/Users/Winner/student-affairs-multimodal-exp';
const source = `
export { engineeringReceipt, createReplayHandoff } from './src/experiments/mainline03/seenReplay.ts';
export { sealReceipt, sha256Text } from './src/experiments/mainline03/recognitionHandoff.ts';
export { emptyWorkspace } from './src/experiments/mainline01/fixtures.ts';
export { MemoryWorkspaceRecordStore } from './src/domain/v2/repository.ts';
export { createMainlineRuntime } from './src/experiments/mainline02/runtime.ts';`;
const bundle = await build({
  stdin: { contents: source, resolveDir: root, loader: 'ts' },
  absWorkingDir: root, bundle: true, write: false,
  platform: 'node', format: 'esm'
});
const api = await import('data:text/javascript;base64,' +
  Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const original = await api.engineeringReceipt('no-date',
  'sha256:e2d7b1c2b71c462b72f1efb9168ca57be375de3a3c0a71ce5f77e96383fa76dc');
const { receiptSha256, ...body } = original;
const rows = [];
for (const [variant, patch] of [
  ['version-mismatch', {
    contractVersion: '9.9', promptVersion: 'wrong-version'
  }],
  ['raw-mismatch', {
    rawOutputText: '{"different":true}',
    rawSha256: await api.sha256Text('{"different":true}')
  }]
]) {
  const receipt = await api.sealReceipt({ ...body, ...patch });
  const name = 'rco-mainline-01-02-i1-review-' + crypto.randomUUID();
  const initialize = api.emptyWorkspace();
  initialize.workspace.id = name;
  const runtime = await api.createMainlineRuntime({
    name, initialize,
    store: Object.assign(new api.MemoryWorkspaceRecordStore(), { name }),
    handoff: await api.createReplayHandoff([receipt]),
    recognize: () => { throw Error('FORBIDDEN') }
  });
  const draftId = await runtime.capture({
    sourceType: 'text', content: receipt.sourceText
  });
  const before = await runtime.load();
  const view = runtime.review(before, draftId);
  const saved = await runtime.confirm({
    draftId, revision: view.revision, taskTempIds: ['save']
  });
  rows.push({
    variant, fixtureHash: 'verified-current',
    capture: before.recognitionRuns[0].status,
    defaultSelected: view.draft.items.map(x => x.selected),
    canonicalTasks: saved.tasks.length
  });
}
console.log(JSON.stringify(rows));
```

## 实际输出

```json
[
  {"variant":"version-mismatch","fixtureHash":"verified-current","capture":"succeeded","defaultSelected":[true],"canonicalTasks":1},
  {"variant":"raw-mismatch","fixtureHash":"verified-current","capture":"succeeded","defaultSelected":[true],"canonicalTasks":1}
]
```

两个内存库均从emptyWorkspace的0任务开始。明确确认后各读回1项Task；capture后、确认前的before.tasks.length未单独打印或断言，不包装为该节点直接观测为0。没有证据称此次诊断发现了未确认自动写入。

原文no-date的“保存活动手册”仍是正确任务，原对象也未变。发现是矛盾来源凭据可重新封存后放行，不是语义任务误选。严格身份输入边界应拒绝这些凭据；现有134定向缺少这两类反例，所以套件通过未能发现问题。

## 下一修复验证（未执行）

先把上述两个诊断写入获准测试，观察失败，再验证最小身份一致性修复。应同时保留正确工程响应、合法JSON空白/对象字段重排、空响应失败记录和已见候选明确拒绝的对照，不以全部拒绝过门。完整工程与浏览器仍待独立复核无阻断之后。
