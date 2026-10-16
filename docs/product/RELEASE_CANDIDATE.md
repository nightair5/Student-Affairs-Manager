# 限制访问测试版：发布候选收口

日期：2026-10-17。范围仅为纸质渠道、现有文件/安排阻断、CI、开发工具安全和preview访问保护；默认生成1.5、Workspace v8及正式站点不变。

## 已验证的具体改善

- `SEMANTIC_COMPOSER`：已有纸质渠道被日期时刻范围的连接符误挡。只识别完整的时刻范围，保留原有对象、渠道、起止和依据；不补缺失事实。原R2-RES-12录制在普通页两任务零事实编辑、一次接受并独立读回。
- `SEMANTIC_COMPOSER`：原答已有“完成课程学习/在线作业”，课程开启、计分要求及同任务截止均有引用时，允许这一完成动作的合法表示。不新增任务或时间；否定、条件、缺截止和错对象反例仍被阻断。Markdown文件入口实测显示两任务，事务失败无半份，手动重试及只重读恢复后各来源仅一次提交。
- `DOMAIN_RULE`：原生单日时刻窗口没有sidecar时，安排器原来漏读其边界。现在从已确认的同owner起止、草稿和原文依据复核窗口，范围外保留待办；范围内纸质任务可排在09:30—10:00，原文16:00截止不变，保存、刷新和独立读回一致。
- 301份旧录制走实际Worker离线转换和普通首次组装，294份首次结果逐字段不变、7份目标变化；原答不变、没有旧完整来源退步或新增严重标记。默认92份从60/19/7/6变为60/18/7/7（完整/部分/错/未知）：一份移除程序误挡后仍有原答事件争议，所以转为未知，并非增加正确率。实验PUB-28的两个旧严重标记保留。没有新模型请求。

## CI与工具

本机lint、typecheck、当前产品/安全全组、build、security:scan、cloudflare:check通过；lint保留8个原有警告。历史原断言仍照常运行，原FAIL和缺失状态保存为artifact；CI另用明确的已知测试名、错误签名和起点字节检查，只让未列出的新失败阻断。不使用continue-on-error吞组。

`.gitattributes`固定v1原通知的CRLF检出，保持旧SHA断言和Git blob不动。Vitest 3→4.1.11是修复漏洞所需的最小已验证主版本升级；Wrangler 4内升级至4.151.1，其余仅开发工具的传递依赖更新。生产依赖版本未动。审计从2 critical / 6 high / 1 moderate降为0；没有回退升级。

远端CI必须以本轮实际提交对应run为准，不能用本机通过代替。最新结果和逐份变化保存在本机`.data/release-candidate-20261017/`。

## Preview保护与部署状态

仅preview设置`PREVIEW_ACCESS_REQUIRED=true`，所有静态页面和API先进入Worker。未配置口令一律503；未登录401。口令校验使用WebCrypto MAC验证，cookie使用签名、有效期、当前origin及`HttpOnly; Secure; SameSite=Strict; Path=/`。错误登录、接口频率、并发、实际请求体、输出token上限及日志脱敏有正反例测试；正式环境行为不变。

请求频率和并发限制仍是每IP、每Worker实例的内存限制，不是持久全局费用硬限。口令用于限制测试访问，不等于正式账号系统。日志只写长度、错误码、耗时和匿名客户端标记，不写正文、口令或cookie。

通过现有系统代理只读核验，Wrangler已登录；`wrangler secret list --env preview`当前只有`DEEPSEEK_API_KEY`，缺`PREVIEW_ACCESS_CODE`。本轮不读取、不打印、不设置任何真实Secret值。因此不能部署；没有地址或新部署版本ID可报告。不得把旧自定义预览域名当作本候选。

## 回退和数据边界

preview配置`routes: []`，只允许workers.dev目标；正式域名及旧自定义预览Worker不变。IndexedDB按完整origin隔离，即便库名相同，workers.dev与student-affairs.site也不能直接读取对方数据；测试过程仅使用全新隔离库。

命令已用本机CLI帮助及打包dry-run核验，尚未执行远端回退：

```powershell
node node_modules/wrangler/bin/wrangler.js deployments list --env preview --json
node node_modules/wrangler/bin/wrangler.js rollback <已核验仍带访问保护的版本ID> --env preview
```

首次受保护部署之前没有已核验的受保护旧版本，不能直接回退到不带口令的历史RC.4。此时应重新部署保留本访问保护的已验证构建；部署前保存目标Worker版本ID、候选Git SHA、dist及配置摘要。代码回退不回退浏览器数据库；先下载JSON和升级前快照，再按应用内恢复入口处理数据。

浏览器矩阵和远端CI最终结局在交付前补齐；没有证据的项保持未验证，不把保存成功或旧录制改善称作成熟产品。
