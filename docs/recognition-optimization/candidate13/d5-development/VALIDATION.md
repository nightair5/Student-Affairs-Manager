# Candidate13 D5 验证记录

状态：`CANDIDATE13_V4_DEVELOPMENT_READY_FOR_NEW_AUTHORIZATION`。

## D5 定向验证

- 初始v4.0因包含生产输出Schema无法表达的时间点`actionable`而在零调用状态作废；v4.1以`ee6ee45caa4e1bd258237ccb4c6bc9792d0c9e34`重新冻结后，D5-R1来源、参照、身份和Manifest全部重建。
- v4评分器反例、分母与歧义回归：7/7通过。
- D5新数据、重合检查、身份冻结、真实wire到adapter/Schema/v4 scorer链路和零结果资产检查：6/6通过。
- 四项指标、独立事件sidecar和派发前身份保护：7/7通过。
- `node scripts/prepare-candidate13-d5.mjs --verify`：通过；12份完整参照、24个`dispatchAuthorized=false / NOT_RUN`身份、6组A→B与6组B→A；Manifest SHA-256为`2acd34fce52396a3be17b70fee28e4fe1f3d11bec796e97c672249406c453f53`。
- `node scripts/freeze-candidate13-d4.mjs --verify`：通过；Candidate13 D4 Prompt、Schema、adapter、bundle及旧v3绑定保持原冻结身份。

## 仓库级验证

- `npm run lint`：通过，0个error、5个既有warning。
- `npm run build`：通过；保留Vite既有的500 kB chunk提示。
- `npm run security:scan`：通过，扫描2711份源码/构建文件，未检出Secret。
- 裸`npm run test`：1446通过、3失败、1跳过。一个失败是要求原样保留的candidate02 launcher缺少`REAL_INPUT_CARRIERS_MANIFEST`，解析到`...\\undefined`；另两个是既有`U01-09`和`A02`用例在全量并发负载下超过5000ms。两项超时用例分别以15000ms上限隔离复跑，均1/1通过，没有形成稳定回归。
- `node scripts/candidate11-checks.mjs test`：隔离载体环境中Vitest 1449/1449通过、1跳过；contract、time-contract、server、Worker、time parity、multimodal library、Functions、candidate11 scoring/history/gateway/preview均通过。
- 唯一保留的隔离检查失败为历史`RCO-5-007`：3/4通过，`FREEZE_HASH_MISMATCH:package-lock.json`。本轮未修改旧锁文件、旧冻结hash或发布门槛，因此不宣称全仓库全绿。

## 资产、调用与浏览器边界

- 84份保护文件校验通过。
- 权威账本保持742行，SHA-256为`df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e`；本轮只读，未创建grant/reserve/settle。
- 新增实验模型调用为0；没有raw、result、receipt或授权产物，四项主指标保持`NOT_RUN / NOT_OBSERVABLE`。
- 官方Computer Use浏览器通道在初次、一次轻量重试和重置会话后的恢复尝试中均返回`nodeRepl.fetch request failed`。因此本轮实际浏览器验收为`NOT_RUN`；没有把Vitest、构建或内存工程回放冒充浏览器证据。

本记录证明准备包的工程完整性与派发关闭状态，不证明Candidate13模型效果、真人正确处置率、主动修改时间下降、独立Holdout通过或可发布。
