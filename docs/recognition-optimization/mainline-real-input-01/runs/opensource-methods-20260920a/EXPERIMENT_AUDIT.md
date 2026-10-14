# 独立实验审计（provisional）

审计时间：2026-09-20。审阅者：全新同系列模型代理；只读检查，未联网、未调用模型、未修改实验文件。该审阅不是独立人工审计，只能视为 provisional。

总体结论：`FAIL_STRICT_EXPERIMENT_AUDIT`。调用、结果和费用证据闭合；因果归因、评分完整性和长期重放不满足严格实验标准。candidate10 的路线方向仍有净改善，但现版本有一处明确回归，必须修复后进入新的独立盲测，不能采用或部署。

## A. Ground truth / provenance — PASS（披露诚实）

- 12 条通知匿名、合成；参照标记为 `single-author-synthetic-development`。
- 数据明确不是独立 ground truth，也不是未见盲测；报告和结果文件没有把它冒充真实用户转化。
- 下一步必须由另一标注者制作结构不同的冻结 Holdout，并维护 provenance 与 corrections log。

## B. Normalization and pairing — FAIL（严格归因）

- 12 对请求的 user/source/scopes/Schema/referenceTime/model/temperature/reasoning/输出上限一致；顺序 6 对 A-first、6 对 B-first，配对执行通过。
- candidate10 同时改变可见版本标记、追加 3 段防复制/核对元指令并加入 8 个示例。收益只能归因于 candidate10 完整教学包，不能单独归因于 8 个示例。
- 冻结 binding 中“仅固定教学正反例不同”的标签过强；冻结证据不改写，集中报告已纠正。

## C. Result existence and accounting — PASS

- 24 raw、24 result 均存在且一一匹配；响应、usage、费用与 binding/ledger 一致。
- 账本 644 行，sequence/hash chain 连续；本批 1 grant、24 reserve、24 settle、0 halt，累计次数 291–314 连续。
- 本批费用上界 379,360 micro-CNY；全账本权威上界 14,042,543 micro-CNY，低于 20,000,000 上限。
- 644 份收据与账本逐字节一致。服务商实际扣费仍为 `NOT_OBSERVABLE`。
- 收据位于临时目录，后续应把收据 SHA 清单或 Merkle root 固化到持久审计目录。

## D. Scoring integrity — FAIL

- 评分器在首个响应前冻结，SHA 与 24 份结果一致；原 `MODEL_COMPARISON.json` 算术可精确复算。
- 评分器把 action/object/title/description 拼接后做关键词匹配，没有 expected/predicted 一对一分配。K07-A 已出现 `expected=1, predicted=2, matched=0, unexpected=0`，false-positive 被低估。
- OS09 未严格检查“上午十点”；OS10 未检查 revision 端点/effective；OS12 未检查两项具体日期；通用检查没有统一验证 active/pending/affirmative。
- candidate10 的真实漏检回归：OS04 把“核验数据授权书”的完成标准写成“数据授权书核验通过”，原文只要求完成核验。candidate03 的相应输出为“核验完成”。
- candidate03 的另一处漏检错误：OS10 把已生效替代修订写为 `effective=unknown`；candidate10 为 `true`。
- 原冻结结果保持为 A 10/12、B 12/12。按审计确认的明确参照级错误，A 为 9/12、B 为 11/12，B/A/平为 3/1/8；这是响应后的审计重判，不是预注册指标。
- 后续评分须改为结构化字段与确定性一对一匹配，并检查 completion criteria、状态、revision 端点/effective、具体日期和值。

## E. Dead code / execution path — FAIL

- runner → gateway → budget 成功路径实际可达，24 个单元真实 reserve/settle，不是 mock 或死路径产物。
- `--analyze` 依赖发送期 billing 有效时窗，并以 `wx` 写结果；过期或结果已存在后不能幂等重放。
- 本批和 contrastive 专门测试没有逐分支验证 transport、timeout、raw-storage、settlement 与 uncertain 路径；历史通用网关测试不能冒充 K 路径实证。
- `exampleVersion` 没有从 prepared row 贯通，binding 中为硬编码；当前值与 prompt/依赖哈希一致，但未来有漂移风险。
- 后续应增加只读、无 billing 时窗的 `--verify-analysis`，贯通版本元数据，并补失败分支测试。

## F. Claim scope — PASS（外部边界）

- `MODEL_COMPARISON.json` 明确 development、非盲、非独立 ground truth、不测真实 accept-and-save、不能授权 Preview/Production。
- 集中 `AUDIT.md` 已纠正完整教学包归因、评分漏洞、OS04 回归、长期重放和失败路径限制。

## 路线意见

candidate10 完整教学包在 OS07、OS08 和 OS10 上优于 candidate03，但在 OS04 引入“核验完成＝核验通过”的新错误。它是更值得继续的方向，不是可直接采用的版本。先修复该语义边界并完成版本标记/元指令/示例消融，再用独立标注、结构不同、未见的 Holdout 验证。
