# Candidate11 实验跟踪表

版本：c11-tracker-0.4-b2-results。日期：2026-09-21。
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
| C11-040 | P4 | 独立作者12份新source+Expected | 拟合成验证 | 0实验调用 | BLOCKED_INDEPENDENT_LABELS | 人员/方法未落实；模型标注不冒充人审 |
| C11-041 | P4 | candidate03 vs 冻结最佳candidate11 | 12份新配对 | <=24 | PLANNED_NOT_AUTHORIZED | 先冻结候选/评分，后独立材料；新授权 |
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
历史RCO-5-007冻结hash失败已在本分支和父工作区复现，保留为发布阻碍。B2已完成24个确定结局并拒绝candidate11；当前停止在`B2_DEVELOPMENT_RESULTS_READY_FOR_REVIEW`，不得调用Holdout模型或用V01较高F1绕过Severe门槛。

## B2结果登记

- run目录：`docs/recognition-optimization/candidate11/b2-development-20260921a/`；grant `f62bc5d0-1827-4a9f-a53a-44effef24cdf`。
- 权威账本：644→693行，新增1 grant/24 reserve/24 settle，最终SHA `2051d8e775123579c3fa262f671a757e690983f64bc5945d692faaeb24b5322e`。
- 调用/费用：24次；本地可审计上界¥0.523928；provider实际扣费NOT_OBSERVABLE。
- 完整来源：四臂均1/6。Task F1：V00 75.86%、V10 75.86%、V01 78.57%、V11 71.43%。四臂Severe均1，候选决定`REJECT_CANDIDATE11`。
- 发送期上下文路径错误已作为执行器缺陷单列；冻结raw只读适配24/24通过，未修改回答、未补发。
