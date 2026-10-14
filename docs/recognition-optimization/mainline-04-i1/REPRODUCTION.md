# I1 两个独立阻断反例

状态：FAIL_CONFIRMED。独立审查者与主线程分别在未修改现场内存复现；不是新数据集或新模型结果。

环境：授权仓库、当前Node及已安装esbuild；从现有新验收文件逐字读取engineering()人工映射到内存，bundle write:false，不写可执行文件，不导入用户库。原夹具/Expected不变。现场SHA见REJECTED_SNAPSHOT.json。

## 命令

在授权仓库PowerShell运行，仅用于已登记失败诊断：

```powershell
@'
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
const acceptance = readFileSync('src/experiments/mainline04/semanticAcceptance.test.ts', 'utf8');
const start = acceptance.indexOf('async function engineering(');
const end = acceptance.indexOf('function leafRows(', start);
if (start < 0 || end < 0) throw new Error('REPRO_HELPER_NOT_FOUND');
const contents = `
import { indexImmutableScopesV11 } from './src/recognition/scopeIndexV11.ts';
import { artificialResponse, notices, NOW } from './src/experiments/mainline01/fixtures.ts';
import { SEMANTIC_VERSION } from './src/experiments/mainline04/semanticContract.ts';
export { composeSemantics } from './src/experiments/mainline04/semanticComposer.ts';
export { assessLegacyHandoff } from './src/experiments/mainline04/legacyHandoff.ts';
${acceptance.slice(start, end)}
export { engineering };
`;
const built = await build({ stdin: { contents, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', write: false });
const mod = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'));
const revision = await mod.engineering('revision');
revision.input.revisions[0].scopeIds = [];
const review = await mod.composeSemantics(revision.input, revision.context);
console.log('REVISION_MISSING_EVIDENCE=' + JSON.stringify(review.items.map(({tempId,requiresAction,defaultSelected,issues}) => ({tempId,requiresAction,defaultSelected,issues}))));
const sibling = await mod.engineering('multi');
sibling.input.materials[0].name += ' changed';
const handoff = await mod.assessLegacyHandoff(sibling.input, sibling.old, sibling.context);
console.log('INDEPENDENT_SIBLING_BLOCKED=' + JSON.stringify({rows:handoff.rows,eligibleTaskTempIds:handoff.eligibleTaskTempIds}));
console.log('BOUNDARY=' + JSON.stringify({app:review.app,canonicalPersistence:review.canonicalPersistence,filesystemWrites:0,modelCalls:0}));
'@ | node --input-type=module
```

## 实际输出

exit=0。主线程工具回执chunk_id=b52b38。

```text
REVISION_MISSING_EVIDENCE=[{"tempId":"old","requiresAction":"false","defaultSelected":false,"issues":["MISSING_EVIDENCE"]},{"tempId":"new","requiresAction":"true","defaultSelected":true,"issues":[]}]
INDEPENDENT_SIBLING_BLOCKED={"rows":[{"taskId":"submit","capability":"NOT_SUPPORTED","reasons":["FULL_ENTITY_DIFFERENCE"]},{"taskId":"print","capability":"NOT_SUPPORTED","reasons":["FULL_ENTITY_DIFFERENCE"]}],"eligibleTaskTempIds":[]}
BOUNDARY={"app":"NOT_RUN","canonicalPersistence":"NOT_RUN","filesystemWrites":0,"modelCalls":0}
```

## 判断

修订scopeIds空数组导致关联新要求仍默认选，违反安全硬门，错误默认选择1。单项m0属性差异连带阻断独立print，独立兄弟误阻断1。49项旧定向集合未覆盖这两条；不得将原定向“wrongDefaults=0”的局部断言推广为整个候选安全。到此停止，不修复后再回写此次失败。
