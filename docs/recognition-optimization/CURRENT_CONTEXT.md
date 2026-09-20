# 当前交接：candidate10 配对开发评测完成

## 当前结论

- 用户已明确授权 24 次 Flash none 配对评测；24/24 均 HTTP 200、可解析并完成 usage 结算，累计调用准确到 314。
- 原冻结评分器：candidate03 为10/12、55/61；candidate10 为12/12、61/61。其关键词 precision/recall 与 false-positive 计数存在审计确认的漏洞，不作为严格任务准确率。
- 独立逐例审计：candidate03 有 OS07、OS08、OS10 三处明确参照级错误，为9/12；candidate10 有 OS04 一处“核验完成＝核验通过”过度推断，为11/12；配对 B 3胜、A 1胜、8平。
- candidate10 完整教学包只保留为修正方向，状态 `REQUIRES_FIX_BEFORE_INDEPENDENT_BLIND_EVALUATION`。未接入 Preview/Production，当前正式候选与 RC.4 均未修改。
- 这不是独立人审或盲测；真实用户接受并保存转化率仍为 `NOT OBSERVABLE`。

## 仓库与分支

- 仓库：`C:/Users/Winner/student-affairs-multimodal-exp`。
- 分支：`codex/e2-multimodal-recognition-exp`。
- 付费评测冻结 HEAD：`9c9460dafef511a922938ce012ae4874070a67e1`；最终文档以最终提交为准。
- 用户另行提交的 `学生事务管家_跨工作区交接文档.docx` 已保留，不属于本轮实验修改。

## 固定实验

- A：deepseek-flash + candidate03 + reasoning none；B：同模型同参数，system prompt 改为 candidate10 完整教学包，包括版本标记、3 段防复制/核对元指令和 8 个固定原创教学正反例。
- 12 份单作者匿名合成开发通知，每份 A/B 各一次；6 对 A 先、6 对 B 先。参照不进入请求。
- 模型输出仍只是待确认建议，不会直接创建或覆盖正式任务。
- 证据目录：`mainline-real-input-01/runs/opensource-methods-20260920a/`。
- 关键文件：`AUDIT.md`、`MODEL_COMPARISON.json`、`BINDING_FINAL.json`、24 份 raw、24 份 result。

## 账本与费用

- 统一账本：644 行，独立收据 644 份；本轮无重试。
- 本轮 24 次费用上界 0.379360 元；累计费用权威上界 14.042543 元，包含历史未知调用预留，20 元硬上限未变。
- 服务商实际扣费 `NOT OBSERVABLE`。
- candidate10 输入 61,132 tokens、输出 9,211；candidate03 输入 50,692、输出 10,253。

## 差异案例

- OS07：candidate03 在条件为假时生成重复的正/负领取任务，并留下 active/pending 任务；candidate10 只保留一个不可执行要求。
- OS08：candidate03 多造交回任务，并把否定语境中的“今天”归一化为截止日期；candidate10 只保留保存任务，将待通知日期作为未绑定待确认信息。
- OS10：candidate03 把已生效修订写为 `effective=unknown`；candidate10 正确写为 true。
- OS04 回归：candidate10 把“核验数据授权书”的完成标准写成“核验通过”，原文只要求完成核验；修正前不得采用。

## 验证与异常

- 对照专门测试 4/4；历史预算/网关回归 124/124。
- lint 0 错误、4 个既有警告；typecheck、build、security scan 通过。
- 历史 `RCO-5-007` package-lock 冻结哈希失败未修改，不能声称整个历史测试集全绿或发布阶段完成。
- 正式调用前的字段绑定和网关范围错误均在预留/网络发送前停止；修复后重新冻结。一次集成测试误建的孤立测试收据已精确删除，真实账本原前缀哈希保持。
- 独立审计确认冻结评分器漏检、官方分析命令不可长期幂等重放、K 路径失败分支未专门验证及 exampleVersion 未贯通；详见本轮 `EXPERIMENT_AUDIT.md`。

## 下一步

- 先修复“核验完成不等于核验通过”，拆分版本标记/元指令/示例的消融，并加严结构化评分；再由独立标注者制作结构不同的未见 Holdout，做 candidate03/修正版同期配对。
- 在产品端增加能区分建议生成、用户接受、修改和正式保存的本地可审计漏斗，才能测量真实转化。
- 没有新的明确授权，不部署 Preview/Production，不把 candidate10 接入当前正式路径，不扩大模型调用。

## 上轮证据

- 6632 隔离库的实际保存、独立只读读回和双下载已在 `mainline-real-input-01/runs/read-download-closeout-20260920a/AUDIT.md` 收口。
- 完整上轮交接保存在本轮目录的 `PREVIOUS_CONTEXT.md`。
