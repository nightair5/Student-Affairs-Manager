# Codex 云端开发环境配置回执

2026-09-30。用户已明确选择“让Codex在云端拉取GitHub仓库、开发和测试”。本次交付仓库安装/启动/离线检查配置；**账户端环境尚未创建/发布，Linux云端安装和运行尚未验证**。不能将本机检查通过称为云端开通。

## 已配置到仓库

| 配置项 | 值 |
|---|---|
| 建议环境名称 | student-affairs-candidate11-dev |
| GitHub仓库 | nightair5/Student-Affairs-Manager |
| 工作分支 | codex/e2-candidate11-blind-eval；不要选旧main或回滚锚点 |
| 主开发运行时 | Node.js 24；现有functions声明Node20部署运行时不改 |
| Install script | bash .codex/cloud/install.sh；根目录与functions分别npm ci，既有锁保持原样 |
| Start skill | .codex/cloud/start.md |
| 默认检查 | node scripts/codex-cloud-checks.mjs portable |
| 明确尝试原全量 | node scripts/codex-cloud-checks.mjs full；不吞掉退出码 |
| 页面开发 | node node_modules/vite/bin/vite.js --config scripts/codex-cloud.vite.config.mts |
| 网络 | Package managers；不增加业务模型/生产服务域名 |
| Environment variables / Network secrets | 空；不上传本机凭证、账本、用户库或真人材料 |
| 环境访问 | Only me；只使用已授权的本项目仓库 |

根目录.env或.dev.vars真实文件出现时预检拒绝，文件内容不读取。子进程只继承工具需要的环境白名单，不传业务模型、部署或grant变量。独立开发配置envDir=false、无生产代理，/api/*固定403及configured=false。本次不修改默认候选、Workspace v8、应用依赖或锁；不触发CI/生产部署。

## 当前可验证结果

本机Node24.18.0/win32：新配置保护测试3/3通过；安装脚本bash -n通过；portable 14组全部0退出。产品核心Vitest 24文件/304测试通过；包含正式domain/语义确认、ReviewSession过期清理冲突和测量等匿名回归，并另执行server/worker/functions、生成契约、治理内存夹具、时间时区、评分及预览隔离。lint、build、安全扫描通过。具体组与范围见 [配置证据](CODEX_CLOUD_VALIDATION.json)。开发HTTP首页200，/api/status与/api/deepseek/extract均403、modelCallsEnabled=false；只验证本机测试服务器，随后已关闭。

这不是全量PASS。现行npm run test保留，不改发现规则、旧断言或失败套件。它依赖C:/Windows/Fonts/simhei.ttf、被Git忽略的D15/D17录制和外部Windows权威账本；全新Linux拉取不能假设具备。portable显式只覆盖可移植代码范围，不包含旧录制回放、账本实库、D23录制绑定完整测试或实际浏览器验收。D23原全量15组11过/4历史失败原样记录。云端仍须实际安装/运行检查，Linux依赖/原生包问题有失败就修当前工程配置并保留证据，不捏造云端PASS。

## 账户端唯一剩余动作

按照 [官方Cloud环境设置](https://learn.chatgpt.com/docs/environments/cloud-environments)：在已登录ChatGPT/Codex的界面，Settings → Codex Cloud → Environments → Create environment；也可Work in → Cloud → Select environment → Create environment。选择本项目已有仓库，Get started后粘贴 [.codex/cloud/SETUP_REQUEST.md](../../.codex/cloud/SETUP_REQUEST.md) 全文。若需要新增GitHub权限或出现安全/登录提示，由用户在正式页面处理，不扩权到其他仓库。

核实际分支/HEAD、安装与各组退出，保存设置；仅在看到 **Environment published** 后才确认账户环境已完成。环境Publish只发布Codex开发环境，不部署应用。本次不创建新的云端业务任务。正式产品浏览器验收继续本机执行；官方当前云端说明的browser/computer-use限制不得用单元测试冒充已验收。

## 实际阻碍及恢复

通过官方cua_repl打开https://chatgpt.com/codex后，只取得公开Codex介绍页的URL/title；无法读取账户设置。createBrowserTab/getTab两次30秒超时并重置；官方API重新绑定、读取DOM报 `Timed out running CDP command "Emulation.setFocusEmulationEnabled" for tab 1`；文档规定的截图替代路径再次超时。官方浏览器故障文档已读取，工具进程/运行时路径存在，未证明服务或账号已登录。故障发生在浏览器控制通道，不能据此断言用户账号不具备Cloud权限。

最短恢复是重启Codex Desktop后打开已登录的ChatGPT设置再继续，或由用户直接按上面入口粘贴已完成的配置请求。没有用SendKeys、盲目坐标、隐藏接口或抓取凭证绕过。原始错误写入配置证据；账户实际创建NOT_RUN、环境published NOT_OBSERVED。

## 与产品主线的关系

D23已在代码提交f7b635cccb391204b178a09113f654e5e7fbe2f6、结果提交daf0b4b3705c128be9ed4a9dc11bbbd56a99e119交付并推送。下一产品动作仍是获得真实负责人、4人16条本机固定录制探索范围及本人同意；真人0、四指标NOT_OBSERVABLE。配置Codex Cloud不能代替这些材料，也不产生业务模型/grant/真人/发布授权。
