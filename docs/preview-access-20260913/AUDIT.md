# 独立预览站点访问修复与同步

日期：2026-09-13。用户报告原 workers.dev 地址连接超时，并明确同意新增 `preview.student-affairs.site`，保留原网址。基线为已提交的 `de017e5bfb759263ec24270ae85d624ffcb88471`，未包含另一工作目录正在进行的 candidate08 修改。

## 原因与部署结果

- 原服务器首页和脚本通过现有代理返回 HTTP 200。系统 DNS 返回的地址与 Cloudflare DNS-over-HTTPS 查询不一致；关闭代理访问超时，即便使用查询所得地址也出现连接重置。证据支持当前网络对 workers.dev 的解析/直连受阻，不能将其描述为 Worker 停机或代码崩溃。
- 同一独立 Worker 新增 `preview.student-affairs.site` Custom Domain；原 workers.dev 入口保留。新域名在当前机器关闭代理后首页、全部 8 项资源均成功取得，与部署构建 SHA-256 一致。
- 部署版本：`a8cb6480-5abc-4a9c-8987-15299dfb31c8`。两个网址共 16 项资源比对一致，记录于 ONLINE.json。
- 只允许两个固定 HTTPS origin；不接受任意域名，也不允许生产首页进入实验配置。新增加载中、加载失败与 JavaScript 未启用提示，避免资源未到达时完全空白。经原有保密审查后压缩脚本，主脚本由 2,708,468 字节降为约 1,604,516 字节。
- 生产 Worker、生产首页路由、RC.4、Secret、识别模型、历史原答、Expected、账本和用户数据未修改。所有模型请求继续关闭，线上 POST 返回 405。

## 数据边界

两个域名分别使用当前浏览器自己的 IndexedDB；不会自动互通、迁移、清空或覆盖。新域名首次使用由用户主动点击创建实验库。旧网址的数据仍留在原浏览器/原域名；本次“同步”指代码与部署，不是跨域数据同步。

## 验证与限制

- `node --test scripts/real-input-preview-access.node-test.mjs`：2/2 通过，覆盖双域名限制、生产/外域拒绝、启动资源、模型和私有路径关闭。
- `npm run lint`：0 错误，4 条已有警告。
- `npm run build`、专用预览构建、专用 Wrangler dry-run、Secret scan：通过。
- `npm run test` 首先遇到生成契约 SHA 校验失败；新工作目录的换行符与原工作目录不一致。仅在忽略 CR 后内容完全相等时恢复原工作目录字节，两个 `recognition:contract:check` 校验随后通过，没有修改契约或生成语义。
- 独立执行 acceptance.test.tsx：63 通过、3 失败。失败分别为本机 6632 已有用户服务占用、旧 candidate02 launcher 缺少 carrier 配置、测试工作目录缺少本地 OCR traineddata。保留失败，没有停止用户服务、改旧断言或冒充全量通过。初始默认多进程测试与一次冗余重跑被停止。仓库全量门未完成。
- `npm audit --audit-level=high`：已有开发依赖 2 moderate、3 high，本次未升级依赖，不宣称全面安全门通过。
- 官方浏览器控制连接连续超时/请求失败，未取得渲染及交互验收；HTTP、资源哈希和专门测试不能替代真实浏览器确认保存验收。访问修复已有线上直连证据，完整工程及浏览器验收仍有上述限制。

## 后续部署

从包含本修复的实验分支运行 `node scripts/build-real-input-preview.mjs`，使用返回的临时 configuration 路径部署。设置 `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false` 和 `WRANGLER_SEND_METRICS=false`，从临时目录运行本机已有 Wrangler。禁止用绑定生产站点的默认配置替代。该构建会保留原入口和本次新增的独立域名。
