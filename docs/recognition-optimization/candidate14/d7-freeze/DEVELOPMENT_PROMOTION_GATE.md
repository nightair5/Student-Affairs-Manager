# Candidate14 Development 冻结门槛

比较单位为 12 份全新合成来源的 Candidate03/Candidate14 配对，共 24 个逻辑单元。两臂使用同一模型、参数、Schema、公共适配和评分器；除候选 Prompt 外均不得改变。失败与不确定单元始终留在分母。任何派发必须另获本批明确授权。

必须同时满足：24 个单元有确定结局；两臂均 12/12 Schema 与完整引用有效；Candidate14 Severe、Forbidden 为 0；教学例不存在时泄漏标记 N/A，若存在则必须为 0；Candidate14 相对 Candidate03 不增加任务 FN 或关键语义 Major；Candidate14 完整正确来源净增至少 2。任何一项失败，固定结论 `REJECT_CANDIDATE14_DEVELOPMENT`。通过仅表示可进入独立人工参照与真人验证准备，不授权更换默认候选或部署。

本门槛在任何新 Development 来源或 Expected 出现前冻结。合成参照的语义正确性仍是 provisional；合同可表达与合法 wire oracle 仅证明工程链路可用。
