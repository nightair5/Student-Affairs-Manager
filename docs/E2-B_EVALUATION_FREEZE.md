# E2-B 评估资产冻结

## 目的

E2-B 冻结评估输入与错误语言，防止后续通过改标准、挑样例或针对 Holdout 调参来制造指标提升。E2-A 的 110 条 Golden 继续作为回归集；新增 40 条匿名 Holdout 只用于基线与 E2 最终门禁。

## 冻结资产

- Golden：`src/recognition/e2/goldenDataset.ts`，110 条，版本 `e2-a-golden-1.0.0`。
- Holdout：`src/recognition/e2/holdoutDataset.ts`，40 条，版本 `e2-holdout-1.0.0`。
- 两套数据均由 SHA-256 清单保护；预期值变更必须写入相应 corrections 日志，包含 sampleId、旧值、新值、原因、复核人和日期。
- 模型未命中、Prompt 不方便或指标下降都不是修改标注的理由。

Holdout 覆盖课程、比赛、申请、奖学金、会议、活动、复杂通知、多截止、材料规格、模糊/相对时间、纯信息、OCR 噪声和提示注入。每条样例都显式定义 Project 决策，以及适用的 Milestone、Task/Subtask、Material、TimePoint、Event、Evidence、Ambiguity 与 forbidden output。

## 错误分类

`src/recognition/e2/errorTaxonomy.ts` 冻结 33 个错误标签，分为 semantic、schema、transport、safety、repair 五类。评估失败同时保留 E2-A 的统计类别和 E2 的细粒度标签，因此 Before/After 指标可比较，失败原因也可追踪。

## 数据隔离

- Golden 可用于日常回归和定位，但不得改预期值迎合模型。
- Holdout 不用于逐样例 Prompt 调整，也不在开发循环中反复查看模型答案。
- 本地 fallback 与真实 DeepSeek 必须分别运行、分别报告；失败请求不能混入语义正确率。

## 本阶段范围审计

E2-B 未修改生产 Prompt、模型、Domain v8、Repository、Migration、DomainCommitPlan、UI、Project Matching、Follow 或部署配置。生产代码行为保持不变。
