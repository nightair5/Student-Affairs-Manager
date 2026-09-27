# 全局复查交付验证

日期：2026-09-27。起点 HEAD/upstream/远端均为 `930b88198690b35d246bbdfd4370258cd2906c1c`，起点工作区干净。Node 本机版本 v24.18.0；CI 配置使用 Node 22。

## 适用范围

本次为活动文档修正、只读诊断与独立测试工具/CI job。未修改产品运行时、旧冻结 Prompt/Schema/scorer/measurement、默认候选、依赖或任何旧结果。按现行 AGENTS 的文档与独立工具级别验证；不要求本轮重跑全应用构建、模型评测或页面验收。

## 检查结果

| 检查 | 结果 | 含义与限制 |
|---|---|---|
| governance-protection.node-test | PASS，12/12 | 纯内存 84 文件、14 组件与账本，覆盖活动/存档/冻结/账本损坏及非法豁免 |
| 在系统临时目录调用上述单测的绝对路径 | PASS，12/12 | 不依赖仓库 cwd、私有账本或网络；本机 Windows 验证，不冒称已在 Linux 运行 |
| 真实 verify-governance-protection CLI | PASS_GOVERNANCE_PROTECTION_ONLY | 82 份原位历史 + 2 份原字节存档 + 2 活动文档；14 个 D7 组件未变 |
| measurement 只读诊断 | 三项反例复现 | 保存全部合成输入、输出和模块 SHA；这是已知口径失败证据，不是产品修复 PASS |
| 诊断脚本 node --check | PASS | 没有真实库/模型/真人操作 |
| npm run lint | PASS，0 error / 7 既有 warning | 原 react-refresh 与 ref 警告保留 |
| npm run security:scan | PASS | 未发现 Secret |
| CI 原 verify 与触发/权限比较 | PASS | 仅新增 governance-unit；未改变原发布验证或执行触发 |
| CI YAML、本轮文档链接、JSON、diff | PASS | PyYAML 解析；102 个本地链接全部存在；2 个新 JSON 可解析；diff 无空白错误 |

CI YAML 验证优先探测 Node YAML 包时发现 yaml/js-yaml 未安装，未新增依赖；改用本机已有 Python PyYAML。GitHub CLI 未安装，不能据此宣称远端 CI 已通过；远端运行状态若可读取则在交付说明单列。提交和推送记录以实际 Git 为准。

## 历史状态与边界

- 旧 84 文件原位检查仍因上轮授权的 AGENTS/PRD 换版而漂移；新保护检查不修改旧断言、不替旧执行器放行。
- D7 仍 `D7_BLOCKED_ON_REFERENCE_CONTRACT`，R4/R5 身份仍失效，D6 拒绝决定不变。
- 历史 REAL_INPUT_CARRIERS_MANIFEST 裸测试、RCO-5-007/package-lock 冻结哈希问题保留；本轮未重跑全产品 test/build，也未声称全量 PASS。
- 本轮没有浏览器产品验收；已有浏览器不可用记录仍是旧轮次证据，不能据此推断今天已修或仍不可用。
- 本轮业务模型调用、grant/reserve/settle、Secret 明文读取、账本写入、真人试次、旧库操作、合并和部署均为 0。外部网络仅用于公开研究与 Git 同步/状态。

## 账本只读核验

791 行，694807 字节；SHA-256：`efb46f116db9c550ba53624c5d710164c6143ba9cc30c57ab2b7515c059f4d6a`。PRD/AGENTS、D7 组件和原保护清单哈希保持上轮版本；不创建新的调用许可。

本轮完整交付采用一个 Conventional Commit，提交后立即推送当前分支并核验远端。提交 SHA 可从 `git log -1 --format=%H -- docs/governance/review-20260927-r2/VALIDATION.md` 读取，避免文档自引用提交哈希。最终远端核验在交付消息中给出。
