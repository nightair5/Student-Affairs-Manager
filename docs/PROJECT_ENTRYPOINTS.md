# 项目入口：现在读什么、做什么

更新：2026-09-29。当前独立支线继续 candidate11 worktree，不因阶段名称重建仓库。

1. [PRD](../PRD.md)定义稳定产品目标；[AGENTS](../AGENTS.md)定义执行和保护。
2. [CURRENT_CONTEXT](recognition-optimization/CURRENT_CONTEXT.md)是唯一当前状态。
3. [D18全局审查](governance/d18-product-direction/REVIEW_AND_DECISIONS.md)说明为何卡住及设计调整；[D17追加解释](recognition-optimization/candidate17/d17-development/D18_INTERPRETATION_CORRECTION.md)纠正把评分红项直接当模型事实错误的表述。
4. [活动路线](governance/PROJECT_EXECUTION_ROADMAP.md)与[D19执行提示词](governance/NEXT_STAGE_EXECUTION_PROMPT.md)是下一工作包。
5. [跟踪表](../refine-logs/EXPERIMENT_TRACKER.md)只维护状态；旧快照见[D18存档](governance/archive/2026-09-29-d18/ARCHIVE_MANIFEST.json)。

保护入口为 node scripts/verify-recognition-history.mjs --verify；历史结果和许可不可复用或追溯改判。活动文档由Git版本管理，旧测试断言不作为新编辑的永久总门。模型调用、真人研究和发布仍分别需要适用范围授权；缺其中一项不阻止其余安全本地工程。
