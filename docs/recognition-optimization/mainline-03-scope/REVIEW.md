# MAINLINE-03-SCOPE 独立范围/读者复核

日期2026-09-06；新无上下文审查者 /root/mainline03_scope_review，fork_turns=none。
材料：本目录四份范围文档、根AGENTS当前RCO节、直接相关源码。未读完整历史，未运行产品/模型测试，未写源码。
目标读者：下一轮执行者；预期动作：取得新授权后按精确白名单实施，不能推导付费/Schema/稳定接入权限。

## 首次发现：BLOCKED，文档一处矛盾

原白名单要求引用损坏仍保存完整草稿并让兄弟项确认，但schema.ts完整reference校验会让capture整体失败，shapeValidator也不允许绕过。
如果不改文档，执行者可能为凑“局部确认成功”擅改共享校验器。审查同时确认pending-source/span诊断、Source receipt现有写入通道、候选表达缺口、十文件范围与付费未授权边界成立。

## 定向修正

只改IMPLEMENTATION_WHITELIST第3节第6条、VALIDATION_DESIGN D/分母段、NEXT_PROMPT验收段。
完整Schema/reference/semantic校验失败→仅保留Source receipt、失败Run/Draft；通过完整校验且V2能隔离→保留有效草稿、局部核对；无法局部承接列限制，不计产品通过。
未增加源码白名单或改变冻结策略。

## 审查者最终答复（原文，800字以内）

PASS（范围文档复核通过，非产品验收）。

原阻断已消除：IMPLEMENTATION_WHITELIST.md:54、VALIDATION_DESIGN.md:13、21、NEXT_PROMPT.md:18一致区分完整校验失败与可局部隔离的问题。前者保留Source receipt及失败Run/Draft，不能写有效draft.result；后者才进入冻结V2核对，并要求有效兄弟可确认。

该边界符合src/recognition/schema.ts:506–519、src/domain/v2/capture.ts:415–450的实际校验及持久化顺序，也与confirmationV2.ts:113–148的逐项阻断一致。文档明确将无法局部承接列为限制，不计产品通过，不授权修改共享校验器或扩大十文件白名单。

未发现剩余阻断；本次只读，未写文件、未运行产品或模型测试。

## 复核结论的范围

读者可复述唯一下一包、来源先存、原始响应与适配结果分层、完整校验失败的终态、保护与付费边界。复核PASS仅代表范围可执行，不代表模型语义、所有字段泛化、真人效用或商业上线通过。
