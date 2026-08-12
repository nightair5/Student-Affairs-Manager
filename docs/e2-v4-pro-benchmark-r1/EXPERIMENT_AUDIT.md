# E2.9-R1 V4 Pro Protocol Repair 实验完整性审计

**审计日期**：2026-08-13  
**审计员**：Codex fresh same-family reviewer  
**独立性**：**same-family provisional**；本审计不是 cross-family review，不得称为“完全独立”  
**执行边界**：严格 READ-ONLY AUDIT；未运行 DeepSeek/模型调用，未运行实验 runner，未部署，未修改 Secret，未修改实验代码、raw cache、报告或 Git 状态。根据本轮限制，除本报告和配套 JSON 外未写入 skill trace。

## Overall Verdict: FAIL

**Integrity status**：FAIL（协议完整性失败）  
**Experiment terminal status**：确认为 `V4_PRO_SCREENING_V2_FAIL`  
**Model quality conclusion**：`NOT_AVAILABLE`  
**结论影响**：本审计的 findings **不改变** `V4_PRO_SCREENING_V2_FAIL`；它们进一步证明本轮不得用于宣称 Pro 质量收益或质量失败。

审计 FAIL 不是“Pro 模型失败”。它表示 Screening harness 和实验状态机存在实质协议缺陷。本轮幸而由 scorer、路径匿名评审和 Gate 的 observation-level guard 正确 fail-closed，因而没有产生伪质量分数。

## 审计结果摘要

| 检查项 | 结果 | 结论 |
| --- | --- | --- |
| 数据来源与 generation firewall | PASS | source-only manifest 明确不含 expected/score/label/历史输出；生成 runner 对禁止字段 fail-closed。 |
| Git 基线与协议冻结 | PASS with limitation | tag 解析到 `b2ea4a4`；协议冻结提交 `578aad5`早于调用；冻结输入在 `578aad5..HEAD` 无 diff。但 preparer 本身可覆盖 manifest，runner 未强制比对 baseline hash。 |
| Hash 复算 | PASS with scope limit | manifest canonical hash、protocol-implementation bundle、checkpoint 字节 hash 和 observation provenance hash 全部匹配。 |
| 记录内单次调用 | PASS | Smoke + Screening 26/26 observation 各 1 个 upstream attempt，26 个 response request ID 唯一，无 fallback。 |
| 全局“无重跑”可证明性 | WARN | 现有 checkpoint 无重复 case-arm，但换 label/seed/case-ids 可再调用，且无 server-side append-only ledger；无法排除未写入 checkpoint 的外部调用。 |
| `e2-gen-14-2` Screening harness | FAIL | 两臂 HTTP 200、各一次 attempt；最终规范化 result 均为 0 业务实体 + 1 evidence + `requiresAction=false`，却因 Screening 丢失 pure-information role 被误判 `BASIC_CONTENT_EMPTY`。 |
| checkpoint 状态一致性 | FAIL | 顶层 `gateStatus=COMPLETE`，但两个 observation 为 `integrity_failure`。 |
| Pro result lineage | FAIL | 13/13 个 Pro observation 的 `execution.requestedModel/returnedModel` 为 Pro，但 raw output 和规范化 `result.modelName` 均标成 Flash。这不是 upstream fallback，但是结果载荷的 lineage 错标。 |
| scorer / 路径匿名评审 / Gate | PASS（fail-closed） | 三者都检查所有 observation 为 `complete`；因此本轮必须 `NOT RUN`。 |
| Selection / Candidate Freeze / New Blind | PASS（停止规则） | Screening 未形成 8 个完整可评分对，Selection 和 Blind 调用均为 0，继续将违反预注册 Gate。 |
| 报告数字 | PASS | 34 completions、Smoke/Screening 延迟和 token、Pro 平均延迟 `+56.3582%`、token `-1.7742%` 均复算一致。 |
| Secret chronology / 安全清理 | PASS | 实验 Secret activation 先于 readiness；审计时 Preview flag=false，endpoint 无/假 bearer 均 404，Preview secret list 只剩 `DEEPSEEK_API_KEY`。 |
| Production 未部署 | PASS | 审计时 Production 最新 deployment 仍为 `3b6d6ba2-e21f-495c-80e4-c4bac62366be`（2026-08-08），早于 R1 协议冻结。 |

## 详细 Findings

### F-01 HIGH / FAIL：Screening pure-information role 丢失，`BASIC_CONTENT_EMPTY` 是 harness protocol defect

