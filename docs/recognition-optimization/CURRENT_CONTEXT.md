# 当前交接：C11 B1 零调用实验准备包交付

日期：2026-09-21。工作区 C:/Users/Winner/.codex/worktrees/student-affairs-candidate11/比赛；分支 codex/e2-candidate11-blind-eval。
本轮授权是B1零调用准备、验证、提交与推送。模型请求、Secret、grant、预算预留、收据、真实账本写入、旧库操作、Schema/依赖升级、真人、合并及部署均不在授权内。

## 当前结论
- C11 工程闭环已实际运行并经浏览器验证；全仓库存在已复现的历史 RCO-5-007 冻结锁文件失败，不能宣布全绿或发布就绪。
- 模型效果 NOT_RUN_NOT_ADOPTED；真人收益 NOT_OBSERVABLE；合并/部署 NOT_RUN。
- A1：版本化结构匹配评分器44项，历史只读复算1项通过；24旧答身份/结算/解析通过。A已定义检查9/12、B11/12，均为partial参照；完整案例准确率null。
- A2：公共完成标准修正，V00/V10/V01/V11仅切换元指令M和教学例E；保留旧8例+新增2例。原candidate03/10不变。
- A3：prepared/binding/result/analysis身份重建校验；构造和身份13项、新网关9项、原预算/网关124项通过；C11派发始终拒绝。
- A4：复用真实App/MainlineRuntime/semanticComposer/CanonicalWorkspaceRepository。8工程夹具+12份candidate03历史原答；原答与仅scope-ID重绑定、用户修改分别保留。
- 浏览器：8类夹具+历史OS03/OS04，逐项编辑、部分/全部确认、拒绝、失败恢复、重复打开、刷新独立读回已执行。最终3正式任务/10草稿/31事件；全部标记AUTOMATION。
- A5：Vitest1422通过/1原设置跳过，契约/类型/lint/build/security及其他Node组通过。历史RCO-5-007 3通过/1失败；父工作区同样FREEZE_HASH_MISMATCH:package-lock.json，不改断言、不豁免发布。
- B1：6份已见Development来源与字段覆盖完整的工程参照已冻结；参照为模型辅助单作者，独立人工复核PENDING，不能称人工真值或Holdout。
- 24个V00/V10/V01/V11 prepared packet已保存，最大请求体19,908字节；逐请求身份、source/reference/candidate/examples/Schema/scorer/adapter版本与hash均进入manifest。所有packet均禁止派发、结果NOT_RUN。
- 顺序、失败处理、停止条件和选择规则已预注册；M、E及交互可描述，公共完成标准修正相对candidate03的效应不能由本设计识别。
- B1定向测试5/5通过：两次生成一致，身份/请求/上下文漂移拒绝，重复派发和无授权派发拒绝，保护文件与账本只读。
- B1联合评分/网关测试58/58通过；隔离全量Vitest 1422/1422通过、1跳过，server/worker/Functions等后续组通过。唯一保留失败为历史RCO-5-007 3/4通过、`FREEZE_HASH_MISMATCH:package-lock.json`；详见`candidate11/b1-preparation/VALIDATION.md`。

## 启动与独立数据
在本工作区运行 node scripts/serve-candidate11.mjs 6633，打开 http://127.0.0.1:6633/。
只能本机精确127.0.0.1地址；6631/6632与公网地址被拒绝。端口冲突时停止，不杀原服务。
独立IndexedDB：rco-mainline-01-02-i1-real-input-candidate11-engineering-1，数据库版本1、canonical Schema v8不变。
浏览器工具验收使用?automation=1；普通打开记录ENGINEERING_REPLAY，均不自动算真人。
静态产物及日志位于.data/candidate11；不含Secret，不使用旧部署配置。
只提供固定匿名回放；原文粘贴入口会打开回放选择，不运行新的文字/OCR/模型识别。

## 保护与结果边界
84个保护SHA一致；旧账本644行、314个reserve，SHA256 dc52d9cd04b809be9d22d5298bd45d0e6f0a01307017d48a91aaa91a45e8e597。
父分支/6632/旧浏览器库/公开Preview/RC.4/Production未修改。新模型调用0。
Windows检出行尾问题仅在C11工作树恢复经Git blob与父原字节核对的文件；没有Git语义差异。
A9/12与B11/12不是人工盲审、全字段准确率或真实转化率，candidate11也尚无模型回答。
原预算授权已耗尽；工作树账本只是只读副本，不能新开writer。

唯一权威账本位于C:/Users/Winner/student-affairs-multimodal-exp/docs/recognition-optimization/mainline-real-input-01/runs/usage-resume-20260907a/CALL_LEDGER.jsonl；与工作树快照均为644行、314 reserves、SHA256 dc52d9cd04b809be9d22d5298bd45d0e6f0a01307017d48a91aaa91a45e8e597。writer未打开。
2026-09-21已核验DeepSeek官方V4.1 Flash计价。24次严格最坏预算包络为¥51.904512；实际服务商扣费NOT_OBSERVABLE。本轮未创建grant、reserve或receipt。

## 交付与下一步
审计：candidate11/ENGINEERING_AUDIT.md；机器检查摘要：candidate11/ENGINEERING_RESULTS.json。
评分契约：candidate11/SCORING_CONTRACT_V2.md；历史复算：candidate11/historical-rescore/REPORT.json。
计划/跟踪：refine-logs/EXPERIMENT_PLAN.md、EXPERIMENT_TRACKER.md。
准备包：candidate11/b1-preparation/README.md；验证记录：candidate11/b1-preparation/VALIDATION.md；manifest SHA256 af1f1d2427eec1795691e1d4a62056a614bac72f0254103667632b341794744e。
已提交推送：A1 d0407f6b59a8e099b834feaadfaf4d166644d7ab；A2/A3 8714f0130f62a89ae6230c58a8c3a4664934a8bd。A4/A5交付SHA以Git当前HEAD及远端核验为准。
当前停止在`B1_PREPARED_FOR_REVIEW / MODEL_CALLS=0 / AWAITING_NEW_MODEL_CALL_AUTHORIZATION`。下一步先审查准备包；只有用户另行明确授权24个冻结身份及最坏预算后，才能制作新grant并接入唯一writer。未授权模型、真实预留、真人、默认候选变更或上线。
