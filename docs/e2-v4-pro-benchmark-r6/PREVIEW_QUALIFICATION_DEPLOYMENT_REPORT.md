# E2.9-R6 qualification-only Preview 部署报告

- 执行时间：2026-08-20T13:03:00Z–2026-08-20T13:11:29Z
- 源分支：`codex/e2-9-r6-harness-qualification`
- 源提交：`ced7ded`
- 协议：`e2-9-v4-pro-protocol-3.4.0`
- 结论：`QUALIFICATION_ONLY_PREVIEW_DEPLOYED_AND_RELOCKED`
- 模型调用：`0`
- Production 部署：未执行，版本保持 `3b6d6ba2-e21f-495c-80e4-c4bac62366be`

## 实际完成

1. 将独立 Durable Object ledger 版本 `c746adc1-589f-4878-9b91-80f8a3743a87` 部署为内部 Service Binding 目标；未为 ledger 添加公网路由。
2. 先部署 R6 `flag=false` 的主 Preview 版本 `3c1fea3e-869e-490d-8611-ad306495cee3`。
3. 临时在 Cloudflare Preview Secret 中创建 `E2_R6_BENCHMARK_TOKEN`，Secret 值只存在于进程内存和 Cloudflare Secret，未写入文件、日志或 Git。
4. 通过资格专用版本 `7b8bdd57-3e9c-4989-b2e3-578e8d2eb4f7` 登记全新 run label `e29r6-qualification-20260820-b`：
   - HTTP `201`
   - ledger 状态 `QUALIFICATION_RECORDED_MODEL_PHASES_LOCKED`
   - qualification bundle SHA-256 `e3e10c2e9acf6418ca6184ed4260b0d9e6985d2f63d4266ae6be51d07d362413`
   - qualification result SHA-256 `7bb513ee810e2daa996e2dcaa0ecfb70d5ec8eb79bf7024ecb410f0d303b3c2a`
   - `modelCalls=0`
   - ledger 复读 HTTP `200`，记录时间 `2026-08-20T13:08:03.881Z`
5. 在资格专用版本 `6ddc4bd4-d021-4475-835a-ba3057d6bea2` 上验证所有后续阶段继续 fail-closed：
   - `readiness`：HTTP `412`，`MODEL_PHASE_NOT_AUTHORIZED`，`modelCalls=0`
   - `generate`：HTTP `412`，`MODEL_PHASE_NOT_AUTHORIZED`，`modelCalls=0`
   - `selection`：HTTP `412`，`MODEL_PHASE_NOT_AUTHORIZED`，`modelCalls=0`
   - `blind`：HTTP `412`，`MODEL_PHASE_NOT_AUTHORIZED`，`modelCalls=0`
6. 最终恢复主 Preview 版本 `00b759ca-d188-41cd-b9e3-5743e4f5ad94`，其中 `E2_R6_HARNESS_ENABLED=false`；随后删除临时 bearer。最终 Secret 名称列表只包含既有 `DEEPSEEK_API_KEY`，R6 bearer 不存在。
7. 无认证访问 R6 state 端点最终返回 HTTP `404`、`application/json`、`cache-control: no-store`，证明资格端点已重新关闭。

## 失败保留与传播窗口

- 首个新 label `e29r6-qualification-20260820-a` 在客户端 Node `fetch` 连接超时，未获得服务端结果；没有用同一 label 重试，也没有把失败覆盖为成功。
- Cloudflare Secret/代码版本传播期间，相邻请求曾在新旧配置间分别得到安全的 `412` 或 `404`。因此本报告只组合两类已独立观测的证据：成功登记与 ledger 复读，以及四个模型阶段的 `412 / modelCalls=0`。
- 传播窗口没有出现模型调用或开放路径，但说明未来若授权 Readiness，应增加“激活版本稳定窗口 + version metadata 一致性”前置检查，不能只凭一次 HTTP 响应开始模型阶段。

## 部署链

|用途|版本|
|---|---|
|内部 qualification ledger|`c746adc1-589f-4878-9b91-80f8a3743a87`|
|初始 Preview disabled|`3c1fea3e-869e-490d-8611-ad306495cee3`|
|首次激活（label a 客户端传输失败）|`c98710e6-ad45-4cd5-aa67-5e0ea4fe1561`|
|首次恢复 disabled|`058911c0-7530-4f3b-b7ef-432a45fd19e7`|
|资格登记激活（label b）|`7b8bdd57-3e9c-4989-b2e3-578e8d2eb4f7`|
|第二次恢复 disabled|`0bb23c7a-0e02-4d07-8946-226d0ae2ac6a`|
|锁定端点验证激活|`6ddc4bd4-d021-4475-835a-ba3057d6bea2`|
|最终恢复 disabled|`00b759ca-d188-41cd-b9e3-5743e4f5ad94`|
|最终 Secret 删除版本|`fe780dbb-07b2-4c8f-86ca-9419192d03c4`|

## 阶段边界

- `Readiness`：NOT RUN
- `Smoke`：NOT RUN
- `Screening`：NOT RUN
- `Selection`：NOT RUN
- `Blind`：NOT CREATED / NOT RUN
- Production：NOT DEPLOYED
- E3/E4：NOT ENTERED

本次只证明零模型 qualification-only Preview 路径、不可覆盖 ledger 与模型阶段锁定在真实 Preview 环境中可工作；不构成模型质量结论，也不授权下一阶段。
