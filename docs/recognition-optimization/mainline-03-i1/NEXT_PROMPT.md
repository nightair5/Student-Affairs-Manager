# 下一轮授权提示词（提案，尚未授权）

```text
授权执行 RCO-5-MAINLINE-03-I1-R1：仅闭合I1独立审查登记的来源凭据内部一致性漏洞，恢复当前本机未提交实现，不重做PLAN、不新建数据、不调用模型。

唯一仓库C:\Users\Winner\student-affairs-multimodal-exp；分支codex/e2-multimodal-recognition-exp。
开始核对Git/远端、mainline-03-i1/BASELINE.json、CHECKS.json、REJECTED_SNAPSHOT.json、INDEPENDENT_REVIEW.md、REPRODUCTION.md、AUDIT.md、CURRENT_CONTEXT和最新日志。基线为I1已推送失败证据提交，不回切3439a8e或R2，不应用任何FAILED补丁。10实现文件须匹配REJECTED_SNAPSHOT；重叠修改/保护变化立即停。

沿用MAINLINE-03-SCOPE原10文件白名单；本轮优先且仅修recognitionHandoff.ts、seenReplay.ts，并在其对应两测试及mainlineAcceptance.test.tsx增加已登记反例。其余5实现文件只读复用。需要改runtime/App/脚本职责或扩大语义，先申请。只允许新增本轮R1报告，更新约80行CURRENT_CONTEXT和追加日志。

唯一根因：来源凭据内的原始文本、解析对象、版本身份必须对应同一响应，不能各自重算哈希就视为相互一致。

1. 先写反例复现已登记的版本不一致和rawOutputText/rawResponse不一致；使用旧no-date工程响应的内存变形，不改旧夹具或Expected。
2. 在prepare/放行前验证原始JSON解析值与rawResponse全结构一致；忽略JSON对象字段顺序和无意义空白，但数组顺序、字段缺失、值/类型差异不得忽略。保留原始文本不重写，不能用规范化后的新文本冒充原始响应。
3. 用结构化响应中实际存在的schemaVersion/promptVersion/modelName核对凭据身份；人工服务形状展示标签与原始身份分离，不改原响应。对没有相应内嵌身份的已见候选及空响应失败记录，明确获准来源的生成/验证规则，不编造版本或模型。哈希只是内容校验，不宣称构成签名或服务商真实性证明。
4. 不一致凭据应在新Source写入前明确失败、整个内存库不变；即使外层哈希重算也不能通过。正确凭据仍能走来源先存→适配→V2→用户确认，不能全部拒绝过门。错误已有来源/位置不修正，重复quote仍待核对；Schema/reference/semantic失败仍只保留receipt与失败Run/Draft。
5. 原文/原始回放/适配首次建议/真实编辑分开；旧8工程类型、B8三条已见诊断、42/42口径与旧99+新35所有测试不弱化；合法无日期、有效兄弟和部分/批量确认不退化。历史40/42、旧17、FAIL保持。
6. 同根因最多两轮局部修补；定向与对抗通过后新无上下文独立审查，报告≤800字。无阻断才运行一轮适用完整lint/test/build/安全/依赖/保护检查，并完成原BROWSER_PROTOCOL的实际Edge新标签/新空库、逐键编辑/保存/部分批量/故障/过期/刷新/真实JSON下载及canonical读回。
7. 发现新错误默认选、保护变化、Expected进入决策链、测试弱化、稳定默认影响、真实库访问、范围扩大或两轮无效立即停止。成功才提交推送获准10实现及R1报告并核对远端；失败仅上传审计证据，保留源码现场。

0次外部识别模型/verifier/Repair/retry/模型网络/费用；不访问密钥或剪贴板。不改Schema/repository/capture/confirmationV2/domainCommit/validator/时间AST、冻结组件、Expected/freeze/dataset/checkpoint/cache/历史结果或旧runner；不运行旧一次性runner、不创建数据集/盲测/B10、不接稳定入口、不部署/RCO-6、不采真实材料或真人。

最终交付审计、定向/独立/完整/浏览器分层数字、保护与Git、未解决问题及唯一下一建议/理由。模型准确率写“本轮未测量”。完成后停止，不自动修改新语义契约或调用付费模型。
```

理由：这是让“原始响应可追溯”成立的同一输入边界修复，不是增加识别规则。先闭合它再做尚未运行的完整门和浏览器验收，避免用新模型或新数据掩盖客户端身份校验问题。
