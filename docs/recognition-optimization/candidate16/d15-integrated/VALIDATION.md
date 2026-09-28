# D15 验证记录

2026-09-28；代码交付提交 `98c685adec37d9e5a7656a6eb9355a490c72dd82` 已在首次付费发送前推送。评分脚本 `node scripts/score-candidate16-d15.mjs --verify` 会重算全部 24 份 raw 的哈希、身份、账本链及冻结 v7 结果，并将结果逐字对比本包 `SCORING_RESULTS.json`；其验证为 PASS。D13 请求/参照验证在付费调用前通过。调用后旧 `prepare-candidate16-d13.mjs --verify` 会动态重建含**当前账本快照**的 Manifest，因本批合法追加 49 行而报 `D13_PACKAGE_DRIFT_MANIFEST.json`；旧文件并未变动，Git 历史 diff 为零，原 Manifest/身份 SHA 分别仍是 `b60a6ee22ab1e8f53088ba34d7a2151bbce3f7c700aafa596097701456a5c167` 和 `0a50d55fb8818cacf01319503df7d127fd1020adc1efcb726eb049ae59a5cbda`。不改旧 Manifest 或旧断言来消除这项预期漂移。

| 检查 | 结局 |
|---|---|
| D15 产品定向与既有相关定向 | 33/33 PASS（任务+两个事件、精确/模糊时间、canonical 独立读回、手动/试次/纠正链） |
| D14 执行器/隔离离线故障注入 | 13/13 PASS；本轮真实派发由同一已提交执行器完成 |
| `npm run lint` | PASS，0 error、8 个已有 warning |
| `npm run build` | PASS，原有大块提示 |
| `npm run security:scan` | PASS，最终扫描 3108 个源/构建文件 |
| 实际浏览器和独立数据库读回 | D15 新混合、多事件、失败恢复、多身份场景已验，详见浏览器证据 |
| `node scripts/verify-recognition-history.mjs --verify` | 84 保护、119 冻结通过；合法账本追加 49 行，状态 `HISTORY_PRESERVED_LEDGER_APPEND_REVIEW_REQUIRED`，不是哈希链破坏 |
| 旧 D13 动态 Manifest 重建 | 当前 FAIL：`D13_PACKAGE_DRIFT_MANIFEST.json`；原因是 Manifest 内嵌旧账本快照，新账本合法追加。原文件哈希及 Git 原字节保护 PASS |

全量 `npm run test` **FAIL**：1507 passed、3 failed、1 skipped（1511 个测试），旧 carrier 环境 `REAL_INPUT_CARRIERS_MANIFEST` 未设置及 `realpathSync(undefined)`、U01-09/A02 5 秒超时、旧 D9 Node 测试收集问题分别记录；没有把全量测试写成 PASS。`npm audit --audit-level=high` **FAIL**：现有依赖链共 5 个漏洞（2 moderate、3 high），涉及 `@vitest/mocker`、`sharp`、`miniflare`/`wrangler`；本轮未升级依赖或改冻结 lock 文件。历史 RCO-5-007 package-lock 哈希失败保留旧记录，本轮没有改旧锁或断言。

新增产品定向、安全执行器及真实评分链均通过；全量测试与依赖审计问题仍须独立处理，不能把它们混同为 Candidate16 已可上线。四项真人指标没有真实数据。
