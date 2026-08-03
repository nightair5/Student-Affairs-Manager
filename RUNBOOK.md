# 学生事务管家运行手册

本手册用于维护 `student-affairs.site`、Cloudflare Worker 和可选本机服务。所有处置先保护用户数据和密钥，再恢复服务；禁止对正式站点做高频、爆破或破坏性测试。

## 日常检查

### 每周

- Cloudflare → Workers & Pages → `student-affairs-manager` → Observability：检查 5XX、超时和 `INVALID_AI_RESPONSE`。
- Cloudflare → Security → Events：检查异常来源、Rate Limiting 命中和挑战结果。
- DeepSeek 控制台：检查请求量、余额、日限额和异常峰值。

### 每两周

```bash
npm ci
npm run lint
npm run test
npm run build
npm audit --audit-level=high
```

### 每月

- 从“项目档案 → 备份与清空”导出 JSON，并在离线副本上验证可以导入。
- 运行 `npm outdated`，只在独立分支升级大版本。
- 清理不再需要的 Preview Worker 和旧部署版本。
- 核对 README、PRD 与隐私页面是否仍符合真实能力。

### 每季度

- 轮换 DeepSeek Key 和其他服务端令牌。
- 在 Preview 环境演练一次 JSON 恢复和 Cloudflare 回滚。
- 审查主要依赖的大版本、许可证和维护状态。

## 发布流程

1. 从已推送基线创建功能分支，不直接修改生产分支。
2. 运行完整验证与密钥扫描。
3. 推送精确提交。
4. 部署隔离的 Preview Worker：

   ```bash
   npx wrangler whoami
   npm run deploy:cloudflare:preview
   ```

5. 在 Wrangler 输出的 `student-affairs-manager-preview.*.workers.dev` 地址完成人工清单。Preview 默认没有生产 Secret；如需测试 AI，需单独执行 `npx wrangler secret put DEEPSEEK_API_KEY --env preview`，不得复制到代码或命令参数。
6. 通过 Pull Request 合并，经 CI 后才运行 `npm run deploy:cloudflare`。
7. 实测首页、SPA 路由、`/api/deepseek/status`、安全响应头和一次真实可确认任务整理。

## 查看日志

控制台路径：Cloudflare → Workers & Pages → `student-affairs-manager` → Observability → Logs/Traces。

实时终端：

```bash
npx wrangler tail student-affairs-manager
```

用 `requestId` 关联前端报错和 Worker 日志。日志允许包含路径、状态、耗时、输入长度、输出 token、错误类型和匿名客户端标识；不得粘贴用户原文、完整 Prompt、Authorization 或 Secret。

## 网站打不开

1. 从另一网络打开 `https://student-affairs.site/`，记录状态码和时间。
2. Cloudflare → Workers & Pages → `student-affairs-manager` → Deployments，确认最近部署是否成功。
3. 检查自定义域名、证书、Zone 状态和 DNS 是否仍为 Active。
4. 检查 Worker 5XX 与静态资源 404；确认 `dist` 已构建、SPA 回退存在。
5. 若最近部署引发故障，立即回滚到上一个正常版本；恢复后再在分支修复。

## Worker 5XX 或 AI 超时

1. 使用报错中的 requestId 查日志，不收集用户原文。
2. 区分 `UPSTREAM_TIMEOUT`、`UPSTREAM_UNAVAILABLE`、`INVALID_AI_RESPONSE` 与配置缺失。
3. 检查 DeepSeek 服务状态、余额、模型权限和消费上限。
4. 临时暂停 AI 时移除或轮换 Secret；本地规则和已保存来源仍应可用。
5. 不把服务可达误报为 AI 已连接；只有状态接口与真实调用都成功才恢复。

## DeepSeek 消费异常

1. 立即暂停 AI 接口或撤销 Key。
2. 检查 Worker Logs、Cloudflare Security Events、频率来源和 DeepSeek 账单。
3. 在 Cloudflare WAF 为 `POST /api/*` 配置每 IP 每分钟 10 次阈值，优先 Managed Challenge，持续 10 分钟；确认不会阻断正常 Preview。
4. 高频匿名调用启用服务端验证的 Turnstile，不只放前端组件。
5. 设置服务商日上限，逐步恢复并观察错误率。

## API Key 泄漏

1. 立即撤销旧 Key。
2. 暂停 AI API。
3. 检查消费、日志和 Git 历史；报告只写是否命中，不展示完整 Key。
4. 创建新 Key，并用交互式命令写入 Cloudflare Secret：

   ```bash
   npx wrangler secret put DEEPSEEK_API_KEY
   ```

5. 重新部署、验证状态与真实请求，最后恢复接口。

## 错误部署与回滚

控制台：Cloudflare → Workers & Pages → `student-affairs-manager` → Deployments → 选择上一个已知正常版本 → Rollback。回滚后：

- 实测首页、静态资源和 API 状态；
- 保留失败提交，不使用强制推送；
- 从失败提交建立修复分支；
- 重新走 Preview、CI 和人工验收。

## 本地数据丢失或版本异常

1. 停止导入、清空和覆盖写入。
2. 不清理浏览器站点数据；先导出还能读取的 JSON。
3. 检查站点域名、浏览器 Profile 和 IndexedDB `student-affairs-steward`。
4. 使用最近备份在 Preview/独立浏览器 Profile 试导入，确认数量和引用完整后再恢复。
5. 如果是 schema 迁移故障，保留原始备份，修复迁移函数并增加回归测试；不得用演示数据覆盖可恢复数据。

## 隐私事故

1. 停止相关日志、接口或部署。
2. 删除不必要的敏感日志和公开文件，撤销可能泄漏的 Key。
3. 确认内容、用户、时间和第三方范围；不要扩大复制。
4. 修复字段最小化、脱敏、访问控制和测试。
5. 按适用政策通知受影响用户，保留不含原文的事故时间线。

## 暂停与恢复 AI

暂停：撤销 DeepSeek Key，或从 Worker 移除 `DEEPSEEK_API_KEY` Secret 后重新部署。页面必须显示未连接并回退本地规则。

恢复：设置新 Secret、部署 Preview、验证 `/api/deepseek/status` 与真实整理，再发布生产。禁止仅根据“部署成功”判断 AI 可用。
