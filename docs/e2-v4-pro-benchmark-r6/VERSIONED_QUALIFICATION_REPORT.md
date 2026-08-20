# E2.9 R6 Versioned Qualification-only Preview 报告

## 结论

`R6_VERSIONED_QUALIFICATION_PASS_MODEL_PHASES_LOCKED`

R6 qualification-only Harness 已在独立、最小化 Cloudflare Worker 上完成零模型端到端验证。成功标签为 `e29r6-qualification-20260820-f`，模型调用为 0，expected answers 未加载。该结果只证明 Harness 的隔离、版本绑定、鉴权和前置 Gate 可用，不提供任何 DeepSeek V4 Pro/Flash 质量结论。

Readiness、Generate、Selection 和 Blind 仍由 Worker 返回 `412 MODEL_PHASE_NOT_AUTHORIZED`。Production 未部署，主 Preview 默认路径未改变。

## 本轮修复

1. 新建独立入口 `cloudflare/e2-r6-qualification-worker.mjs`，只暴露 R6 qualification Harness 路由；其他路径统一 404。
2. 独立 Worker 不加载生产 Worker、静态站点或模型 Provider，不包含 `ASSETS` 与 `DEEPSEEK_API_KEY` 绑定。
3. Harness 只接受 Cloudflare 不可变 Versioned Preview URL；canonical workers.dev URL 即使携带正确凭据也返回 404。
4. 一次性 Bearer 只存在于执行进程内；Worker 版本仅保存 SHA-256 承诺，Cloudflare Secret 数量为 0。
5. 激活证明、Qualification 注册和状态回读都绑定完整 Worker Version ID；模型阶段继续 fail-closed。

该设计直接消除了逐步部署中的版本偏斜：Cloudflare 说明，在一次请求生命周期内产生的独立请求可能命中不同版本；Versioned Preview URL 则可直接测试指定不可变版本而不把该版本分配到正常流量。参考：

- <https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/>
- <https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/>

## 在线验证结果

| 检查 | 结果 |
| --- | --- |
| Source commit | `d1a0c59a5f490d835e6e18f4c550b69b31f6477a` |
| Protocol | `e2-9-v4-pro-protocol-3.4.0` |
| Harness | `e2-9-r6-preview-harness-1.3.0` |
| 成功 run label | `e29r6-qualification-20260820-f` |
| Qualification Worker version | `682a84a1-a35a-47e3-8421-e72a5c1337c4` |
| Qualification version 接收正常流量 | 否；仅通过 Versioned Preview URL 调用 |
| 连续稳定激活 | 3/3，均返回同一完整 Version ID |
| Ledger | `QUALIFICATION_RECORDED_MODEL_PHASES_LOCKED` |
| Ledger recordedAt | `2026-08-20T13:43:03.099Z` |
| State readback | HTTP 200，版本/协议/哈希一致 |
| Model calls | 0 |
| Expected answers loaded | false |
| Readiness / Generate / Selection / Blind | 均 HTTP 412 |
| `/api/deepseek` | HTTP 404 |
| canonical qualification URL | HTTP 404 |
| 无凭据 Versioned activation | HTTP 404 |

绑定关系：

- Qualification bundle SHA-256：`e3e10c2e9acf6418ca6184ed4260b0d9e6985d2f63d4266ae6be51d07d362413`
- Qualification result SHA-256：`7bb513ee810e2daa996e2dcaa0ecfb70d5ec8eb79bf7024ecb410f0d303b3c2a`
- 成功版本共有 8 个绑定，限于 Version metadata、哈希承诺、R6 flag/origin/frozen hashes 与 Qualification Ledger。
- `DEEPSEEK_API_KEY`：不存在。
- `ASSETS`：不存在。
- Cloudflare Secret：0。

## 初始化与 no-rerun 审计

独立 Worker 首次创建时，Cloudflare 要求先有一次部署，才能使用 `versions upload`。因此创建了初始化版本 `a018c247-aae9-40ff-bf4c-9bc1e6a7f1eb`；该 Worker 的 canonical URL仍受 versioned-only 防火墙保护，不形成公开 Qualification 入口。

初始化命令的终端摘要在返回前结束。后续没有重新提交原标签 `e29r6-qualification-20260820-e`，而是通过新的、未部署的只读核验版本查询 append-only Ledger。查询确认标签 `...-e` 未记录，随后才以全新标签 `...-f` 注册一次。不存在失败被成功覆盖或同 observation 重跑。

此前主 Preview 上的 `...-c` 与 `...-d` 路由偏斜尝试继续作为失败证据保留；均未写入 Qualification Ledger，也未产生模型调用。

## 外部状态

- 主 Preview：`9cb3eda7-bfd0-48f7-9313-398f2d8d26cc`，100%，`E2_R6_HARNESS_ENABLED=false`，无 R6 token binding。
- 独立 Qualification Worker：初始化版本 `a018c247-aae9-40ff-bf4c-9bc1e6a7f1eb` 接收 100% canonical 流量，但 canonical URL被应用层固定隐藏；成功 Qualification 版本 `682a84a1-a35a-47e3-8421-e72a5c1337c4` 未部署到正常流量。
- Production：仍为 `3b6d6ba2-e21f-495c-80e4-c4bac62366be`，创建时间 `2026-08-08T08:55:40.370263Z`；本轮没有部署或调用 Production。

## 边界与下一 Gate

本轮没有运行 Readiness、Smoke、Screening、Selection 或 Blind，没有调用模型，没有读取 expected answers，也没有形成模型质量结论。

只有在新的明确授权下，才可基于这个 Qualification 记录创建新的 R6 模型 run；届时仍须依次通过 Readiness → Smoke → Screening，并在任一 Gate 失败时停止。Selection、Blind 和 Production 继续禁止。

机器可读证据见 `versioned-qualification-result.json`。
