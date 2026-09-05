# RCO Current Context

压缩/换开发模型时的短交接；当前用户授权、现场Git和最新追加日志优先。

## 当前目标与授权

- 北极星：整份通知正确完整→少修改、快确认→可靠保存，不只看动作匹配或安全勾选。
- 当前：MAINLINE-01已提交推送e67314e，产品验收FAIL不变。本轮只制定P1精确范围、审计/提示词并固化用户交付规则；P1代码实施待明确授权。
- 本轮允许AGENTS交付规则、mainline-01-p1新文档、本文件和追加日志；不修改业务代码或旧MAINLINE-01产物。模型识别准确率本轮未测量。
- 识别模型/外部模型请求/verifier/Repair/retry/Secret/实验费用：0/0/0/0/0/NONE/0 CNY。
- 禁止修改既有Expected/freeze/dataset/checkpoint/cache、冻结组件、商业契约与历史runner/result。
- 不运行旧B9 runner、不创建B10、不接稳定路径、不启动RCO-6、不部署。
- 最新交付证据：mainline-01/REPORT.md、FIDELITY_OBSERVATION.json、BROWSER_OBSERVATION.md、INDEPENDENT_REVIEW.md、MEASUREMENT_DESIGN.md、ENGINEERING_CHECKS.json。

## 工作区与当前代码

- repository: C:\Users\Winner\student-affairs-multimodal-exp
- branch: codex/e2-multimodal-recognition-exp
- 本轮开始HEAD/upstream tracking：e67314ecb3ba42495b5f50a3732d8a59fa5a5436，工作区干净。
- 本轮666个tracked文件已保存SHA-256；仅AGENTS、本文件和追加日志允许变化，其余663个原文件必须不变。旧保护快照不改写。
- 本次文档交付提交以Git为准，不把当前提交SHA递归写入自身。
- RC.4/Release/Production、稳定文字模型、既有监测均未由本轮改变。

## 证据摘要与主缺口

- MAINLINE-01：8人工场景；7响应完整保存、1 unknown显式不可表达；来源8/8保留。定向17/17含1诊断复现，不是17项产品验收。
- 同一双任务42字段：直接domain42/42；真实客户端投影40/42，未编辑的时间rawText改写2处；完整案例0/1，不达100%。
- 浏览器真实DraftReviewPanel→隔离IndexedDB：1场景7步，部分确认/重复/刷新/确认编辑/失败回滚读回；非App或发布浏览器验收。
- 新增适配unknown纠正1轮；不改公共代码。下一步先申请确认边界P1；不要调模型、创建新数据或绕过已发现FAIL。
- 上轮工程916 passed/1 live OCR skipped/0 failed，不能算本轮重跑。本轮仅文档审计/读者复核/diff/安全/保护核验，结果见mainline-01-p1/SCOPE_AUDIT.md。

- RCO-0…4有技术/组件验证，不能称全格式商业通过。
- 010-E1本机组件结项记录：定向122/122，全量899 passed/1 live OCR skipped；不是模型正确率。
- 010报告：RCO-5-010_CLOSE_REPORT.md、RCO-5-010_CLOSE_CHECKS.json、RCO-5-010_E1_AUDIT.md。
- B8：旧真实模型合成Development，任务TP/FP/FN=15/0/5，任务层完整8/12、重大修改4/12；不是独立人工真值或整份事实准确率。
- B8评分：rco-5-008-b8-runs/rco-5-008-b8-m1-20260904a/score.json。
- B9原始FAIL不变；已见回归11/12是实现期望一致性，B9-07/B9-12边界保留。
- B9旧结果/010旧诊断不重写、不重跑、不改称新盲测。
- 新候选任务层时间/材料引用仍缺完整连接；实际产品尚未接010研究链。
- 候选动作/对象闭集可能限制正确答案表达；scope存在不能证明语义正确。
- 本机已有提取chunks，云端仍截前24,000字并提示；未完成全篇识别闭环。
- 修改记录不等于真人active edit time；最新模型泛化/真实材料/真人/商业证据不足。
- 仍处RCO-G5待证；商业契约保持DRAFT_UNAPPROVED、原阈值/样本不改。

## 下一建议，不是授权

1. 先申请MAINLINE-01-P1：按mainline-01-p1/PLAN.md新增确认V2，仅拟允许domainCommit.ts与DraftReviewPanel.tsx显式V2增量，旧默认行为不变。
2. 完整授权段见mainline-01-p1/NEXT_PROMPT.md；App/稳定入口/冻结组件不改。V2通过后仍须另批真实App接入和下游无日期验收，不能拿隔离演示当线上修复。
3. 后续MAINLINE-02才设计新候选职责/表达，MAINLINE-03才申请付费配对。
4. G5完整事实净收益通过后才申请RCO-6，之后按原门做真实效用与发布审批。
5. 首批高频场景只是开发排序；缩小商业范围或提前真人探索须另批，不豁免原商业契约。

## 恢复读取与停机

- AGENTS → PRD第14节相关部分 → 本文件 → 日志最新追加记录 → 当前计划工作包 → 直接相关源码。
- 日志第1/2节是旧快照；从第67条及其后追加记录恢复本次阶段，禁止重启旧B0。
- 一轮一个主根因、最多两轮局部修补；无收益先形成决策，不继续补关键词。
- 大输出只保留路径/计数/关键错误，约80行短交接，上限200行且12 KB。
- 保护变化、越权或Expected泄漏立即停止；证据不足只禁止晋级，不伪造PASS。
- 每轮执行固定交付：Git提交/推送与远程核验、审计报告、下一步做什么和为什么、对应提示词；只读咨询不制造空提交，提示词不自动授权。
