# RCO Current Context

压缩/换开发模型时的短交接；当前用户授权、现场Git和最新追加日志优先。

## 当前目标与授权

- 北极星：整份通知正确完整→少修改、快确认→可靠保存，不只看动作匹配或安全勾选。
- 当前：RCO-DOCS-002 文档重整已完成读者复核；交付提交/推送以Git为准；后续实现、模型、真实数据、真人与部署均未授权。
- 本轮允许AGENTS/PRD、总计划、提示词、短交接、追加日志及文档检查报告。
- 识别模型/外部模型请求/verifier/Repair/retry/Secret/实验费用：0/0/0/0/0/NONE/0 CNY。
- 禁止修改既有Expected/freeze/dataset/checkpoint/cache、冻结组件、商业契约与历史runner/result。
- 不运行旧B9 runner、不创建B10、不接稳定路径、不启动RCO-6、不部署。
- 文档检查见RCO_DOCS_002_REVIEW.md与RCO_DOCS_002_CHECKS.json：8问读者通过，1处旧证据措辞冲突已修正；提交/远程状态须核对Git。

## 工作区与当前代码

- repository: C:\Users\Winner\student-affairs-multimodal-exp
- branch: codex/e2-multimodal-recognition-exp
- 本轮开始HEAD/upstream tracking：60332e16ebb062c4af0fa85531212286ab020a23，工作区干净。
- 该代码提交：fix(app): verify source and proposition scope before safe selection。
- 本次文档交付提交以Git为准，不把当前提交SHA递归写入自身。
- RC.4/Release/Production、稳定文字模型、既有监测均未由本轮改变。

## 证据摘要与主缺口

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

1. RCO-5-MAINLINE-01：0调用隔离端到端上限验证，先证明正确人工响应可被真实组件承接。
2. 允许范围/场景/交付/通过线见RECOGNITION_OPTIMIZATION_PLAN.md第4节；待用户明确授权。
3. 后续MAINLINE-02才设计新候选职责/表达，MAINLINE-03才申请付费配对。
4. G5完整事实净收益通过后才申请RCO-6，之后按原门做真实效用与发布审批。
5. 首批高频场景只是开发排序；缩小商业范围或提前真人探索须另批，不豁免原商业契约。

## 恢复读取与停机

- AGENTS → PRD第14节相关部分 → 本文件 → 日志最新追加记录 → 当前计划工作包 → 直接相关源码。
- 日志第1/2节是旧快照；从第67条及其后追加记录恢复本次阶段，禁止重启旧B0。
- 一轮一个主根因、最多两轮局部修补；无收益先形成决策，不继续补关键词。
- 大输出只保留路径/计数/关键错误，约80行短交接，上限200行且12 KB。
- 保护变化、越权或Expected泄漏立即停止；证据不足只禁止晋级，不伪造PASS。
