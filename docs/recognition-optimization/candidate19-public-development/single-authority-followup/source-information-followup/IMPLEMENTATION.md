# 原回答已有的来源信息直接展示

2026-10-06。一个当前根因：C19 SA01 原答把“完成学习后提供学习证明”声明为 information，真实转换结果已保留在 ignoredContent，但 OrdinarySourceFacts 没有展示它。发生层为普通首次页面，不是本轮发现的新模型遗漏。

公共 source-information-preview-1.0.0 从现有 reason=other 信息生成来源级补充说明。必须有同 sourceId 的真实逐字 evidence，且信息、证据都在当前 SourceVersion.rawText 中。实体已使用的依据不重复显示，重复信息去重；无据、跨来源、来源版本过期不展示为当前说明。没有推断实体、owner、关系、任务、时间或新增事实。未解决的信息与活动关联争议仍 UNKNOWN，不判整份正确。

普通 App 在既有来源草稿事务内保存 firstSourceInformationDisplayed（版本、来源版本、原文、evidenceIds、过滤审计、inferredFacts=0）。原识别回答、转换、首次显示和用户修改各自保留。数据使用 v8 legacyData，不改 Schema 或正式保存链。UI 直接显示原文说明和可展开依据，无新增强制核对/补录步骤。正式确认仍由用户操作 ReviewSession→DomainCommitPlan→Repository。

[同两份原 raw 的诊断](DIAGNOSTIC.json)与[封存现场只读核验](READ_ONLY_SCENE.json)。C19补充说明可见，不把它挂到活动或把语义争议变为正确；SingleAuthority原嵌套属性已有展示不重复。两份均0任务、1事件、2时间。旧冻结报告、先前 POST_PROGRAM_REPORT、原候选/Prompt/Manifest/8身份/原始字节不改。本轮没有新生成假设、候选或付费批。

代码交付前10定向、4只读Node、9当前产品组、24当前安全检查记录（含carrier构建）确定退出通过；lint0错误8既有警告，build通过且保留既有大包警告，security scan通过。最终新端口/新库浏览器及交接在后续证据提交，代码测试不能代替实际点击验收。旧6历史失败与audit5H2M/production0沿原VALIDATION明确复用，未重新运行或改断言。

