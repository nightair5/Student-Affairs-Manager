# 项目入口：现在该读什么、做什么

更新：2026-09-27。本页是索引，不新增规则或授权。当前主线在 candidate11 独立工作区；Candidate14 仍被评分契约阻断。

## 每次接手只读这些

1. [PRD](../PRD.md)：用户目标、四项指标和验收含义。
2. [AGENTS](../AGENTS.md)：自主执行、数据保护、版本边界与分层检查。
3. [CURRENT_CONTEXT](recognition-optimization/CURRENT_CONTEXT.md)：实际最新状态和未完成项。
4. 当前工作包：[D8 执行提示词](governance/NEXT_STAGE_EXECUTION_PROMPT.md)；先完成契约与测量修正，再准备新调用。后续五批工作、角色与验收见 [完整执行路线](governance/PROJECT_EXECUTION_ROADMAP.md)。
5. 按涉及范围查 [全局复查与行动表](governance/review-20260927-r2/REVIEW_AND_ACTIONS.md) 和 [外部资源目录](governance/review-20260927-r2/RESOURCE_CATALOG.md)。不必把全部历史载入上下文。

## 文件按用途使用

| 文件或目录 | 定位 | 使用方法 |
|---|---|---|
| 根 PRD / AGENTS | 当前目标与执行规则 | 产品要求不等于已实现；旧快照不能覆盖现行范围 |
| CURRENT_CONTEXT | 当前短交接 | 发生变化时更新；具体分数和长日志留在结果包 |
| refine-logs/EXPERIMENT_PLAN、TRACKER、MANIFEST | 阶段历史及索引 | 看顶部当前说明，旧行保持当时的授权和状态 |
| recognition-optimization/RECOGNITION_OPTIMIZATION_PLAN | 2026-09-05 旧计划 | 仅追溯；不从旧 RCO-0 重新开始 |
| candidate*/冻结清单、raw、Expected、results | 不可改写的实验记录 | 追加订正或另存新版；不把旧失败改成通过 |
| COMMERCIAL_VALIDATION_CONTRACT | 未批准的全范围商业草案 | 不强套日常开发；也不以小规模开发成绩声称商业达标 |
| governance/archive | 旧 PRD / AGENTS 原字节 | 用于历史核验，不是当前执行入口 |
| governance/GOVERNANCE_BASELINE | 授权文档换版后的保护版本 | 82 原位 + 2 存档；并查当前两文档、D7 组件和只读账本 |
| RUNBOOK / SECURITY / 服务边界 | 运维、报告及接入规范 | 涉及该服务时按需读；定期检查表不自动创建运维任务 |
| README / PR 模板 / CI | 开发说明及检查入口 | 不推断线上已接通；CI 历史阻断如实保留 |

## 这轮的合理停止范围

缺独立人工不阻止本地开发；契约漏洞阻止可信评分和新的付费派发，但允许修复根因。缺浏览器证据只让用户端验收保持未验证。账本、预算或发送状态不明时停止相关调用，不能重发猜测。

下一批工作优先连续完成 W1 契约、W2 确认与测量、W3 零调用准备。在其内部按可解释边界提交推送即可；不要为每个错误新建聊天、分支、冻结数据或审计轮次。当前 worktree 能安全容纳同一主线时继续复用。
