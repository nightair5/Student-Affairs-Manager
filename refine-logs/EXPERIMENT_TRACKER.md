# Candidate11 实验跟踪表

版本：c13-tracker-1.0-d4-frozen。日期：2026-09-21。
本表状态反映真实执行；PLANNED不等于授权，PREPARED不等于派发，工程PASS不等于模型/商业PASS。
核心计划见 [EXPERIMENT_PLAN.md](EXPERIMENT_PLAN.md)。

| ID | 阶段 | 工作/比较 | 数据角色 | 调用 | 当前状态 | 进入条件 / 交付 |
|---|---|---|---|---:|---|---|
| C11-000 | P0 | 隔离worktree、分支、交接与规划 | 历史只读 | 0 | COMMITTED_PUSHED | 文档检查、提交和远端核验见分支审计 |
| C11-010 | P1 | scorer v2及一对一/字段反例 | 工程合成 | 0 | PASS_ENGINEERING_ONLY | 新增反例>=30，正确/错误fixture明确分离 |
| C11-011 | P1 | 24旧答复算、不可变证据对照 | SEEN_DIAGNOSTIC | 0 | PASS_ENGINEERING_ONLY | 无Secret/账本写入，重评分另存 |
| C11-012 | P1 | 只读重放、元数据和临时预算失败分支 | 工程合成 | 0 | PASS_ENGINEERING_ONLY | repeated verify规范化结果相同，真实账本hash不变 |
| C11-020 | P2 | candidate11最小完成标准修正 | 工程合成 | 0 | PASS_ENGINEERING_ONLY | P1可信；版本化新模块和示例 |
| C11-021 | P2 | 正确事实→真实组件→确认仓储读回 | 独立工程库 | 0 | PASS_ENGINEERING_ONLY | 保留取消/未知/无日期，确认前0正式任务 |
| C11-030 | P3 | V00/V10/V01/V11 2×2消融 | 6份Development | 24/24 | SETTLED_COMPLETE | 固定顺序完成；0重试；权威账本693行 |
| C11-031 | P3 | 按冻结规则选唯一候选 | P3结果 | 0新增 | REJECT_CANDIDATE11 | 四臂均D06 Severe=1；无候选进入Holdout |
| C12-010 | C1 | Candidate12 Development修正与冻结 | B2已见错误族 | 0 | COMMITTED_PUSHED | `c033680`先于任何新Expected冻结，bundle `880488f0…296a` |
| C12-020 | C1 | 双人人工协议、模板、Schema、排除库与验证器 | 零数据准备 | 0 | PREPARED_ZERO_CALL | 原63条已见排除文本；模型不能冒充人工 |
| C12-020A | C2临时 | Codex制作12份合成来源与provisional参照 | SEEN_SYNTHETIC_DEVELOPMENT | 0 | PASS_STRUCTURE_NOT_HOLDOUT | `modelAssistanceUsed=true`；排除库增至75条；不得晋级 |
| C12-020B | D1临时 | candidate03 vs Candidate12 12×2零调用身份 | SEEN_SYNTHETIC_DEVELOPMENT | 0 | FROZEN_THEN_EXECUTED_IN_D2 | 24身份冻结；Expected隔离；D2独立grant执行 |
| C12-020C | D2临时 | 24次配对执行、结算与冻结评分 | SEEN_SYNTHETIC_DEVELOPMENT | 24/24 | REJECT_SCORING_CONTRACT_INVALID | 24次settled；冻结scorer/reference接口不兼容；正式失败关闭 |
| C12-020D | D3 | 未来reference/compiler/scorer接口修复与预注册 | 已见诊断/零调用 | 0 | PASS_ENGINEERING_ONLY | v3契约冻结；48夹具、64测试通过；D1/D2不改写 |
| C13-010 | D4 | Candidate13零调用实现、反例回归与冻结 | D2已见错误族 | 0 | FROZEN_READY_FOR_FRESH_DATA | 28类已见工程夹具；46 Node + 9 Vitest通过；未模型评测 |
| C13-020 | D5后续 | candidate03 vs Candidate13全新Development准备 | 待创建全新数据 | 0 | PLANNED_ZERO_CALL | D4冻结提交之后才可创建Expected；先过v3 validator/compiler |
| C12-021 | C1 | 两位真实人员提交12份新source+Expected | 拟Holdout | 0 | WAITING_FOR_INDEPENDENT_HUMAN_LABELS | 当前来源0/12、完整参照0/12 |
| C12-022 | C1 | candidate03 vs Candidate12 24个冻结身份 | 12份新配对 | 0 | BLOCKED_BY_HUMAN_GATE | 人工包通过后才可生成；仍保持NOT_RUN |
| C12-030 | 后续 | 24次Holdout配对执行 | 12份新配对 | <=24 | PLANNED_NOT_AUTHORIZED | 新价格、新预算、新grant及明确授权 |
| C11-050 | P5 | 新回答接真实App、本机事件和恢复 | 结算输出/独立库 | 0新增 | REPLAY_ENGINEERING_PASS_MODEL_NOT_RUN | P4净收益；适用浏览器/事务验收 |
| C11-060 | P6 | 用户观察协议及正式商业验证 | 真实材料/真人 | 未预算 | PLANNED_NOT_AUTHORIZED | 独立批准，沿用或预先修订商业契约 |
| C11-070 | 发布 | Commercial Preview/Production | 发布验收 | 未预算 | NOT_AUTHORIZED | G7/发布前门→另批Preview→G8→另批Production |

