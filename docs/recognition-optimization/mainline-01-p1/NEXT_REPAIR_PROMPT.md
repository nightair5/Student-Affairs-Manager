# 下一轮最小授权提示词（尚未授权）

```text
授权执行 RCO-5-MAINLINE-01-P1-R1：仅修复本轮审查已登记的确认边界缺口，恢复当前未提交的隔离 V2 实现；不重做计划、不新建数据集。

先核对 Git、IMPLEMENTATION_BASELINE.json、REJECTED_SNAPSHOT.json、INDEPENDENT_REVIEW_IMPLEMENTATION.md 和 CURRENT_CONTEXT。若源码哈希与失败现场不符或有重叠用户修改，停止；本机已有实现不得重复应用 FAILED_IMPLEMENTATION.patch。

允许文件保持原 PLAN 白名单：公共文件仍仅 domainCommit.ts 和 DraftReviewPanel.tsx 显式 V2 增量；新文件只限 confirmationV2.ts、confirmationV2.test.ts、mainline01p1/confirmationHarness.ts、browser.tsx、confirmationHarness.test.ts、原计划两个隔离脚本、新报告、CURRENT_CONTEXT 和追加日志。旧接口/default行为、App、Schema、repository、validator不改；需要扩大范围先申请。

唯一主因：确认决策必须基于完整相关实体与实际用户操作，不能只信selected、任务直接关联或显示值。
1. 先写能复现审查失败的新测试：optional_suggestion默认勾选；时间仅经材料关联；冲突绑定时间/材料/事件；共享事件时间；date-only转具体时刻时区；正常逐字编辑。
2. 区分安全默认选择与用户主动确认：非explicit不得默认选；不可确认项即使selected=true也不能越过检查；不得靠全部拒绝/全部不选通过。
3. 沿实体引用查全任务相关材料、时间、事件和冲突。保留归属；不能承接的关系明确阻断，不以无日期、空eventTempIds或空字段掩盖丢失；有效兄弟项仍可单独确认。
4. 原文/首次建议/用户编辑分别保存。显示、验证、构建、存储采用同一明确时区。采用输入缓冲或显式保存支持正常逐字编辑，未保存内容不能被悄悄确认或称为已持久化。
5. 沿用旧工程响应与42字段口径：旧17测试、40/42和历史FAIL不改；新V2须42/42。补齐逐项、批量、无日期、部分确认、刷新、重复、回滚、版本过期及安全测试。
6. 同根因最多两轮局部修补。定向/对抗通过后新无上下文审查；无阻断才跑一次完整lint/test/build、安全、依赖、保护检查，并完成真实面板V2→新测试库确认→刷新读回。

0次外部模型调用，不访问密钥，不修改既有Expected/freeze/dataset/checkpoint/cache或冻结组件，不运行旧一次性runner，不接稳定入口、不启动RCO-6、不部署。仅允许修复已登记反例；发现新的错误默认勾选、保护变化、测试弱化、范围扩大或两轮无效，立即停止并出审计。

通过后单独提交推送业务实现并核对远程，交付审计、数字、保护状态、缺口、下一步理由和提示词；未通过仅交付明确标记的失败证据。模型准确率写“本轮未测量”。CURRENT_CONTEXT约80行，长日志留文件，完成后停止。
```
