# 当前验证入口

本轮完整结果见[paid-evidence/VALIDATION](paid-evidence/VALIDATION.md)和[机器证据](paid-evidence/VALIDATION.json)。当前产品1045PASS/1skip、34/40组PASS，合法新批追加后1000链；付费现场1确定/1不确定/2停发封存。下方为授权前历史验证记录，1040测试/996链/0模型等只描述当时，原VALIDATION.json和零调用快照不回写。

---

# 验证与保护

定向真实Schema/公共转换/保存读回：新8+旧渠道42=50 PASS；单臂请求图/身份/授权阻断/分层分母/未知与关键错误4 Node PASS。重复来源裁决保护后来补入，4 Node再跑通过。没有调用模型或创建grant。完整机器输出VALIDATION.json。

| 检查 | 本轮结果 |
|---|---|
| lint | PASS，0错误8既有警告；没有新警告。 |
| build | tsc和Vite PASS；原bundle大小警告保留。 |
| security | scan PASS，0新Secret；未读取.env明文，原联系人仅在忽略.data。 |
| full test | 40独立组确定退出；34PASS/6旧历史FAIL。当前产品1040PASS/1skip，server/worker/worker-d26/functions与carrier全部执行通过。 |
| audit | 5high/2moderate，omit-dev全部0；本包不升级或改锁。 |
| isolation | 全新回环6836/newDB；模型GET/POST和同步403；旧6835/用户库未操作。 |
| history | 84保护119冻结7归档通过；996完整链SHA本轮前后相同，历史156合法追加已有记录。 |

六旧失败：d19-diagnostic和vitest-d17-history仍D17_SCORE_LEDGER_DRIFT；d9-historical旧serve-candidate15-d8冻结哈希；rco-5-007旧package-lock原字节/CRLF；c11-history/c11-gateway旧AGENTS冻结哈希。现行只读历史校验、原Git字节及旧录制身份保持，不修改旧Manifest、锁或断言让全量假绿。

audit可达性：brace-expansion/sharp/undici/miniflare/wrangler五个high都在开发工具依赖，Vitest/@vitest/mocker为moderate；生产依赖0不表示开发预览服务无风险。对不可信本地图片/输入和本地开发代理仍应谨慎使用。本包仅匿名夹具、回环受限路由，未扩大暴露。兼容维护建议另开受授权维护边界，先评估当前锁允许的传递依赖修补及Wrangler/Miniflare配套升级，Vitest5为重大版本不得盲升级；保留旧冻结lock，对新维护锁运行worker/preview/carrier回归。本包未新增依赖。

浏览器数据不是模型语义评分；4来源新模型NOT_RUN。四真人指标NOT_OBSERVABLE。原v11与后验参照原样，全部12首屏/后验诊断相同见OLD_12_DIAGNOSTIC。

冻结核验：prepare --write/--verify、现成host --verify/--resume-read-only均确定exit0。4身份NOT_RUN、162组件/6产物、无AUTH/state/raw/锁、本批0grant/reserve/settle，996链SHA不变；模型/首次展示/人工最终均4份未判定保留分母。原有浏览器445源文件与代码提交d223698规范化Git原字节逐份相等、静态产物SHA相等见PROTECTION_AND_BUILD_PROOF；没有用起点HEAD冒称最终构建。

Git提交后立即推送及只读远端核验的原始网络失败见GIT_SYNC。DNS成功、github.com443 TCP失败，不能把Everything up-to-date尾句当exit0；保留本地提交并再次普通推送，最终SHA状态以实际输出为准。