- 冻结 Screening manifest 将 `e2-gen-14-2` 标注为 `pure_information` / `information_only` / `no_action`：`docs/e2-v4-pro-benchmark-r1/screening-v2-manifest.json:66-78`。
- source-only manifest 的 Smoke 副本有 `smokeRole="pure_information"`，但 Screening 副本只保留 source record，没有 role：`.evaluation-cache/e2-9-r1/protocol-2.0.0/source-only-manifest.json:43-52,102-110`。这与 `scripts/prepare-e2-9-r1-manifests.mjs:105-119` 的构造方式一致。
- runner 仅在 `smokeRole === 'pure_information'` 时允许零实体：`scripts/run-e2-9-r1.mjs:91-106`；Screening 传入 `fixture.smokeRole ?? null`：`scripts/run-e2-9-r1.mjs:192-205`。
- checkpoint 中 Flash 和 Pro 均为 HTTP 200，但分别被标记 `integrity_failure / BASIC_CONTENT_EMPTY`：`.evaluation-cache/e2-9-r1/protocol-2.0.0/screening/r1-screening-v2-20260813-a.json:5022-5035,5154-5167`。
- 复算最终规范化 `payload.result`：两臂均 `projectSuggestion=null`，milestones/tasks/materials/timePoints/events/ambiguities 为 0，evidence 为 1，`requiresAction=false`；代表性字段见同一 checkpoint `:5065-5083,5198-5217`。

**结论**：`BASIC_CONTENT_EMPTY` 是规范化后 harness 对 pure-information 语义的误判，不是已证明的 Flash 或 Pro 质量失败。该 finding **不改变** `V4_PRO_SCREENING_V2_FAIL`，只限定其性质为 protocol-integrity stop。

### F-02 HIGH / FAIL：checkpoint 顶层状态与 observation 失败冲突

- Screening checkpoint 顶层为 `gateStatus="COMPLETE"`：`.evaluation-cache/e2-9-r1/protocol-2.0.0/screening/r1-screening-v2-20260813-a.json:1-15`。
- 同一文件中两个 observation 为 `integrity_failure`：同文件 `:5022-5030,5154-5162`。
- 根因在 runner：`gateStatus` 初始值为 `COMPLETE`，只有 401 会在通用路径修改；其他失败只在 Smoke 阶段改顶层状态：`scripts/run-e2-9-r1.mjs:191-215`。

**结论**：顶层状态不可作为 checkpoint 完整性的单一事实源。进程最终仍因 observation 非 complete 返回非零，且下游 guard 正确拒绝，所以未改变最终停止结论。

### F-03 HIGH / FAIL：13/13 个 Pro result 载荷的 `modelName` 错标为 Flash

- Smoke + Screening 共 13 个 Pro observation；复算它们的 `execution.requestedModel` 和 `execution.returnedModel` 均为 `deepseek-v4-pro`，且 fingerprint 为 Pro 系列。
- 但 13/13 的 raw output `modelName` 和规范化 `payload.result.modelName` 均是 `deepseek-v4-flash`。代表性证据：Screening `e2-gen-14-2` Pro 观测的 `result.modelName` 在 `.evaluation-cache/e2-9-r1/protocol-2.0.0/screening/r1-screening-v2-20260813-a.json:5173-5179`，而 `execution.requestedModel/returnedModel` 在同文件 `:5247-5251`。
- runner 仅验证 `execution.requestedModel/returnedModel`，未检查 `payload.result.modelName`：`scripts/run-e2-9-r1.mjs:91-102`。

**结论**：这不是 upstream model fallback；权威执行字段仍证明实际调用 Pro。但任何依赖 `result.modelName` 的后续归因都不可信。本轮 scorer/盲评未运行，因此不改变既有停止结论；新协议必须修复并升级版本。

### F-04 MEDIUM / WARN：“无重跑”只能支持到已记录 observation

- 现有 Smoke/Screening 有 26 个唯一 case-arm，每个 `execution.attempts.length=1`，共26 个不重复 response request ID。Worker 的 upstream loop 上限为 1：`cloudflare/e2-v4-pro-benchmark.mjs:89-139`。
- 但 runner 仅禁止同名 checkpoint 覆盖：`scripts/run-e2-9-r1.mjs:29-39,185-188`；换 `--label`、`--seed`、`--case-ids` 可再调用：同文件 `:172-180,218-229`。
- endpoint 不维护 server-side append-only observation ledger；checkpoint 不能排除未写入它的外部调用。

