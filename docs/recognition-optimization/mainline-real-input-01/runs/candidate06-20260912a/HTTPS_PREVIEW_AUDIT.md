# 独立 HTTPS 匿名回放实验版

2026-09-13。起点 `672547416fa81f528c05b4def8bf3821f6401094`，当前实验分支；按用户批准的 GITHUB_SNAPSHOT 六文件范围交付。没有替换生产站点或旧本机库。

## 已发布

- 固定地址：https://student-affairs-real-input-preview.nightsdell.workers.dev
- 独立 Worker：student-affairs-real-input-preview。
- 在线版本：a25293d5-debc-46dc-8450-60b8684be749。
- 地址由 Cloudflare 托管，不依赖本机 6631 服务或 Codex 持续运行；不是临时隧道。持续可用以该 Worker 和 Cloudflare 账户继续保留为前提。
- 无生产路由、Secret、远端数据库或模型绑定，仅 ASSETS。全部写入请求 405；除两份匿名回答与页面资源外的路径 404。
- 首次打开明确点击“创建本域名实验库并进入”，才初始化该 HTTPS origin 的新库。已有库只读打开，坏库/升级失败不回退。不会迁移 localhost 的旧任务。
- 展开“真实输入工程工具”载入 Q01-06 或 Q07-06，再刷新，从收件箱核对材料、事实并主动确认。结果只保存在本域名当前浏览器；换浏览器或设备不会自动同步。
- 两份均为人工合成通知的历史真实模型回答，不是本轮预测。candidate06仍不采用。新录入/模型发送关闭，请勿输入真实学生资料。

## 实施与检查

只改三现有文件 browser/runtime/acceptance，新增独立 build/Worker/Wrangler 三文件。旧接口与默认入口、候选、原回答、评分、账本、生产配置未改。新库身份与历史回答身份分开绑定，原 raw/context/request/candidate 摘要校验保留。

构建不启动 Vite，不读取根环境文件；esbuild 显式空 import.meta.env，临时输出。发布只含 HTML/JS/CSS/Q01/Q07 五个文件。静态包无 Expected、账本、密钥、本机路径；外部字体导入仅在构建产物去除。Worker CSP 关闭外部连接与嵌入。

- 首次 acceptance：54通过/1失败。失败是旧 wrapper 测试抽取源码后未注入新增 preview 上下文，不是业务放行失败。补齐模拟上下文并增加创建/恢复反例，未删除旧断言。
- 最终受影响层：5通过/0失败/50未运行。含两份实际历史回答的新库核对、共3任务逐项确认、重复不增、原答/first不变、独立内存仓储读回、旧默认拒绝、新库身份拒绝、固定 Worker 只读路由。不得把两次数字累计为更多样本。
- 最终 TypeScript、变更文件 lint、esbuild、契约/时间生成一致性、Secret scan1711通过。lint保留1条 Fast Refresh警告。13份原工程日志逐字一致，未变化链路复用，不重称完整1310项本次重跑。
- Cloudflare dry-run通过。首次真实发布因兼容日期2026-09-13超出服务端UTC日期被拒；改为2026-09-12后发布成功，静态文件内容未变。
- 线上首页200；五个产物5/5 SHA一致；状态明确 modelCallsEnabled=false。POST识别405，GET模型接口/未批准Q03/.env均404。未发模型请求。

## 未完成和风险，不能记为全部通过

官方浏览器唯一恢复尝试 `cua.getState` 返回 `nodeRepl.fetch request failed`，apps/browsers为空。没有循环刷新、切换底层控制或绕过安全限制。打开Codex浏览器面板请求仅返回queued，不算页面操作。

因此新 HTTPS 页面中的真实 IndexedDB 创建、Q01/Q07逐键核对/确认、刷新界面、独立真实读库与实际下载仍 **NOT_RUN**。内存/SSR/EventTarget及HTTP验证不能替代这些验收。当前可访问实验站发布完成，完整用户旅程未获独立浏览器证据。

生产依赖审计0漏洞；完整审计新增暴露开发工具链2 moderate、3 high：@vitest/mocker/Vitest与sharp/miniflare/Wrangler传递关联。它们未作为运行依赖发布到此静态Worker，但完整audit退出1，不能表述完整工程门通过。六文件授权不含依赖升级，未执行audit fix或升级。后续若修复需单独批准最小开发依赖范围。

## 保护、交付及下一步

944保护、607静态证据、18冻结依赖及52未改源码SHA一致。账本215行163134字节完整SHA不变；0新增模型调用、0模型费用。不读密钥/剪贴板，不访问旧本机库/真实库；生产Worker和路由未操作。日志仅追加，旧328477字节前缀保留。

六文件与本报告/检查/短交接/追加日志按明确清单Git交付，定位为“已发布、浏览器待验收的实验版”，不是候选晋级或商业上线。精确提交与推送回执追加在 HTTPS_PREVIEW_CHECKS.json；不改旧失败结果。

唯一产品收尾：在此固定HTTPS地址完成Q01/Q07核对、主动确认、刷新、独立读库及实际下载，替代不稳定的本机服务依赖；无需重调模型或重做候选。开发工具依赖修复单列，不暗改本轮白名单。

复现构建：`node scripts/build-real-input-preview.mjs`。部署只能使用它返回的临时configuration路径，设置 `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false`、`WRANGLER_SEND_METRICS=false` 并从临时目录执行本机已有Wrangler；禁止使用绑定生产站点的默认wrangler配置。
