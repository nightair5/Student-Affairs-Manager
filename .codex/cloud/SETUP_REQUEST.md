# 复制到 Codex Cloud 环境配置对话

请配置学生事务管家的云端代码开发环境，选择已有GitHub仓库nightair5/Student-Affairs-Manager，目标分支codex/e2-candidate11-blind-eval。只配置此仓库，访问范围保持Only me；不分享给团队，不安装或扩大其他仓库权限。

先核当前分支和工作区。若初始检出main，在新环境且工作区干净时通过正常fetch/switch进入上述已存在分支；有未保存配置或源码改动时先保留并说明，不reset/clean/force。不要把本机Windows路径当云端路径。

准备Node.js 24。Install script使用仓库 .codex/cloud/install.sh；执行bash .codex/cloud/install.sh，严格npm ci安装两个既有锁，不改package/lock、不新增业务依赖。functions/package.json的Node20是Firebase部署运行时声明；当前Node24开发安装如有engine warning如实记录，不能顺便改生产运行时。

Start skill使用.codex/cloud/start.md。配置后运行node scripts/codex-cloud-checks.mjs portable，核各组退出和.data/codex-cloud/portable-checks.json。这是有明确范围的代码检查；原npm run test保留，不能称全量通过。它依赖Windows字体、本机旧raw及账本，缺少时报告ENVIRONMENT_ASSETS_MISSING；不能上传、伪造或删断言。

网络只采用Package managers，不增加api.deepseek.com或生产服务域名。Environment variables和Network secrets为空；不添加DeepSeek/Firebase/Cloudflare密钥、账本、用户数据库、真人材料或授权grant。打开开发页面仅用scripts/codex-cloud.vite.config.mts，127.0.0.1:4173；/api固定关闭。

报告仓库/实际分支/HEAD、Node/npm版本、锁SHA、安装结果、每组检查结果及真实缺项。配置检查后保存并发布私有环境，等待明确Environment published再称完成。这里的Publish仅发布Codex开发环境，绝不发布学生事务管家应用。不启动新的业务开发任务，不调用业务模型、真人、合并、默认切换或部署。
