# D3 验证记录

日期：2026-09-21。状态：`D3_SCORER_CONTRACT_READY_FOR_FRESH_DATA`。

## D3 定向验证

- `node scripts/build-candidate12-d3.mjs --write`：通过，生成Schema、48份契约夹具、历史兼容性报告和Manifest。
- `node scripts/build-candidate12-d3.mjs --verify`：通过；相同输入重复生成字节一致，输入变化改变编译SHA，候选回答不参与参照编译。
- `node --test scripts/candidate12-d3.node-test.mjs`：64/64通过。其中24类各含一份合法参照和一份明确拒绝参照；另有16项编译、哈希、评分失败关闭及冻结证据不变量。
- 无效参照返回`REFERENCE_CONTRACT_INVALID`；预测Schema错误返回`PARSE_OR_SCHEMA_FAILURE`；两者不产生虚假0分、PASS或候选优胜结论。
- D1历史参照12份中，10份含任务参照缺少v3任务身份数组或字段规则，12份都使用自然语言checks；v3兼容数为0。没有自动转换、改写Expected或重新计算D2正式结论。

## 冻结证据与零操作边界

- `node scripts/analyze-candidate12-d2-postrun.mjs --verify`：通过；D2 Manifest的60份文件、24份raw、24份result及24个settled结局保持一致。
- D1目录聚合SHA：`4afa5b08a368961ba6782b4ac3d4450f6e6d89c02fa034e1eb426f0390855a5b`。
- D2目录聚合SHA：`2074b8931077a9975ea61293723d1a668728f3baefb5933da84602f61aab6d53`。
- 84份保护文件全部通过。
- 权威账本只读核验：742行、631869字节、SHA-256 `df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e`、tail `6812e1b072caeaa4fd3e6e8e55b485c57533bc0a0d9eaaff4dd84bbf48809922`；writer未打开。
- 本阶段模型调用、Secret读取、grant、reserve、settle、账本写入、Holdout请求、真人试用、默认候选变更、Schema升级、依赖新增、合并和部署均为0。

## 仓库检查

- `npm run lint`：通过，0 error、5个既有warning。
- `npm run build`：通过；保留既有大chunk warning。
- `npm run security:scan`：通过，扫描2661份source/build文件。
- 裸`npm run test`：1430通过、3失败、1跳过。失败分别为未设置`REAL_INPUT_CARRIERS_MANIFEST`、一次既有OCR terminate观察失败和一次A02 5000ms超时；按要求没有弱化断言。
- 两个暂态失败的隔离复跑分别为OCR 10/10通过、runtime 30/30通过。
- 安全隔离入口`node scripts/candidate11-checks.mjs test`：匿名临时carrier下Vitest 1433/1433通过、1跳过；contract、time-contract、server、worker、time-parity、multimodal-lib、Functions和全部candidate11组通过。
- 唯一保留的非零项为历史`RCO-5-007`：3通过、1失败，`FREEZE_HASH_MISMATCH:package-lock.json`。旧锁文件、旧hash断言和发布门槛均未修改，因此不得宣称全仓库全绿。

D2正式决定继续是`REJECT_CANDIDATE12_ENGINEERING_SCREEN`。D3只为未来全新数据修复评分接口，Candidate13尚未实施或评测。