**结论**：可以声称“现有 26 个正式 observation 各记录一次 upstream attempt，无可见重复”；不能将其扩大为全局不可选择性重跑的强证明。

### F-05 MEDIUM / WARN：冻结和阶段先决条件主要靠流程纪律，未被 runner 完整强制

- 实际时序支持冻结：`v2-e2-9-protocol-blocked` 解析到 `b2ea4a4b27bf543f77a3c3a9cd5439b92a950720`；`578aad5a1bfc8ba523246dce8a7344cb4155bd3a` 于 2026-08-13 01:43:59+08:00 冻结协议，readiness 于 01:46:27+08:00 才开始；冻结输入在 `578aad5..1c6b69e` 无 diff。
- baseline 中的冻结版本和 manifest hash 完整：`docs/e2-v4-pro-benchmark-r1/baseline-manifest.json:2-30`。
- 但 preparer 直接覆盖 source/manifests：`scripts/prepare-e2-9-r1-manifests.mjs:160-164`；runner 检查 source 自身 hash，但不强制与 committed baseline hash 比对：`scripts/run-e2-9-r1.mjs:172-184`。
- runner 在 readiness 后可直接选择 smoke/screening/selection-remaining，未代码化 S0 PASS、Smoke PASS、Screening PASS 先决条件：`scripts/run-e2-9-r1.mjs:233-237`。

**结论**：本次实际执行顺序和 Git 证据没有显示冻结后篡改或跨 Gate 调用，但工具本身不能独立保证这些 anti-claims。

### F-06 MEDIUM / WARN：Gate 输入关联 hash 未在 evaluator 中强制校验

- scorer 写入 `checkpointSha256`：`scripts/score-e2-9-r1.mjs:100-105`；路径匿名 packet/reveal 也记录 checkpoint、packet 和 labels hash：`scripts/prepare-e2-9-r1-adjudication.mjs:84-88`、`scripts/reveal-e2-9-r1-adjudication.mjs:52-68`。
- evaluator 只检查 protocol/phase/checkpoint completeness/review chronology，未将 aggregate/review 中的 hash 和当前 checkpoint 做关联比较：`scripts/evaluate-e2-9-r1-gate.mjs:35-40`。

**结论**：未来运行 Gate 时存在混入不同 checkpoint 的风险。本轮 Gate 未运行，因此该问题未改变当前结论。

### F-07 LOW / WARN：“0 业务实体”必须限定为最终规范化 result

- `e2-gen-14-2` 两臂原始 `rawOutput` 解析后均含 2 个 timePoints + 1 个 event + 1 条 evidence。
- `normalizeRecognitionResult` 后的 `payload.result` 才是 0 业务实体 + 1 evidence，harness 也是对该最终 result 发出 `BASIC_CONTENT_EMPTY`。原始与最终值可在 checkpoint JSON 字段 `observations[14|15].response.payload.rawOutput` 和 `.result` 中复算。

**结论**：主报告 `:30` 的“输出 0 个业务实体”应读为“最终规范化 result 为 0 个业务实体”；不应表述为原始模型文本本身为零实体。

### F-08 LOW / WARN：protocol bundle hash 不覆盖整个部署链

- `protocolImplementation` bundle 覆盖 benchmark module 和 9 个 R1 script，复算 hash 为 `10b777dc9e114bcfc7bc1d807bce1656929d98780f49b1402c42879a65e8aa05`，与 manifest 一致：`docs/e2-v4-pro-benchmark-r1/bundle-hash-manifest.json:141-210`。
- 它不包含 `cloudflare/worker.mjs`、`wrangler.jsonc`、`package.json` 等路由/部署配置，因此不能单独证明完整部署链无漂移。

**结论**：这是 hash claim 的范围限制，不是当前 hash 错误。

## Hash 与来源复算

### Canonical manifests

| 对象 | 复算 SHA-256 | 与 baseline |
| --- | --- | --- |
| source-only canonical | `0cf63c1c0aae2bccfb69278a15d9b5b1c4b4b64b9e7fb0dcc6c6b988544160fb` | MATCH |
| smoke manifest canonical | `6cbf5802d2c3b31737d4c3ac4d2b09bc6ce99469f9ed6d8c5b87f762c30839ea` | MATCH |
| screening manifest canonical | `fdea46d3c2bc9b85e8b36dc46908568fd09840cc674e0c19442aa540a1999cac` | MATCH |
| selection manifest canonical | `1a0342e0d0ac9a462d5cc560f317bd81457b8624919b1f291966596501201038` | MATCH |
| bundle manifest canonical | `e26ba454acb316ad246b3ba825b064405278b5652ef93601cda4241731d59684` | MATCH |

