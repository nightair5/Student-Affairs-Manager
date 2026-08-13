# E2.9-R5 Protocol 3.3.0 — Readiness 报告

日期：2026-08-13  
分支：`codex/e2-9-r5-harness-preflight`  
状态：`READINESS_PASS — STOP BEFORE SMOKE`

## 结论

R5 Preview 的 6 次 Readiness 模型探针已按授权完成：Flash 3 次、Pro 3 次，全部 HTTP 200、全部一次完成。四路模型身份 `requestedModel`、`returnedModel`、`executionModel`、`result.modelName` 均与冻结 arm 一致。

本阶段只证明 Preview、服务端 Secret、DeepSeek 连通性、模型身份与 R5 幂等账本链路可用，不构成任何模型质量结论。`qualityConclusion` 仍为 `NOT_AVAILABLE`。

## 授权与调用计数

| 项目 | 结果 |
| --- | ---: |
| 授权上限 | 6 |
| 实际模型调用 | 6 |
| Flash | 3/3 |
| Pro | 3/3 |
| 失败或重试 | 0 |
| Smoke / Screening / Selection / Blind | 未运行 |

6 个 observationId 与 6 个上游 requestId 均唯一。每个账本 observation 只有一次 attempt，未发生补跑、fallback 或失败后覆盖。

## 模型身份与运行指标

| Arm | HTTP 200 | 四路身份一致 | Fingerprint / Usage | 服务端延迟总计 / 均值 | 客户端延迟总计 / 均值 | Input / Output / Total Tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `deepseek-v4-flash` | 3/3 | 3/3 | 3/3 | 2888 / 962.67 ms | 4837 / 1612.33 ms | 132 / 15 / 147 |
| `deepseek-v4-pro` | 3/3 | 3/3 | 3/3 | 3323 / 1107.67 ms | 5226 / 1742.00 ms | 132 / 15 / 147 |

这些数字仅是 3 次短探针的运行观测，不应用于推断正式复杂通知的质量或稳定性能差异。

## 完整性绑定

- 实现提交：`2c91384515ac559fc943628b22179d8b3884c003`
- Run manifest：`590373a478a266df0440c9005b58718686d8dc3c47ad677d24e66ced82a5a8ab`
- Readiness manifest：`b620bf447c2c17ffb02a1a79ab2723d3deaca544c7d947c0401e6c752c075869`
- Protocol bundle：`d6b4729b4a80582363cd112d2143d24a347d96dc635e8dca7ac4400b2b7c0b1b`
- Preview activation：`47f12c5a33b8aa2ad79632a0b08b0daa8a19c3df7730cc07518d2c813a272a73`
- Readiness checkpoint：`a7a3510f221719356f984095813715e3670b03780191d2aedd2ea568d0cbc7e6`
- Ledger state：`bb0901fabc18144c1da583050d6092e2f2a13af200397d0f1794f69e54732cfe`

Checkpoint gate 为 `GENERATION_COMPLETE`。Ledger 已推进到 `SMOKE_OPEN`；全局 `runStatus=PARTIAL` 是因为后续 26 个已预注册 observation 尚未运行，符合当前只授权 Readiness 的边界。

但 `SMOKE_OPEN` 只表示服务端状态机的逻辑阶段，不代表当前 run 可以在以后直接续跑。临时 Bearer 已在授权的 6 次调用结束后从本地进程内存销毁，Cloudflare Secret 不可回读；换 Secret 或重新部署会改变已注册的 activation/deployment 绑定。因此当前 run 在 Readiness 后视为终止，不能选择性补跑 Smoke。

## Preview 与 Production 边界

- 已执行的 Preview 版本：`6d4d09db-074f-44fd-8832-ed5ad83ee2d2`
- 隔离 Ledger 版本：`df36beb2-f825-47a1-ad49-df588a2960b7`
- Production 最新版本保持：`3b6d6ba2-e21f-495c-80e4-c4bac62366be`
- 运行期间，无 Bearer 与错误 Bearer 均返回 HTTP 401；6 次调用完成后，临时 Secret 已删除并恢复正常 Preview 配置，R5 端点返回 JSON HTTP 404。
- Bearer 只在执行进程内存中使用；原始输出、headers、fingerprint 与 requestId 只保存在 Git ignored cache。
- 未部署 Production，未修改 `student-affairs.site`，未进入 E3/E4。

收尾撤权版本：Secret 删除 `4ad9b4d6-5e4a-46a4-9f69-9ef9f6a68ff3`；`flag=false` Preview 部署 `c9b9429b-4cef-4c9a-9c0a-aeffc9d1fc72`。Preview Secret 清单恢复为仅含服务端 `DEEPSEEK_API_KEY`，不再含 R5 Bearer。

激活编排期间曾产生一个已被覆盖的 Secret Change 版本 `5beed008-bbb4-4a38-967e-66b56c11f73f`：该次在激活部署前因本地 PowerShell stderr 处理失败而终止，没有启用 R5 路由，也没有产生模型调用。正式执行绑定的是随后新建的 Secret Change `d05f0ae9-e5e2-424a-853d-29d7730880d6` 与 Preview 激活版本 `6d4d09db-074f-44fd-8832-ed5ad83ee2d2`。

## 停止点

Readiness 已完成并停止。若后续仍要进行 Smoke，必须获得新的明确授权，并创建全新的 run ID、run label、phase labels、activation 与 Readiness；不得复用或改写当前 6 条 observation。当前不得运行 Smoke、Screening、Selection 或 Blind，也不得评分或形成模型优劣结论。
