# D7冻结验证

- Candidate14为单一完整Prompt。
- Reference/Scorer 5.4分别锁定动作、对象与证据scope，拒绝相反语义、未声明事件字段、悬空实体、依赖环、错误修订状态和Schema失败。
- time policy 1.1、no-task disposition 1.3、measurement 2.3定向测试通过。首次输出锚点在识别完成时写入独立追加式历史记录；真人测量须预置外部授权并绑定首次输出哈希，当前仍NOT_OBSERVABLE。
- 24份D6 raw/result只作证据链复核；根因分栏为预分配事后假设，不冒充确定性裁决。
- 模型调用、grant、预算操作、Secret读取、账本写入均为0。
- 84份保护文件保持校验；旧D4/D5校验在合法791行账本上保留历史`D3_AUTHORITY_LEDGER_DRIFT`。
