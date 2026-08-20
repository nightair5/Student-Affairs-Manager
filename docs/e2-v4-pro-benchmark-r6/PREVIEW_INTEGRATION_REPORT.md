# E2.9-R6 Preview-only Harness Integration Report

## 结论

**R6 Preview-only 资格登记链本地集成：PASS。真实模型阶段继续锁定。**

本轮已把 R6 零模型资格结果接入新的 Preview-only runner、Cloudflare Worker 路由和 append-only Durable Object ledger。验证使用内存 Worker/ledger 与 Wrangler dry-run，没有部署、没有外部网络请求、没有读取或调用 DeepSeek。

## 已接入链路

```text
qualification-result.json
  → runner 重新计算 qualification bundle/result hash
  → Preview-only origin + bearer firewall
  → Worker 再次校验固定 hash 与零模型状态
  → Durable Object 再次独立重算 result hash
  → append-only qualification record
  → MODEL PHASES LOCKED
```

新增的 runner 只接受：

```text
--phase=qualification
```

以下阶段在 CLI 或 Worker 层均保持拒绝：

- Readiness
- Generate / Smoke / Screening
- Selection
- Blind

Worker 对上述 endpoint 返回 `MODEL_PHASE_NOT_AUTHORIZED`，测试确认 provider 调用计数为 0。

## 安全与完整性约束

1. 正常 `wrangler.jsonc` 的 Preview flag 固定为 `false`；Production 顶层没有 R6 flag 或 binding。
2. 独立 `wrangler.e2-r6-preview.jsonc` 仅作为未来 Preview 激活配置，本轮没有执行 deploy。
3. Preview 路由要求精确 Preview origin、独立 bearer 和 R6 qualification ledger binding。
4. qualification body 使用 exact-field firewall；expected、模型参数和任意额外字段均不能进入登记链。
5. Worker 只接受当前冻结的 qualification bundle/result canonical hash。
6. Durable Object 不信任上游声明，会再次重算 qualification result canonical hash。
7. 相同 run label 的重复登记返回 `QUALIFICATION_ALREADY_RECORDED`；不同内容覆盖返回 `QUALIFICATION_IMMUTABLE` 或在 Worker hash gate 提前失败。
8. runner 的 dry-run 不读取 token、不发起网络；任何模型 phase 在 token/network 之前失败。

## Hash 绑定

- qualification bundle: `e3e10c2e9acf6418ca6184ed4260b0d9e6985d2f63d4266ae6be51d07d362413`
- qualification result canonical: `7bb513ee810e2daa996e2dcaa0ecfb70d5ec8eb79bf7024ecb410f0d303b3c2a`
- Preview integration bundle: `baba2db426cdf923b6d634764faa03786aa437dbf49b6ce081e40bd9d311d6d7`

Preview integration bundle 覆盖 runner、R6 Worker、R6 ledger、R6 Worker tests、主 Worker route、qualification result、package scripts 和三份 Wrangler 配置；不包含本报告及结果摘要本身。

## 验证结果

- R6 qualification core tests: 13/13 PASS
- R6 Worker integration tests: 10/10 PASS
- `npm run lint`: PASS
- `npm run test`: PASS，共 421/421
  - Vitest: 213/213
  - protocol/dataset Node tests: 103/103
  - server tests: 8/8
  - Worker tests: 92/92
  - Firebase Functions tests: 5/5
- `npm run build`: PASS
- `npm run security:scan`: PASS，597 个扫描对象，0 命中
- `npm run cloudflare:check`: PASS
  - R6 main Worker dry-run: PASS
  - R6 qualification Durable Object dry-run: PASS
  - Production/default Preview/历史实验配置 dry-run: PASS
  - Wrangler dry-run 配置数：11

Wrangler 输出中的 `Total Upload` 是本地打包大小提示；所有命令均带 `--dry-run`，没有上传或部署。

## 当前状态

```text
R6 LOCAL QUALIFICATION PASS
R6 ZERO-MODEL WORKER E2E PASS
PREVIEW DEPLOYMENT NOT RUN
MODEL READINESS NOT AUTHORIZED
MODEL QUALITY NOT AVAILABLE
SELECTION NOT AUTHORIZED
BLIND NOT CREATED
PRODUCTION NOT READY
E2 BLOCKED
```

## 下一道授权门

如要继续，下一步只能是独立授权的 Preview 部署与资格登记验证，仍不得自动调用模型。其前置条件包括：

1. 提交后以最终 Git commit 重新绑定 deployment source；
2. 为 R6 Preview 创建独立 bearer Secret，只存在于 Cloudflare Secret 与进程内存；
3. 先部署 qualification ledger，再部署默认关闭的主 Preview；
4. 实时验证默认 R6 endpoint 为 404；
5. 经单独授权后临时启用 qualification-only 配置，只登记当前资格 hash；
6. 立即恢复 flag=false 并删除临时 bearer；
7. 在上述部署证据通过前，不得申请 Readiness 模型调用。
