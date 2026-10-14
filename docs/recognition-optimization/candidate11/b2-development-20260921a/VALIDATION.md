# B2 验证记录

## 发送前

- 分支、本地 HEAD、upstream 与 `git ls-remote` 一致；发送代码先提交并推送。
- B1 Manifest SHA-256 为 `af1f1d2427eec1795691e1d4a62056a614bac72f0254103667632b341794744e`。
- `node scripts/prepare-candidate11-b1.mjs --verify`：24 请求、6 参照、84 份保护文件通过；模型调用 0。
- 权威账本精确匹配 644 行、314 reserves、519152 字节和冻结 SHA。
- DeepSeek 官方文档核验 `deepseek-flash` 对应 V4.1 Flash，峰值未缓存输入 ¥2/M token、输出 ¥8/M token；证据和有效期见 `BILLING.json`。
- B2 定向零网络测试 4/4 通过：grant/预算、排他顺序、过期计价/缺 Secret 预留前阻断、uncertain 后不可重试。

## 执行与后处理

- 24/24 HTTP 200、24 raw、24 reserve、24 settle；0 retry、0 repair、0 verifier、0 halt、0 uncertain。
- 所有 response SHA、provider request ID、usage、费用上界和 ledger event hash 已在 `EXECUTION_LEDGER.json` 交叉绑定。
- 发送期本地上下文路径缺陷保留原记录；未改动 raw 经过冻结适配器/冻结上下文重放 24/24 通过，见 `ADAPTER_REPLAY.json`。
- D06 按 B1 冻结动作/对象和状态规则完成强制裁决；两个旧端点被非法合并，修订方向无法通过。

## 工程检查

- `npm run lint`：0 error，5 个既有 warning。
- 裸 `npm run test`：1421 通过、1 跳过、1 失败；既有 Candidate02 启动器用例未设置 `REAL_INPUT_CARRIERS_MANIFEST`，报 `lstat ...\\undefined`。B2 指令要求原样记录并改用隔离检查器完成其余组，未修改旧测试或断言。
- `node scripts/candidate11-checks.mjs build`：typecheck 与 Vite build 通过；保留既有 chunk-size warning。
- `node scripts/candidate11-checks.mjs security`：通过。
- `node scripts/candidate11-checks.mjs test`：Vitest、server、worker、Functions、时间、multimodal、C11 scoring/history/gateway/preview 均通过；唯一失败是历史 RCO-5-007。
- 历史失败原样保留：`FREEZE_HASH_MISMATCH:package-lock.json`。未改 `package-lock.json`、旧冻结哈希、旧 Expected 或发布门槛。

最终提交和远端 SHA 由交付报告给出。本验证不构成发布、部署或 Holdout 授权。
