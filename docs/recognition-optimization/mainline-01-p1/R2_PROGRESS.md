# RCO-5-MAINLINE-01-P1-R2 工作证据索引

最终状态：限定隔离V2通过；详见R2_AUDIT.md。模型准确率：本轮未测量；没有G5、稳定入口或发布晋级。

- 授权与起始：R2_BASELINE.json，d45467d，687原tracked/683保护项；R1九源码哈希匹配。
- 红测试：R2_RED_TESTS.json，6失败/62通过；旧工程夹具仅内存变形。
- 第一轮修补后：R2_TARGETED_TESTS.json，68通过/0失败；旧17与40/42不改，新V2同口径42/42。
- 修补：V2编辑入口/编译器共享原提交器支持类型集合；拒绝planned_start/event_start/event_end编辑；保存前用真实计划试算；编译器检查计划和模拟canonical对用户时间修改的实际采用。
- 兼容：原编译器行为保持，result_announcement沿用原本已支持的覆盖行为，不新增新的时间类型语义；禁止支持的范围与可确认范围分开，未编辑时间和有效兄弟仍保留。
- 原文、首次响应不覆写；修改沿原历史机制保留。输入缓冲/显式保存是已有R1实现，本轮仅增加时间编辑限制提示。
- 独立审查：/root/p1r2_independent_review，fork_turns=none；定向复跑日志：C:\Users\Winner\AppData\Local\Temp\rco-mainline-01-p1-r2-TEA9ZD\results.json。最终结论另列。
- 浏览器协议：沿用R1_BROWSER_PROTOCOL.md，新的实际观察另写R2_BROWSER_OBSERVATION.md，不覆盖旧协议/报告。
- 后续完整工程967通过/1跳过，独立审查无阻断，真实浏览器协议8/8及双项批量确认完成；见R2_ENGINEERING_CHECKS.json与R2_BROWSER_OBSERVATION.md，不借用旧阶段绿灯。
- 外部产品模型/模型网络/verifier/Repair/retry/密钥访问/CNY=0/0/0/0/0/0/0。
