# D1 12×2 临时 Development 配对设计

## 目的与数据资格

本实验只用于 Candidate12 的工程筛选。12 份来源为已见、完全合成的 Development 材料，12 份 Expected 为模型作者制作的 provisional 参照。它们不具备独立人工 Holdout 资格，不能产生泛化、真人转化或上线结论。

## 两个比较臂

- A：candidate03，Prompt 版本 `real-input-source-semantics-3`。
- B：Candidate12，Prompt 版本 `real-input-source-semantics-12`。

两臂固定使用 `deepseek-flash`、temperature 0、reasoning none、8192 输出上限、同一来源、scope 索引、Schema、scorer、adapter、`2026-09-21T20:07:00+08:00` 和 `Asia/Shanghai`。candidate03 源文件没有改动；仅由 D1 隔离包装器把 A 臂路由固定为与 B 臂相同的 `deepseek-flash`。

repair、verifier、自动重试和探活均为 0。Prepared 包的 `dispatchAuthorized=false`、`resultStatus=NOT_RUN`，且当前拒绝型执行器不包含模型客户端、Secret 读取器或预算 writer。

## 顺序

为平衡同一来源内的先后位置，顺序预先固定并交替：

| 来源 | 顺序 |
|---|---|
| PD01 | A → B |
| PD02 | B → A |
| PD03 | A → B |
| PD04 | B → A |
| PD05 | A → B |
| PD06 | B → A |
| PD07 | A → B |
| PD08 | B → A |
| PD09 | A → B |
| PD10 | B → A |
| PD11 | A → B |
| PD12 | B → A |

不得查看中途结果后换顺序、改 Prompt、改 Expected、增加第三臂或补发失败单元。

## Expected 隔离

来源和 Expected 保存为两个独立文件。请求只从 `PROVISIONAL_SOURCES.json` 构造；请求体与 `requestSha` 不含 Expected、reference SHA、评分字段或选择规则。测试会改动一份 Expected 并重新构造全部请求，要求 24 个 `requestSha` 完全不变；改动来源、Prompt 或模型参数则必须改变相应请求哈希。

## 未来执行和失败处理

只有取得一份新的、明确绑定本 Manifest 的 24 次调用及最坏费用授权后，才可新建授权执行阶段。届时必须在发送前重新核验官方价格、权威账本前缀/尾哈希、24 个 unitId 和逐请求身份，并以唯一跨进程锁写权威账本。

每个单元最多发送一次。transport、超时、raw 持久化、usage、结算或账本状态出现不确定时，停止整批并保留不确定状态；不自动重试，不用 repair/verifier 替换原结果。已结算或确定失败单元不重发。

## 预注册工程筛选规则

未来 24 个单元具有确定结局后，按冻结 scorer 只读评分。Candidate12 要继续进入真正的独立人工 Holdout，至少同时满足：

1. 24 个单元全部有确定结局，两臂各 12/12 Schema 与引用有效；
2. Candidate12 的 Severe、Forbidden 和教学例泄漏均为 0；
3. 相对 candidate03 不增加任务 FN 或关键字段 Major；
4. 完整来源数至少净增 2。

任何一项不满足，D1 结论固定为 `REJECT_CANDIDATE12_ENGINEERING_SCREEN`。全部满足时只能记为 `ELIGIBLE_FOR_INDEPENDENT_HUMAN_HOLDOUT`，不能记为晋级或发布通过。若揭盲后修改候选，当前 12 份来源永久保留为已见回归数据，新版本必须重新冻结并使用全新独立材料验证。