source-only 物理文件字节 hash 为 `c9c0aa127b816130fd3943ab6d8f2f086d4d600c6c713973b994bca1d76f1b81`；baseline 记录的是 canonical hash，两者不同不是冲突。Hash 算法与书面契约一致：`scripts/e2-9-r1-hash.mjs:8-60`、`docs/e2-v4-pro-benchmark-r1/HASH_CONTRACT.md:3-5`。

### Raw checkpoint byte hashes

| checkpoint | 复算 SHA-256 | 与 run-summary |
| --- | --- | --- |
| readiness | `019f3f1feba3605e2e250da144665ea946af78b7ee79bcd5347486803e6b9550` | MATCH |
| S0 | `91224f04736b03f8164bec6cf41e183cc4cfb77925d44463b5ee44e301e2554d` | MATCH |
| Smoke | `fd75939abe97a4edd4c9fe0ca5aa7dec123d6f781050f0747484e9df601c2813` | MATCH |
| Screening | `52b315bf11e9f9f860a383d00ade331016695903c87b8e4f1d3514b411fd3d7d` | MATCH |

Smoke + Screening 26 个 observation 的 source/input/rawOutput/result provenance hash 全部匹配；26 个 response 的 body/header hash 也全部匹配。S0 内层原始 hash 为：`/models` `4639cce8329d73d60082b99787c8ba9d8f1c0caf0b6d7d8266bd308ed05b68dc`，Flash minimal `de7368cd55e3b547b08e2ffc58745b4f5173032fd6b07685979b9c440294f23f`，Pro minimal `5582393305f9cf44a49a4673fde4e753f608bde6923c54914f8e25dce9133bce`，均与内容复算一致。

## 调用完整性与报告数字

- Auth readiness：6/6 HTTP 200（Flash 3，Pro 3），requested/returned model、fingerprint、usage、JSON 对象均有效。
- S0：2 completions + 1 `/models` request。
- Smoke：10/10 complete。
- Screening：16/16 HTTP 200；14 complete + 2 harness integrity failures。
- 总 completion：`6 + 2 + 10 + 16 = 34`；Selection 0，Blind 0。与 `docs/e2-v4-pro-benchmark-r1/run-summary.json:18-29` 一致。
- 所有 26 个 Smoke/Screening execution 都保持 Prompt `recognition-2.4.1`、Schema `2.0`、Pipeline `recognition-pipeline-2.2.1`、Validator `recognition-quality-2.1.0`、Router `BYPASSED`、Repair/Normalizer `DISABLED`、temperature 0、thinking disabled、maxTokens 6000，且 requested/returned execution model 一致、fallback=0。

延迟/token 复算值与主报告 `:49-56` 及 run-summary `:57-65` 一致：

| 阶段 | 模型 | Mean ms | P50 | P95 | Input | Output | Total |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Smoke | Flash | 9025.4 | 6338 | 14473 | 11874 | 8489 | 20363 |
| Smoke | Pro | 15617.8 | 9932 | 28640 | 11874 | 8466 | 20340 |
| Screening | Flash | 10636.25 | 10666 | 15713 | 19008 | 15583 | 34591 |
| Screening | Pro | 15689.5 | 11070 | 23186 | 19008 | 14631 | 33639 |

Smoke + Screening 合并后，Pro 平均延迟比 Flash 高 `56.3582%`，总 token 低 `1.7742%`。这些只是已记录的性能/成本观测，不是质量分数。

## 为何 scorer、盲评、Selection 和 Blind 必须 NOT RUN

