# MAINLINE-04-I1 独立审查

结论：BLOCKED，不得晋级。无上下文审查者：/root/mainline04_i1_independent。

1. semanticComposer.ts:129：修订依据错误只归属旧要求，未影响关联新要求。复用现有 engineering('revision')，仅将修订 scopeIds=[]：旧项出现 MISSING_EVIDENCE，新项仍 requiresAction=true / defaultSelected=true / issues=[]。新增错误默认选择至少1，触发立即停止条件。
2. legacyHandoff.ts:33：整份实体数组差异被应用到每个任务。仅改变multi的m0名称，独立print也收到FULL_ENTITY_DIFFERENCE，可确认集合变为空，违反有效兄弟保留要求。

两反例均由内存esbuild实际复现，命令与输出见REPRODUCTION.md。49项原定向通过不等于新反例通过；原样JSON保留只证明结构复制，不能证明语义真值或关系判断正确。

未发现Expected/score进入运行决策链；B8未强转完整2.0。新语义App与canonical persistence均NOT_RUN。checker full未运行，停机后未继续审其工程编排。审查者未修改文件或调用网络、模型、密钥、浏览器。
