# D17 零调用执行准备验证

2026-09-28。此处只验证本地准备，不代表 24 次付费比较已经执行。

- D16 冻结包 `prepare-candidate17-d16.mjs --verify`：12 份 provisional 完整参照、24 个身份、6 AB/6 BA、全部 `NOT_RUN`；D16 guard 通过。
- D17 离线执行器和预注册选择器：Node 定向测试 **17/17 通过**。包含身份/请求 SHA 漂移、重复与顺序、预算不足、进程锁、reserve/send/raw/settle/状态持久化故障、缺 usage 的保守结算、关键 FN/材料错误的风险退步和不可比结局。`node --check` 通过。
- 无授权实测：`--prepare-authorized` 与 `--dispatch-next` 均退出 1，报 `D17_LIVE_AUTHORIZATION_REQUIRED`；账本 SHA 前后不变。只读 `--verify` 报 0 请求、0 grant/reserve/settle 和 24 个未授权身份。
- `npm run lint` 退出 0（8 个既有 warning，0 error）；`npm run build` 通过；`npm run security:scan` 通过。历史保护校验通过：84 份保护文件、119 份冻结文件不变；权威账本只读 889 行、SHA-256 `01d6670af09175475fcdfa5aec3594d2751cfd3b03050743fb79a04a578ad4c9`。
- 全量 `npm run test` **未通过**：1507 passed、4 failed、1 skipped，另 1 个失败 suite。失败是旧 D9 Node 文件没有 Vitest suite、旧 carrier 环境变量缺失、realInput 接受/运行时两个 5 秒超时，以及 candidate11 运行时一个 5 秒超时；当前 D17 新代码不在这些失败路径。把 candidate11 的 15 个测试单独重跑后 **15/15 通过**，说明它在全量负载下触发了旧 5 秒限额，但不据此把全量改称通过。本轮没有修改旧冻结文件、Expected、锁或断言来凑绿。原始日志保存在 Git 忽略的 `.data/candidate17/d17-full-test.log`。`npm test` 在 Vitest 失败后未继续后续链，不能称全量 PASS。

本轮没有更改产品 UI，因此 D16/D15 的实际浏览器证据仍按各自日期保留，本轮未新增浏览器通过声明。四项真人主指标继续 `NOT_OBSERVABLE`。首次真实调用前仍须重核官方价格、模型路由、最终推送 HEAD、冻结哈希、账本与用户本批费用硬上限；不满足即停在 0 grant、0 调用。
