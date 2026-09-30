# 学生事务管家云端开发启动

1. 先检查 git status --short --branch、AGENTS.md、PRD 相关章节和 docs/recognition-optimization/CURRENT_CONTEXT.md。目标分支 codex/e2-candidate11-blind-eval，不能将本机历史锚点当作回滚命令。
2. 执行 node scripts/codex-cloud-checks.mjs preflight。依赖未准备时使用 bash .codex/cloud/install.sh；依赖或锁变化后重新安装，不能复用不匹配缓存。
3. 执行 node scripts/codex-cloud-checks.mjs portable，查 .data/codex-cloud/portable-checks.json 和各组日志。此为明确范围的代码检查，不是全量历史/模型/真人验收。无私有资料时仍可开发和运行匿名代码回归。
4. 需要页面时，运行 node node_modules/vite/bin/vite.js --config scripts/codex-cloud.vite.config.mts。绑定127.0.0.1:4173，状态用 curl --fail http://127.0.0.1:4173/ 检查；/api/*固定关闭。不要启动生产Node网关、Wrangler、Firebase或业务模型执行器。
5. 可显式运行 node scripts/codex-cloud-checks.mjs full 尝试原全量测试；保留真实非零退出。缺Windows字体/旧录制/账本标ENVIRONMENT_ASSETS_MISSING，不改断言、不抄造raw或账本。云端代码检查不能替代本机D23真实浏览器/正式读回、真人同意或人工裁决。
6. 不配置DeepSeek/Firebase/Cloudflare凭证，不上传.env/.dev.vars/.data/账本/用户库，不调用模型、做真人、合并或部署。按本任务实际授权决定提交/推送；先确认当前分支与用户改动，禁止强推。