## 冻结与结果登记字段

每次实际运行记录 run ID、source roster/hash、split/seen/provenance、模型/Prompt/示例/Schema/scorer/adapter版本、
request/response hash、调用顺序、authorization与budget、账本前后hash、失败类型、逐例匹配与指标。
A包当时只构造工程请求与NOT_RUN身份记录；B2随后按新授权生成24份模型结果。A包工程检查与浏览器记录见ENGINEERING_AUDIT.md和ENGINEERING_RESULTS.json。

## B1零调用准备登记

- 交付目录：`docs/recognition-optimization/candidate11/b1-preparation/`；manifest SHA-256为`af1f1d2427eec1795691e1d4a62056a614bac72f0254103667632b341794744e`。
- 六份来源均为作者已见Development；六份参照为字段覆盖完整的模型辅助单作者工程标签，独立人工复核仍为PENDING。历史Expected未修改。
- B1冻结时24个prepared packet均为`ENGINEERING_NO_AUTHORIZATION`、`dispatchAuthorized=false`、`NOT_RUN`；B2的新grant不回写这些历史字段。同一来源四臂的输入、模型、temperature、reasoning、Schema、输出上限、referenceTime和timezone一致。
- 平衡顺序固定；每臂在每位置出现1或2次，M/E每位置各开3次，12种有向相邻组合出现1或2次。
- 定向B1测试5/5通过：重复生成一致、身份/请求/上下文漂移拒绝、重复派发与无授权派发拒绝、保护文件和账本只读。
- B1时唯一权威账本只读核验为644行/314 reserves，SHA为`dc52d9cd04b809be9d22d5298bd45d0e6f0a01307017d48a91aaa91a45e8e597`；B2后的当前状态另见下方结果登记。
- 官方DeepSeek计价于2026-09-21重新核验。24次严格最坏包络为¥51.904512；本卡未获授权，也未预留费用。

## P1已完成的任务顺序（历史实施清单）

1. 固定预期语义与操作性任务的计数区别；定义完成标准/自由文本裁决接口。
2. 新建确定性最大一对一匹配与关键字段评分；已有商业词典/算法有可复用实现时优先复用。
3. 补重复、错日期、条件反转、错误完成标准、修订端点、共享材料与空任务反例。
4. 新建不依赖billing/Secret的verify入口，测试不触发网络、ledger或原结果写入。
5. 复算已有24份回答，保留v1/v2/响应后审计三份口径和差异原因。
6. 核对安全/测试/构建、旧证据hash，提交推送，形成P2实施范围。

## 结果填写纪律

不把计划预计数写到实测列；不把模型代理审计写成人工；不把“无任务正确处置”写成保存了任务。
历史RCO-5-007冻结hash失败已在本分支和父工作区复现，保留为发布阻碍。D2已完成24个确定结局，但正式评分包接口无效并拒绝Candidate12；当前仍停止在`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`，不得生成或调用Holdout请求。

## B2结果登记

- run目录：`docs/recognition-optimization/candidate11/b2-development-20260921a/`；grant `f62bc5d0-1827-4a9f-a53a-44effef24cdf`。
- 权威账本：644→693行，新增1 grant/24 reserve/24 settle，最终SHA `2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e`。
- 调用/费用：24次；本地可审计上界¥0.523928；provider实际扣费NOT_OBSERVABLE。
- 完整来源：四臂均1/6。Task F1：V00 75.86%、V10 75.86%、V01 78.57%、V11 71.43%。四臂Severe均1，候选决定`REJECT_CANDIDATE11`。
- 发送期上下文路径错误已作为执行器缺陷单列；冻结raw只读适配24/24通过，未修改回答、未补发。

## Candidate12 C1登记

