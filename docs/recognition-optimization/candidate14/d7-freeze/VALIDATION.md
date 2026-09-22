# D7冻结验证

- Candidate14为单一完整Prompt。
- Reference/Scorer 5.3对有意义符号、evidence scope、悬空实体、无任务事实范围、依赖环、修订状态和Schema聚合执行失败关闭。
- time policy 1.1、no-task disposition 1.2、measurement 2.2定向测试通过。首次输出锚点在识别完成时冻结；测量要求持久注册及有序commit/archive→readback。
- 24份D6 raw/result只作证据链复核；根因分栏为预分配事后假设，不冒充确定性裁决。
- 模型调用、grant、预算操作、Secret读取、账本写入均为0。
- 84份保护文件保持校验；旧D4/D5校验在合法791行账本上保留历史`D3_AUTHORITY_LEDGER_DRIFT`。