1. Screening checkpoint 有两个 `status !== 'complete'` 的 observation。
2. strict scorer 要求 `gateStatus=COMPLETE`、observation 数量完整且全部 `complete`：`scripts/score-e2-9-r1.mjs:72-75`；因此 strict metrics 必须 NOT RUN。
3. 路径匿名 packet 也要求全部 observation `complete`：`scripts/prepare-e2-9-r1-adjudication.mjs:48-52`；因此 packet、labels、reveal、semantic/user-impact/pair review 必须 NOT RUN。
4. Gate 需要完整 checkpoint 和 chronology-passing review：`scripts/evaluate-e2-9-r1-gate.mjs:35-40`；该输入不存在，Screening Gate 不得生成质量结论。
5. 预注册规定 Screening 不通过即 `V4_PRO_SCREENING_V2_FAIL`：`docs/e2-v4-pro-benchmark-r1/2026-08-13_EXPERIMENT_PLAN.md:23-28`。所以 Selection remainder 必须 0 调用，Candidate Freeze 不得创建。
6. New Blind 只能在 Candidate Freeze 后创建：同计划 `:25-26`；因此 Blind 必须 NOT RUN。实际 tracker 和 run-summary 分别记录 Selection/Blind 为 NOT RUN/0 调用：`docs/e2-v4-pro-benchmark-r1/EXPERIMENT_TRACKER.md:10-16`、`docs/e2-v4-pro-benchmark-r1/run-summary.json:23-29`。

## Secret chronology、清理与 Production

审计期间只执行 Cloudflare 只读 listing/status/secrets 与 disabled endpoint probe；未读取 Secret 值，未变更任何外部状态。

- Preview code version `c892c6a9-57b1-48a4-9a0a-00aad885446a` 创建于 `2026-08-12T17:44:59.789576Z`。
- Secret-triggered version `8e685729-fdf0-4c91-bc44-f1d90fc90c44` active at `2026-08-12T17:45:39.449881Z`。
- readiness 开始于 `2026-08-12T17:46:27.112Z`，晚于 activeAt 47.663 秒；6/6 PASS。
- 审计时 `wrangler.jsonc:29-37` 的 Preview flag 为 `false`。
- 审计时 disabled Preview deployment 为 `1b095ec8-1878-4c13-95a6-e6bc358a98af`，其后 secret-triggered version 为 `fa5b793b-57eb-4923-a7c5-16b8f901bfb9`。
- 审计时 Preview secret names 只有 `DEEPSEEK_API_KEY`；`E2_V4_PRO_BENCHMARK_TOKEN` 不在列表中。
- Preview endpoint 在无 bearer 和无效 dummy bearer 两种探测下都返回 HTTP 404，符合禁用状态。
- Production 当前最新 deployment 仍为 `3b6d6ba2-e21f-495c-80e4-c4bac62366be`，创建于 `2026-08-08T08:55:40.370263Z`；它早于 2026-08-13 的 R1 冻结，因此可确认未将 R1 部署到 Production。

## Claim Impact

| Claim | 审计判定 | 可对外表述 |
| --- | --- | --- |
| C1：Pro 对复杂通知有足够大的质量收益 | UNSUPPORTED / NOT RUN | 本轮没有质量分数、盲评或 Selection/Blind 证据。 |
| C2：差异只来自模型选择 | PARTIALLY SUPPORTED WITH DEFECT | execution 记录支持参数/版本冻结且无 fallback；但 Pro `result.modelName` 全部错标 Flash，且全局 no-rerun 无 append-only ledger 证明。 |
| `BASIC_CONTENT_EMPTY` 是模型质量失败 | REJECTED | 这是 Screening role 丢失导致的 harness defect。 |
| `V4_PRO_SCREENING_V2_FAIL` | SUPPORTED | 作为协议完整性早停状态成立，不等于 Pro 质量失败。 |
| scorer/盲评/Selection/Blind 为 NOT RUN | SUPPORTED AND REQUIRED | 下游 guard 与预注册停止规则共同要求保持 NOT RUN。 |
| Preview 已清理、Production 未部署 R1 | SUPPORTED CURRENTLY | 由审计时实时只读 Cloudflare 证据支持。 |

## 最终结论边界

1. 继续保持 `V4_PRO_SCREENING_V2_FAIL` 和 `qualityConclusion=NOT_AVAILABLE`。
2. 不得宣称 Pro 优于 Flash，也不得宣称 Pro 质量失败。
3. strict scorer、路径匿名评审、Screening Gate、Selection、Candidate Freeze 和 New Blind 必须保持 NOT RUN / NOT CREATED。
4. 修复 pure-information role 传递、checkpoint 状态机、Pro result lineage、阶段先决条件、no-rerun ledger 和 Gate hash 关联后，必须升级协议版本并使用全新 label 重新预注册；不得续跑、补跑或挑选性重跑当前正式 observation。
5. E2 只能称 `READY WITH BLOCKERS`；E3 和 Production 仍为 `NOT READY`。

