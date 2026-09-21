# D4 验证记录

日期：2026-09-21。D4在零模型调用、零连通性探测、零Secret读取、零账本写入的边界内执行。

## 定向结果

- `node --test scripts/candidate13-d4.node-test.mjs`：46/46通过。覆盖28类匿名已见错误族工程夹具、确定性构造、prompt/schema/adapter/scorer/fixture绑定漂移、无授权派发拒绝、全新Expected隔离、保护文件与只读账本。
- `npx vitest run src/experiments/realInput01/candidate13.test.ts`：9/9通过。
- `node --test scripts/candidate12-d3.node-test.mjs`：64/64通过。
- `node scripts/build-candidate12-d3.mjs --verify`：通过；D3冻结契约与742行权威账本只读校验一致。
- `node scripts/analyze-candidate12-d2-postrun.mjs --verify`：通过；D2正式结论仍为`REJECT_CANDIDATE12_ENGINEERING_SCREEN`。

## 全仓库门槛

- `npm run lint`：通过，0个error、5个既有warning。
- `npm run build`：通过；保留Vite的既有500 kB chunk提示。
- `npm run security:scan`：通过，最终扫描2676个源码/构建文件。
- 裸`npm run test`：1441通过、1失败、1跳过。失败是既有candidate02 launcher用例未获得`REAL_INPUT_CARRIERS_MANIFEST`，从而解析到`...\undefined`；未修改其断言。
- `node scripts/candidate11-checks.mjs test`：隔离载体环境下Vitest 1442/1442通过、1跳过；server 8/8、Worker 25/25、Functions 5/5、time parity 1/1、multimodal library 23/23、C11 scoring 44/44、history 1/1、gateway 9/9、preview 5/5通过。
- 唯一保留失败为历史`RCO-5-007`：3/4通过，`FREEZE_HASH_MISMATCH:package-lock.json`。本轮没有修改旧锁文件、冻结hash断言或发布门槛。

## 冻结与保护

- 84份保护文件逐字节一致。
- D1/D2/D3聚合SHA保持为`4afa5b08a368961ba6782b4ac3d4450f6e6d89c02fa034e1eb426f0390855a5b`、`2074b8931077a9975ea61293723d1a668728f3baefb5933da84602f61aab6d53`、`d158ec4e29e925562993570442626fb35015ced39aeaee0862f29d4cbf820759`。
- 权威账本保持742行、631869字节、SHA-256 `df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e`，writer未打开。
- Candidate03、Candidate12、默认候选、Workspace/RecognitionResult Schema、依赖、6633、Preview和Production均未改变。
- D4工程夹具不是模型输出评测；Candidate13识别准确率、转化率和相对提升仍为`NOT_OBSERVABLE`。
