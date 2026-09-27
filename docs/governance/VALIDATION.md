# 治理升级验证

日期：2026-09-27。父提交：a6d545335542c7dc385f6b078bc62224299de988。工作分支：codex/e2-candidate11-blind-eval。

## 本轮适用范围

改动为 PRD/AGENTS、补充服务边界、历史存档、交接和计划入口，以及两份只读校验/测试脚本与针对性 Git 换行属性。没有修改产品运行时代码、候选、Schema、评分器、旧 Expected/raw/result、冻结门槛或依赖。

按新 AGENTS 的“纯文档 + 独立校验工具”级别验证；不触发无关的全产品 npm run test/build、付费调用或浏览器验收。本轮没有宣称全量测试通过或用户识别正确率已提升。

## 实际结果

| 检查 | 结果 | 说明 |
|---|---|---|
| node --test scripts/governance-protection.node-test.mjs | PASS，12/12 | 包含逐一篡改其他 82 文件和全部 14 个 D7 组件的虚拟读取反例；没有改真实证据 |
| node scripts/verify-governance-protection.mjs | PASS_GOVERNANCE_PROTECTION_ONLY | 82 原位 + 2 旧字节存档 + 2 新活动根文档；不能授权派发 |
| npm run lint | PASS，0 error / 7 warning | 既有 react-refresh/ref 警告；新脚本无 lint 错误 |
| npm run security:scan | PASS | 未发现 Secret |
| git diff --cached --check | PASS | 存档显式识别原 CRLF；保留行尾空格等检查，活动文件无空白错误 |
| 新活动文档链接/路径 | PASS | 检查本轮根文档与治理说明；旧字节存档链接按原仓库根解释，不改写 |
| Git 索引字节与文件哈希 | PASS | 新根文档固定 LF；旧字节存档 -text，防止 Windows 自动换行破坏历史哈希；仅存档使用 cr-at-eol 识别原换行 |

## 明确保留的旧失败

- 原 verifyProtectedFiles 及 node scripts/freeze-candidate14-d7.mjs --verify 实际返回 C11_HISTORY_PROTECTED_CHANGED:AGENTS.md。另逐项对照确认原位不同仅 AGENTS.md/PRD.md。这是用户授权的文档换版，原断言未改，也未报告原检查 PASS。
- 新工具另行校验旧 84 文件全部历史字节仍可复现和 D7 14 组件仍匹配冻结值；它不是旧执行器的放行补丁。
- D7 仍为 D7_BLOCKED_ON_REFERENCE_CONTRACT；R4/R5 请求身份不恢复；D6 拒绝结论不改。
- REAL_INPUT_CARRIERS_MANIFEST、RCO-5-007/旧 package-lock 和此前浏览器不可用记录保留。本轮未重跑全产品历史测试，不能把这些记为已修复。

## 只读权威账本

- 行数：791；字节：694807。
- SHA-256：efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a。
- 本轮业务模型调用、grant/reserve/settle、Secret 明文读取、账本写入、真人试用、合并、部署均为 0。
- 原保护清单、原锁文件与 D7 Manifest 原样保留，新保护版本为 governance-protection-1。

## 交付定位

本包只交付治理规则和核验方式；W1 契约修复、W2 确认/测量代码工作尚未执行。根 AGENTS/PRD 为活动入口，D7 目录旧提示词顶部标为历史，当前提示词在本目录 NEXT_STAGE_EXECUTION_PROMPT.md。

提交与推送采用单一治理交付边界。最终提交 SHA 从包含本文件的 Git 提交读取（git log -1 --format=%H -- docs/governance/VALIDATION.md）；本地/upstream/远端实际核验在本次交付消息中报告，避免在文件中自引用本提交 SHA。
