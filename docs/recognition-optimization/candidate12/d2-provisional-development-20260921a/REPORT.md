# Candidate12 D2 临时 Development 配对评测

状态：`D2_EXECUTION_COMPLETE_SCORING_PACKAGE_INVALID`。

24 个冻结请求均一次发送并确定结算；没有重试、repair 或 verifier。

正式预注册结论：`REJECT_CANDIDATE12_ENGINEERING_SCREEN`。原因不是 Candidate12 已被证明较差，而是冻结的 `scorerReference` 结构与冻结评分器接口不兼容；为了不在看见结果后改 Expected 或评分门槛，本轮正式筛选按失败关闭。

下表是透明的事后任务结构诊断，只帮助定位方向，不能替代预注册评分、独立人工 Holdout 或真实转化率。完成标准在冻结 scorerReference 中没有可执行规则，因此标为 `NOT_SCORABLE`。

| 臂 | 候选 | Schema+引用有效 | 诊断完整来源 | TP / FP / FN | P / R / F1 | Critical Major | Severe | Forbidden |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| A | Candidate03 | 11/12 | 6/12 | 13 / 2 / 5 | 86.67% / 72.22% / 78.79% | 11 | 1 | 2 |
| B | Candidate12 | 12/12 | 6/12 | 16 / 1 / 2 | 94.12% / 88.89% / 91.43% | 9 | 0 | 1 |

诊断门槛：allDeterminate=PASS；bothArmsSchemaAndReferenceValid=FAIL；candidate12Safety=FAIL；noRegression=PASS；completeSourceGain=FAIL。

实际调用：24；本地可审计费用上界：CNY 0.436048；provider 实际扣费：NOT_OBSERVABLE。

账本：742 行，SHA-256 `df4035229093554b6417b0a37571730f68c10ecb7098234814406b49dfae1e1e`，tail `6812e1b072caeaa4fd3e6e8e55b485c57533bc0a0d9eaaff4dd84bbf48809922`。

数据边界：已见合成 Development、模型作者临时参照；不是独立人工 Holdout，不是用户接受并保存的真实识别转化率。

历史 RCO-5-007 保留：`FREEZE_HASH_MISMATCH:package-lock.json`。
