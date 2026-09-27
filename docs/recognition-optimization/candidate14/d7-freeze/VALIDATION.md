# D7冻结验证

- Candidate14为单一完整Prompt。
- Reference/Scorer 5.5分别锁定动作、对象、条件、事实与证据scope，拒绝未声明事件时间、地点、悬空实体、依赖环、错误修订状态和Schema失败。信息类事实在当前wire中仅能核验scope保留，不能证明禁止/引用/待公布的细分语义正确。
- time policy 1.1、no-task disposition 1.4、measurement 2.4定向测试通过。首次输出锚点在独立本机存储；真人测量须由独立协调方预置授权并绑定首次输出哈希，当前仍NOT_OBSERVABLE。
- R4 Manifest `00cf591998b6396ca4bbbbca61b4a0594cdb88f86b8879f02391bdea350a8866` 在派发前失效；新生成器、选择门槛随本次冻结。
- 24份D6 raw/result只作证据链复核；根因分栏为预分配事后假设，不冒充确定性裁决。
- 模型调用、grant、预算操作、Secret读取、账本写入均为0。
- 84份保护文件保持校验；旧D4/D5校验在合法791行账本上保留历史`D3_AUTHORITY_LEDGER_DRIFT`。
