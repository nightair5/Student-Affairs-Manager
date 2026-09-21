# Candidate13 规格

Candidate13继承Candidate12的四项任务守恒规则，并追加六项由D2已见错误族形成的最小控制：言语行为与当前性双门、条件与actionable分离、多端点逐项记账、跨对象合并禁止、附属字段保真、召回防规避。

它只改变实验Prompt和候选身份，复用现有模型、temperature、reasoning、输出上限、RecognitionResult 2.0 Schema、adapter和D3 v3 scorer。产品Workspace schema v8、默认候选及确认保存链路均不改变。

规则要求：

1. 任务必须有当前正向指令、动作和明确对象；否定、取消、禁止、背景、材料、地点、格式及联系方式不能单独成任务。
2. false和unknown条件保留有依据的语义实体，但不可执行；true不等于已经完成。
3. 取消、替代和修订逐端点、逐对象连接；不同对象不能共享合并端点。
4. 完成标准、条件依据、材料、时间和依赖只绑定原文支持的任务。
5. 不允许通过漏任务、全量unknown、全量不可执行或丢弃历史端点换取较低误报。

Candidate13没有教学例，不包含D2 sourceId、原文答案或未来Expected。所有输出仍只是待确认建议，不能直接写入正式任务。
