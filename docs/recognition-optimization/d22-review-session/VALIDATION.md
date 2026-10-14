# D22 验证与历史失败

2026-09-30。以下均为实际执行退出结果；代码未排除失败套件、全局调大 timeout、修改旧 lock/Expected/断言，未读取根环境 Secret。

| 检查 | 实际结果 |
|---|---|
| D22 定向恢复/测量 | 10/10 PASS；检查点失败重试、只读表单无编辑、活动恢复不重复 editId、关系正确匹配、材料观察成本、持久选择、提交隔离、原子失败、读回恢复和真实 SourceVersion |
| lint | exit0；0 error / 8 个原有 warning；本轮事件恢复 effect 警告已消除 |
| build | exit0；1693 模块。主 bundle 约558KB，仍有原500KB chunk warning，未改阈值 |
| 权威 npm run test | exit1；15组全部结束，11组PASS、4组历史冻结失败；不能称全量PASS |
| Vitest | 155文件PASS、1文件skip；1540 tests PASS、1 skip；本轮运行未发生 carrier 环境缺失或5秒超时 |
| server / worker / functions | 三组均 exit0；与 contract、time-contract、time-parity、multimodal-lib、C11 scorer/preview、D19诊断一起全部跑完 |
| security:scan | exit0；没有新增Secret暴露 |
| 历史只读保护 | 84保护、119冻结、7归档保持；旧决定不改；权威账本完整链通过 |
| D19 offline --verify | exit0；保留D17原1/12、2/12，unresolved A1/B3，D15 raw24及原配对诊断 |
| 浏览器/独立读回/隔离 | A—L逐项见 BROWSER_EVIDENCE 与 EVIDENCE_INDEX；全部为匿名 ENGINEERING_REPLAY |
| 离线入口隔离 | 5/5 PASS：本机页面可读；模型 POST/GET、外部 Host、非白名单路径均阻断；不发送上游请求 |
| 证据原字节核对 | 102 份组件、读回、截图、测试日志、构建资产与账本 SHA 一致；20 份报告、8 张截图；阅读≥10秒编辑0、末次时间分项合计及15组退出状态核对通过 |

四组历史失败的实际错误：

- `d9-historical`：`D9_GUARD_FILE_DRIFT_scripts/serve-candidate15-d8.mjs`。
- `rco-5-007`：`FREEZE_HASH_MISMATCH:package-lock.json`。
- `c11-history`：`C11_HISTORY_PROTECTED_CHANGED:AGENTS.md`。
- `c11-gateway`：同一旧 `C11_HISTORY_PROTECTED_CHANGED:AGENTS.md` 断言导致故障测试提前退出。

这些是历史冻结断言对当前工程组件的已知复现，不把当前规则文件或锁回滚成旧版本，不修改断言使它通过。现行历史校验核 Git 保存的原字节和权威账本链，新 D22 危险故障分支另有定向与浏览器证据；历史 C11 gateway 失败不伪称安全PASS。

权威原日志归档在 `.data/d22/checks/final`，组退出与日志 SHA 进入 EVIDENCE_INDEX。最后代码变化后重新运行 lint/test/build；后续若仅文档更新，检查 diff/security/history，不无理由再重复全量测试。

前后账本均938行，SHA `e79aec8bbb1378e37f3941d8ffac9cce7d74bbb8e11d7ceee5c90a88b6c734b9`。现行校验的 APPEND_REVIEW_REQUIRED 是相对于更早840行快照的98行已知合法批次追加，本轮新增0。业务模型0、grant/reserve/settle0、新候选/身份0、真人0、部署0；没有读取或操作旧用户库。

工作区起点 `3f7fbcdeebc485086d27fe962c11db2d71f09ef4`。第一代码边界 `c6829233d6941d8175a9c28133371354ed70c765`，父子冲突同步边界 `30dff7e9ca2f3c0f6ccad8397df607cb73ebd393`，最终事件状态修复 `6fc2ff8c6e4f`，均验证后立即普通推送。最后两处修复后均重跑 lint/test/build，最后 Vitest duration137.43s。结果交付 SHA、远端和工作区检查按末次真实回执记录，不预造自引用提交哈希。
