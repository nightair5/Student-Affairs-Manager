# 本轮产品损失收口及V6实际诊断

2026-10-08。用户本次自主工作包许可共享16请求、US$6.00、4小时、最多3轮；真实原文仅在本机.data保存，本文不是另一次用户确认。首轮只选择4份已见官方节选，验证现有V6，不新建候选，不恢复任何旧不确定请求。

两项直接产品根因：

1. `present`缺少实际owner或关联时，原编译整份拒绝。新`authority-local-coverage-1.0.0`仅在声明present、实际实体索引为空、没有相矛盾的absence依据时形成局部待核对视图。原present声明和`MISSING_PRESENT_FACT`留审计；对应任务默认不选择且正式提交仍受冲突保护。其他已有事件、时间、材料和任务保留。不生成遗漏的事实或关系，不能把局部可显示当整份正确。默认严格解码入口保持，原冻结评分不变。
2. 原答嵌套事件属性与同片段真实任务可合法共存，但原属性反向索引只接受information/event行。新`single-authority-shared-attribute-index-1.1.0`仅接受同scope、实际关联任务、真实task proposition和逐字属性依据；原action覆盖仍是action，不改成information，不猜事件owner。原时点保护保留，属性新增依据不能救活原本错误的时间归属。

普通App录制provider启用上述版本，经既有ReviewSession、DomainCommitPlan和Repository；原响应、转换审计、首次展示和人工修改分开保留。v8、默认候选、D27截止/个人安排机制不变。实际旧4份HTTP录制只读诊断：严格程序1/4可展示，新程序4/4可展示；原答及整份语义0正确3错误1UNKNOWN不改。01仍缺激活/登录窗口owner，03仍缺设备准备义务及登记关联，04仍缺登记关联，02日期边界等争议保留。产品变化是减少已有事实消失和用户重填，不是模型正确率已提高。

只读回放的新reader复用已有独立SETTLED校验：原Git快照/授权/完整链及前缀、唯一grant、逐请求reserve/settle、receipt/raw/usage均须一致。它允许其他合法追加批次，不替代或放宽付费host安全gate。

新诊断复用现有scoped core/host、凭证闭包、Pinned TLS路由和已交付boundary观察。仅新增批次绑定及共享包预算检查；同一包所有批次预分配金额与次数合计不得超6美元/16次，任一HALT/UNCERTAIN停止后续付费，4小时到期停止。新批4身份的保守总上界US$1.297616，拟分配硬限US$1.30，不依赖缓存或低峰；价格/路由须发送前重新核验。

当前状态：本地定向4测试和V6原13测试通过；全量产品9组、安全24组及历史3组通过，6旧哈希/账本快照失败保留；lint/build/security通过，8旧warning/chunk warning及既有audit风险未声称修清。新增预算/现core/boundary15例通过。本次新模型尚未运行，后续证据写同目录并链接唯一RESULTS入口。浏览器最终验收尚待新冻结/实际输出，不能用测试冒充点击证据。
