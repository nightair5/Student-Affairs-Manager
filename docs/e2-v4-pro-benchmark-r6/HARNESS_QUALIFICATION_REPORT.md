# E2.9-R6 Harness Qualification Report

## 结论

**本地零模型 Harness 资格验证：PASS。**

这不是模型质量结论，也不授权任何真实模型调用。R5 仍保持 `EXPERIMENT_BLOCKED / NOT_AVAILABLE`；Readiness、Smoke、Screening、Selection、Blind 和 Production 均未执行、未授权。

## 本轮修复

1. 审阅包改为从零构造的最小 DTO，只允许 `Source + X/Y business projection`。
2. `caseId`、X/Y 模型映射、side hash 和 assignment commitment 全部移入独立私有 binding manifest，不再进入审阅包。
3. 审阅包、私有 binding 和人工 labels 使用三份独立 Schema；所有公开层级执行 exact-key 校验。
4. 泄露检测改为 Schema 感知：
   - Source 原文只检查禁止字段和可关联字段，不因原文引用模型名误报；
   - X/Y、rubric 与人工 labels 检查模型身份值；
   - `protocolVersion` 等 envelope 元数据只做契约校验，不参与业务泄露扫描。
5. 错误状态拆分为直接身份暴露、可关联风险、公开 Schema 违规、标签内容暴露、私有 binding 不一致、时间顺序错误和 Harness 集成失败。
6. side assignment 与 commitment 使用 keyed HMAC；公开包不含可供外部重算的确定性 side hash。
7. 新增双世界不可区分测试：只交换私有模型身份及 alias、保持 X/Y 业务内容不变时，审阅者可见 packet 字节保持一致。
8. Secret scanner 正式覆盖 R5/R6 benchmark token 与 reveal secret 名称；只报告文件位置和规则类别，不打印值。
9. 增加资格 bundle hash 与资格结果 hash 的双重前置条件。未来 runner 即使取得一份旧 PASS，也会在代码或 Schema 漂移时 fail closed。

## 信任边界

```text
private generation record
        |
        +--> allowlist projection --> reviewer packet: Source + X/Y only
        |
        +--> private binding manifest: identity + hashes + commitment

reviewer packet --> labels freeze
private binding + frozen labels --> reveal --> synthetic scoring --> qualification gate
```

公开 reviewer packet 不包含：

- `caseId`
- `XAlias` / `YAlias`
- `modelName` 或 provider lineage
- token / latency / request / deployment metadata
- `sideXHash` / `sideYHash`
- `assignmentCommitmentHash`

## 零模型生命周期验证

执行链：

```text
SYNTHETIC_GENERATION
→ PUBLIC_PROJECTION
→ LABEL_FREEZE
→ PRIVATE_REVEAL
→ SYNTHETIC_SCORING
→ QUALIFICATION_GATE
```

结果：

- synthetic pairs: 2
- model calls: 0
- network calls: 0
- expected answers loaded: false
- mapping verification: 2/2
- final status: `HARNESS_QUALIFIED_FOR_FUTURE_PREFLIGHT`
- all downstream authorizations: false

绑定值：

- qualification bundle SHA-256: `e3e10c2e9acf6418ca6184ed4260b0d9e6985d2f63d4266ae6be51d07d362413`
- qualification result canonical SHA-256: `7bb513ee810e2daa996e2dcaa0ecfb70d5ec8eb79bf7024ecb410f0d303b3c2a`
- reviewer packet canonical SHA-256: `be2350ad7f2ab4257c18770efee8486c61f1348f649c3ab809c8ca6b39c7925b`
- private manifest canonical SHA-256: `0b70cdb62a993a734c4d2785301342433158f1edc53ef01f5c70e4300fcef257`
- labels canonical SHA-256: `d1e3170a5a070e45a5e26c9daaf4630cac29c7ee7bb75ba9969fb1173594dc33`

## 验证结果

- R6 定向 Harness 测试：13/13 PASS
- `npm run lint`: PASS
- `npm run test`: PASS
  - Vitest: 213/213
  - protocol/dataset Node tests: 103/103
  - server tests: 8/8
  - Worker tests: 82/82
  - Firebase Functions tests: 5/5
- `npm run build`: PASS
- `npm run security:scan`: PASS，589 个扫描对象，0 命中
- `git diff --check`: PASS

以上测试没有调用真实 DeepSeek，没有部署 Preview 或 Production，没有读取 expected answers，也没有创建 Selection 或 Blind。

## 当前边界与下一步 Gate

本轮只证明新的数据隔离与完整生命周期在合成数据上可运行；它不证明真实 Preview 路由、Cloudflare Secret、远端 ledger 或真实模型输出已通过 R6 协议。

在未来任何真实 Readiness 之前，仍必须：

1. 对当前资格 bundle 和 `qualification-result.json` 重新计算双重 hash；
2. 将相同公开/私有分层接入全新 R6 runner 和 Preview-only Worker；
3. 用不调用模型的 Worker 集成测试跑通 packet → labels → reveal → score → gate；
4. 冻结全新 protocol/run label/observation IDs；
5. 获得用户对模型调用次数和 Preview 部署的单独授权。

在这些条件满足前，机器状态保持：

```text
E2 BLOCKED
MODEL QUALITY NOT AVAILABLE
READINESS NOT AUTHORIZED
SELECTION NOT AUTHORIZED
BLIND NOT CREATED
PRODUCTION NOT READY
```
