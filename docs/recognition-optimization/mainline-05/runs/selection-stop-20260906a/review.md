# MAINLINE05 本次独立核心审查

结论：**BLOCKED**。审查者 /root/mainline05_full_independent，无上下文，只读24个核心源码/测试/启动文件；完整审查未完成，checker未验收。HEAD e9b87e7dc4546e91d7f5559807b83465ba857cb0。

三个反例均由审查者使用已见人工通知的新内存库，通过真实 SemanticRepository、captureSemantic、confirmSemantic、disposeSemantic 复现；无新文件、模型、网络或真实库访问。不是浏览器记录。

1. S01：multi加print→submit依赖，初始两项正常选中。明确reject submit后，semanticReview仍返回print.selected=true；应撤销后续默认选择并说明依赖。实际confirm print以DEPENDENCY_CONFIRM_FIRST拒绝，正式任务读回0。根因semanticView仅看前置首次默认值，忽略当前处置。
2. S02：完整information可正常review_info；仅清空informationScopeIds后已有UNACCOUNTED_SOURCE_SCOPE，却仍能confirmed，界面仍宣称仅供了解。应保留未覆盖/待核对。涉及semanticState.life与SemanticFacts。
3. S03：已登记sharedMaterial两时间的relatedMaterialTempIds为空，canonical仍新增d0→m0、d1→m0/m1；先确认submit时m0.deadline为d0，再确认print变null。共同任务归属不能生成材料截止。涉及semanticState.canonicalFacts。

关键SHA：

- semanticView.ts：81ee1792c95bc909f9c3e69129af17c44f4139fd554e29f9fa87c9f2a3f7f718
- semanticState.ts：1705c8bb82778d63b4213125f04c1637ef334540a71507117af29517422eed0b

主审已核对当前两SHA一致；完整现场含SemanticFacts和composer见failure.json。全量工程、真实浏览器未验收；模型准确率本轮未测量。

## 仅交付证据表述复核

同一独立审查者随后只读核对本目录5报告与CURRENT_CONTEXT，返回PASS_EVIDENCE_ONLY：三反例、正常对照、SHA及0正式写入的限定表述准确；46/46和42/42没有冒充全包通过；J01–J12、下载、浏览器读库NOT_RUN，checker未审，8文档暂存与25实现保留清楚。此结论只允许交付失败证据，不取消上述BLOCKED、不授权修复或产品交付。