- 冻结提交`c03368054ff8c357f055658c2d2d39b45bbcb761`；candidate bundle SHA `880488f038cec55763276f525c1847638533fe95d79a64599e9585dc8d92296a`。
- 候选构造与边界11/11通过；不含教学例，模型、Schema、adapter、scorer及默认候选不变。
- 12个来源槽均为空，人工角色未分配；独立来源0、完整参照0、请求身份0、模型调用0。
- C1验证器4/4通过；原排除库63条，加入12条Codex临时Development来源后为75条。权威账本仍为693行和SHA `2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e`。

## Candidate12 临时 Development 登记

- Codex按用户要求生成12份完全合成来源与12份结构化参照；source set SHA、Expected set SHA和package SHA见冻结JSON。
- `eligibleForIndependentHoldout=false`，独立人工A/B均为0，正式请求身份0。独立人工验证器必须拒绝本包。
- 新增12份正文已加入排除语料，当前总数75；人工门仍为`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`。

## Candidate12 D1 临时配对身份登记

- 交付目录：`docs/recognition-optimization/candidate12/d1-provisional-paired-preparation/`；12份来源和12份provisional Expected分文件冻结。
- candidate03/Candidate12各12个身份，共24个；PD01起A→B/B→A交替，固定Flash none参数，全部`dispatchAuthorized=false`、`NOT_RUN`。
- 定向测试11/11通过：Expected变更不改变request SHA；来源、Prompt或模型参数变化会改变请求身份；直接及runner派发均在外部操作前拒绝。
- 84份保护文件和693行权威账本不变；模型调用、Secret、grant、reserve、settle、receipt、raw和账本写入为0。
- D1冻结身份已由D2独立授权执行；D1文件本身未回写。正式人工Holdout仍为`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`。

## Candidate12 D2 临时结果登记

- run目录：`docs/recognition-optimization/candidate12/d2-provisional-development-20260921a/`；grant `dda1a7f0-b703-435c-bff9-37e328ed26b6`。
- 调用/账本：24/24 settled，0 retry/repair/verifier；693→742行，最终SHA `df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e`。
- 费用：本地可审计上界¥0.436048；provider实际扣费`NOT_OBSERVABLE`。
- 正式评分：10份含任务的冻结参照均因`C11_REFERENCE_IDENTITY_INVALID`不能被绑定评分器消费；决定`REJECT_CANDIDATE12_ENGINEERING_SCREEN`。
- 非预注册诊断：Candidate03 TP/FP/FN 13/2/5，F1 78.79%；Candidate12 16/1/2，F1 91.43%。两臂诊断完整来源均6/12，Candidate12 Forbidden=1；不得晋级。


## Candidate12 D3登记

- 交付目录：`docs/recognition-optimization/candidate12/d3-scorer-contract/`；状态`D3_SCORER_CONTRACT_READY_FOR_FRESH_DATA`。
- 版本：reference contract 3.0.0、compiler 3.0.0、scorer input 3.0.0、scorer 3.0.0；产品Workspace schema v8不变。
- 24类契约夹具、24合法/24拒绝，定向测试64/64通过。D1历史参照兼容0/12；10份任务身份字段失败、12份自然语言checks失败，禁止自动转换。
- 84份保护文件、D2 Manifest 60份文件、24 raw和24 result、742行权威账本均保持一致。D3模型调用、Secret、grant、reserve、settle、账本写入均为0。
- D3时Candidate13仅为计划；后续D4已完成冻结。正式Holdout仍为`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`；默认候选、Preview和Production没有改变。

## Candidate13 D4登记

- 交付目录：`docs/recognition-optimization/candidate13/d4-freeze/`；状态`D4_CANDIDATE13_FROZEN_READY_FOR_FRESH_DATA`。
- 版本：Candidate `real-input-source-semantics-13`，Prompt `recognition-prompt-candidate13-1.0.0`，reference/scorer继续绑定D3 v3。
- 28份已见错误族工程夹具全部为`SEEN_ERROR_FAMILY_SYNTHETIC_ENGINEERING_REGRESSION_ONLY`；新Development/Holdout source、Expected和正式请求身份均为0。
- D4 Node 46/46、Candidate13 Vitest 9/9、D3 64/64通过；隔离全量Vitest 1442/1442通过、1跳过。历史RCO-5-007仍为3/4通过及`FREEZE_HASH_MISMATCH:package-lock.json`。
- 模型调用、Secret读取、grant/reserve/settle、账本写入、人工试用、默认候选变更、合并和部署均为0。
- 识别率、转化率和相对candidate03提升仍为`NOT_OBSERVABLE`。下一步是准备全新Development，或等待两位真实人员的独立Holdout双审。
