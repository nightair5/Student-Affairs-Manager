# RCO-5-007-P2-E1/B5 执行状态

- E1：`PASS`。B4 TS2352 仅作类型修补，转译 JavaScript 哈希一致；已见 B4 逐例结果与原结果完全一致；lint/test/build/security 通过。
- B5 数据：先在 `578d2a3` 冻结并推送，之后只运行一次。
- B5 质量主指标：Task F1 100%、requiresAction 100%、Complete Task Case 93.75%、Forbidden 0。
- B5 修订主指标：旧要求完整失效表达 50%、新要求生效召回 100%、陈旧任务 1、被默认勾选的陈旧任务 0。
- B5 总体：`FAIL`。B5 已见，不允许调 P2 后重跑追分。
- 调用：模型 0、实验网络 0、Repair 0、retry 0、Secret NONE。
- 当前门禁：付费模型阻塞、RCO-6 阻塞、稳定路径不变、不部署。
