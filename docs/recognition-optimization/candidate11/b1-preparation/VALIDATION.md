# Candidate11 B1 验证记录

验证日期：2026-09-21。状态：`B1_PREPARED_FOR_REVIEW`，模型调用、网络派发、Secret 读取、grant、reserve、receipt、合并与部署均为 0。

## 准备包与定向验证

- `node scripts/prepare-candidate11-b1.mjs --verify`：通过。确认 6 份完整工程参照、24 个唯一请求身份、84 份保护文件、权威账本与工作树快照逐字节一致；`modelCalls=0`、`writerOpened=false`。
- `node --test scripts/candidate11-b1.node-test.mjs scripts/candidate11-scoring.node-test.mjs scripts/candidate11-gateway.node-test.mjs`：58/58 通过。覆盖重复生成、身份/上下文漂移、无授权派发、重复执行、并发 writer、一次失败不重试及评分边界。
- `npx vitest run src/experiments/realInput01/candidate11.test.ts src/experiments/candidate11/identity.test.ts`：13/13 通过。
- `node scripts/verify-candidate11-analysis.mjs --verify`：只读复核通过；历史 A/B 仍分别为 9/12、11/12，部分参照不被提升为完整准确率。

## 项目门槛

- `node scripts/candidate11-checks.mjs lint`：通过，0 errors；保留 5 条既有 warning。
- `node scripts/candidate11-checks.mjs build`：TypeScript 与 Vite build 通过，1693 个模块完成转换；保留既有大 chunk warning。
- `node scripts/candidate11-checks.mjs security`：通过，扫描 2467 个 source/build 文件。
- `node scripts/candidate11-checks.mjs test`：隔离环境中完成全部测试组；全量 Vitest 1422/1422 通过、1 跳过，contract、time-contract、server、worker、time-parity、multimodal-lib、Functions、candidate11 scoring/history/gateway/preview 均通过。
- 同一完整测试仅保留预先存在的 RCO-5-007 失败：4 项中 3 通过、1 失败，错误为 `FREEZE_HASH_MISMATCH:package-lock.json`。未修改旧锁文件、旧冻结哈希或发布门槛。

直接运行 `npm run test` 时，既有 candidate02 launcher 测试因缺少临时 `REAL_INPUT_CARRIERS_MANIFEST` 在全量 Vitest 阶段提前失败；指定的 candidate11 隔离测试器会先生成只读临时 carrier 清单并继续全部测试组。本次未以改动旧测试或放宽断言来掩盖该差异。

本文件记录冻结完成后的验证结果，不参与 `MANIFEST.json` 中模型请求输入与组件哈希；冻结 manifest 仍由 `prepare-candidate11-b1.mjs --verify` 独立校验。
