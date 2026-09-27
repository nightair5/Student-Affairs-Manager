# 下一阶段可复制执行提示词

继续“学生事务管家”识别优化独立支线，执行 D8：Candidate14 后续版的评分契约重构、可表达性审计、重新冻结与全新 Development 零调用准备。工作区 `C:\Users\Winner\.codex\worktrees\student-affairs-candidate11\比赛`，分支 `codex/e2-candidate11-blind-eval`。起点应为 D7 阻断交接提交及其远端同 SHA；先读 `AGENTS.md`、`PRD.md` 第 14 节、`CURRENT_CONTEXT.md`、`candidate14/d7-blocked/ARCHITECTURE_DECISION.md`、`PROVISIONAL_EXPERIMENT_AUDIT.md`、D7 冻结 Manifest、D6 结果和 refine-logs 当前计划/跟踪/索引。

本阶段授权本地代码、文档、匿名工程测试、独立端口/数据库的浏览器验证、分阶段 Conventional Commit 并立即推送；允许把只读审计委派给未参与实现的同系列审计员。**不授权任何业务模型调用、模型连通性探测、Secret 读取、grant/reserve/settle、权威账本写入、真人试用、独立 Holdout、默认候选替换、旧数据库操作、Schema 升级、新依赖、合并或部署。** R4/R5 的 24 个身份均已作废，不得复用；D6 的旧 raw/Expected/结果/锁/门槛及 84 份保护文件原样保留。

1. 先核对 HEAD/upstream/远端和干净工作区；只读核对 84 份保护文件、D6 证据及权威账本。D7 基线账本为 791 行、694807 字节、SHA-256 `efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a`；出现合法后续变化时记录并判断，不能改旧锁以迁就。R4/R5 来源列入已见排除库，R5 Manifest SHA `3513b4f7842d7992b65d850057f18bac91424de77d773236d7c51ecb11c0bfed` 必须被派发门显式拒绝。
2. 先写一张逐项对应表：原文语义要求 → Prompt 指令 → 当前 wire 字段 → 公共 adapter → 结构化参照 → scorer → 用户确认/归档。至少覆盖任务准入、否定/取消/替代、条件前件和事实、动作对象、材料格式与包装限制、完成标准、独立事件时间和地点、未确定/待公布时间、信息 scope、无任务处置。每项区分“可由 wire 完整判断”“仅保留原文 scope”“必须人工裁决”；不可检测字段不得默认记 0 或进入完整正确率。
3. 优先修复两个已复现的契约错误。其一，Candidate14 Prompt 对无当前任务来源的 `informationScopeIds` 要求与 scorer 允许集合须一致；正例同时有事件、时间、地点、禁止项，错误额外 scope/遗漏 scope 要失败。其二，独立事件时间评分必须对 type、rawText、normalizedValue、timezone、isAllDay、precision、needsConfirmation 和事件绑定完整核验。把 R5 S09 的错误 `event_end / 1900-01-01T00:00 / UTC / isAllDay=true / precision=vague / needsConfirmation=false` 固定为失败反例。任务时间和独立时间使用同一时间 AST/公共适配规则，不新增平行解析器。
4. 由人明确裁决 R5 S07 包装限制属于材料/格式约束还是完成标准，以及 S12“月底另行通知”应如何在当前 wire 和参照中表达。单作者或模型辅助裁决如实标 provisional；若语义需要独立人工真值，停止相关质量结论，不让模型冒充标注者。检查无任务禁止/引用/待公布目前仅有 scope 保留能力的声明上限。
5. 新版 scorer/reference/adapter 必须对两臂完全相同。为每类完整参照提供一个合法 wire oracle 和至少一个仅改变关键语义的拒绝 wire；全部走真实 Schema 校验、公共 adapter、评分器与确认处置链路。增加同义、拆合、顺序、错误对象、错误日期、条件反转、额外实体、引用悬空与失败分母反例。通过只说明工程契约可达，不说明模型效果提升。
6. 在任何全新来源或 Expected 对实现者可见前，将候选、Prompt 版本（若改变 Prompt）、参照/scorer/adapter/时间规则、门槛、通用生成器和测试一并冻结，写 SHA Manifest；先完成验证、提交并推送，核对远端 SHA。旧 5.5 和 R5 文件不得原地改写。若未通过同系列 provisional 只读审计，停止在 `D8_BLOCKED_ON_REFERENCE_CONTRACT`，不生成新请求身份。
7. 冻结审计通过后，才创建 12 份全新匿名合成 Development 来源与完整参照，排除 R4/R5 和历史 Expected/教学例的逐字及高相似重合。作者与已见程度如实标明。每份参照须通过来源依据、合法 wire、公共链路、正确正例与错误反例；先审计参照再生成 Candidate03/新版候选的 12×2 身份，固定模型及非候选参数，6 AB/6 BA，全部 `dispatchAuthorized=false / NOT_RUN`、零调用。若任一参照或对称性失败，整批在派发前失效，不临时改 Expected 或门槛。
8. 预注册 24 个确定结局、两臂各 12/12 Schema/引用有效、新候选 Severe/Forbidden 为 0、FN/关键 Major 不增加、完整正确来源净增至少 2 的选择门槛。教学例没有则记 N/A。只制作未来预算卡草案；实际调用前重新核验 DeepSeek 官方价格和最坏费用，并取得新批次明确授权。
9. 运行定向契约测试、真实 raw 离线分析、产品归档与测量测试、lint、test、build、security scan、隔离检查器和可用时的真实浏览器验收。历史 `REAL_INPUT_CARRIERS_MANIFEST`、`RCO-5-007 / package-lock` 保留并单列；浏览器不可用标 `NOT_RUN`，不以单测代替。更新 `CURRENT_CONTEXT`、工程审计、计划、跟踪表和索引，按交付边界提交并立即推送，核对本地/upstream/远端。

最终用大白话交付：旧失效原因如何被新合同阻断、哪些语义仍不可测、参照可表达性、候选和冻结 SHA、新来源与 24 个零调用身份（若生成）、四项主指标的证据等级、测试/浏览器/审计、提交和账本状态、未来授权所缺材料。合格时停止在 `D8_NEW_DEVELOPMENT_READY_FOR_SEPARATE_AUTHORIZATION`；否则停止在 `D8_BLOCKED_ON_REFERENCE_CONTRACT`。任何状态都不得自行调用模型或宣布真人转化率提升。
