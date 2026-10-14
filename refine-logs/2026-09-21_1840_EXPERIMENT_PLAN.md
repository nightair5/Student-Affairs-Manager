# Candidate12 C1 实验计划快照

版本：`c12-plan-0.5-c1-human-gate`。状态：`WAITING_FOR_INDEPENDENT_HUMAN_LABELS`。

## Claim Map

| 主张 | 最小可信证据 | 当前状态 |
|---|---|---|
| Candidate12减少额外任务和跨对象修订合并 | 与candidate03在12份全新独立人工双审来源上同期配对；Severe/Forbidden为0，FN和关键Major不增加，完整来源净增至少2 | NOT RUN |
| 改进来自紧凑任务守恒规则 | 候选先于Holdout冻结，不含教学例；同模型、输入、Schema、adapter和scorer | ENGINEERING FROZEN |

反主张：较高F1来自漏任务、看到Expected调参、教学复制或不公平模型配置。对应保护是完整来源/Severe/Forbidden/FN门槛、冻结提交、重合排除库和同期固定参数配对。

## 执行顺序

1. 已完成：Candidate12四类规则、11项工程测试、冻结提交与远端核验。
2. 已完成：人工双审协议、12个空白覆盖槽、密封Schema、63条排除语料、验证器、配对预注册和预算草案。
3. 当前门：两位不同真实人员提供12份全新匿名来源并完成独立标注、复核与裁决。
4. 人工包通过后：生成candidate03/Candidate12的24个冻结、不可派发身份，更新最新价格与预算卡草案。
5. 新授权后：严格一次性执行24次，按预注册门槛作`REJECT_CANDIDATE12`或仅提出工程晋级。

没有真实人工包时不得执行第4步；没有新模型授权时不得执行第5步。任何离线得分都不能称为真实识别转化率。
