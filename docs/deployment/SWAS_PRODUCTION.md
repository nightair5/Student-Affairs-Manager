# 正式环境：阿里云杭州 SWAS

生效：2026-11-11，依据负责人本轮生产迁移交接。网站名为「个人事务整理工具」。此记录替代此前面向 apex 正式站的 Workers 部署与回滚说明。

当前已核实生产（2026-11-12）：`v3.0.0-beta.39` / `1109072304af684d9fc76ff9126ee185bf620d56`，服务器完成源码包安装、Node 20 构建、188 个产物哈希及 HTTP/API 检查。实际版本见 [deployment.json](https://student-affairs.site/deployment.json)。原 PR #15 保留为托管来源，不再作为当前版本。

本次保护备份：`/root/sa-backups/20261112-001910-11090723-attempt3/`。回滚命令：`bash /root/sa-backups/20261112-001910-11090723-attempt3/rollback.sh`。脚本恢复整棵旧代码、Nginx/HTTPS/service 配置，并保留原 env 权限。首次回滚记录位于 `/root/sa-backups/20261111-235702-11090723/`，未清理。

生产浏览器及新真实模型调用未运行；服务器模拟上游识别与 API configured 只证明对应接口和配置，不代表真实模型成功。保存验证复用同候选隔离仓库证据。详见本次 RELEASE。

## 生产基准与分支

- 正式域名：`https://student-affairs.site`；阿里云杭州轻量应用服务器 `118.178.194.96`，Alibaba Cloud Linux 4。
- 产品基准：`v3.0.0-beta.38` / `5ceb325efc3ccbb1d1aae12d07bea44abe7a8ba0`。
- 迁移时部署基准：`253953163701a43a43a327684dcfe712256a09e6`，即 [PR #15](https://github.com/nightair5/Student-Affairs-Manager/pull/15)，分支 `cursor/v3-beta38-swas-icp-15fe`，base `release/v3-beta-38`。本轮查询 PR 仍 open、未合并；PR 状态不能代替服务器运行状态。
- 不直接部署纯 `5ceb325e` 树：它不含 ICP 页脚、`deploy/swas/` 和 `serve:public`。integration 的后续产品改动也必须先兼容这套托管能力，不能直接覆盖部署。
- [PR #14](https://github.com/nightair5/Student-Affairs-Manager/pull/14) 基于旧 `feature/student-affairs-mvp`，不是当前产品基准；不得整支覆盖正式站。未明确要求时不合并任一 PR。
- Cloudflare 仅管理 DNS。apex 保持 DNS-only A → `118.178.194.96`；不得重新代理、修改 NS 或改回 Workers。`preview.student-affairs.site` 可保留在 Workers，和正式发布隔离。

## 已有运行结构与保留项

| 项目 | 约束 |
|---|---|
| 代码与静态资源 | `/opt/student-affairs`，无 `.git`；静态资源 `/opt/student-affairs/dist` |
| API | `server/public-server.mjs` / `npm run serve:public`；systemd 服务 `student-affairs-api`，非特权用户 `student-affairs` |
| 反向代理 | Nginx 80/443，`/api/` → `127.0.0.1:8788` |
| Node | `/usr/local` 下官方 v20.19.5；major 必须 ≥20，且服务用户可执行；必要时用 `SAM_NODE_BIN` 指定已验证路径 |
| 环境文件 | `/etc/student-affairs.env`，权限 **600**；保留内容与权限，不覆盖、不输出值、不带入交付包或 Git |
| 非机密运行配置 | `SAM_HTTPS=true`；`SAM_ALLOWED_HOSTS=student-affairs.site,118.178.194.96`；`SAM_PUBLIC_HOST=127.0.0.1`；`SAM_PUBLIC_PORT=8788`；`SAM_STATIC_DIR=/opt/student-affairs/dist` |
| 密钥 | `DEEPSEEK_API_KEY` 仅由既有服务环境读取；不读出、打印、复制到文档/聊天或提交 Git |
| TLS | `/etc/letsencrypt/live/student-affairs.site/`；保留 `/etc/nginx/snippets/student-affairs-extra/https.conf` |
| ACME | webroot `/var/www/acme`；保留挑战路径与续期能力 |
| 备案 | 首页页脚居中显示 `桂ICP备2026027233号-1`，链接 `https://beian.miit.gov.cn`；公安备案仍在审核，暂不添加号码或图标 |

## 后续更新流程

1. 核对实际服务器基线、产品候选与 PR #15 托管差异，先本地修改和验证。识别配置在 `public-server.mjs` 有固定值，不能只改 wrangler vars 就声称正式 API 已更新。
2. 当前候选已选择性移植 PR #14 后续安全修复：请求体上限、NAT64、413 响应不拆套接字、限流清理上限、拒绝 `//evil.com` 类绝对/协议相对路径、限流槽满拒绝新客户端而不抹掉已有计数，以及 DNS 超时/取消。保留当前多模态 14 MiB 入口、编译器 1.0.31、直达提示 3.11；17 项 Linux 接口测试通过。没有整支覆盖旧产品；这些安全修复已在 beta.39 部署生效。
3. 发布前在服务器 `/root/sa-backups/` 建立本次备份：代码树、Nginx 站点、`https.conf`、env；保留原权限。env 备份只留受保护的服务器位置，不回传到开发目录，不显示内容。记录实际备份路径与代码 SHA。
4. 服务器访问 GitHub:443 不稳定，不依赖 `git fetch`。从已验证候选制作精简源码包并通过 scp 上传；排除 `node_modules`、`dist`、`.git`、`.data`、`docs/.aris`、`refine-logs`、凭据与用户数据。不打包整个 docs。保留同提交的 `wrangler.jsonc`：它仍是编译版本一致性测试的对照配置，漏带会留下服务器旧版本；携带文件不等于部署 Workers。beta.39 最终包为 1038 个文件、2599926 字节，SHA-256 `befb13d8f1850f5bf6868f36f4ba822d08382583141f953ce980dbfd97633df5`。
5. **保留 `tsc -b` 静态引用的小 JSON fixtures**，按实际候选的导入依赖生成显式清单、保留相对路径；交接参考约十几个、0.49 MiB，不能把这个数量当永久固定值。打包后在干净解包目录验证构建，防止被开发机现有 docs 掩盖缺文件。
6. 同步必要源码到 `/opt/student-affairs`，运行现有 `sudo bash deploy/swas/install.sh`，或等价的 `npm ci`、构建及 systemd/Nginx 安装流程。保留既有环境文件和 HTTPS 片段，不另起平行托管方案。
7. 安装脚本会重写 80 端口站点 `/etc/nginx/conf.d/student-affairs.conf`。每次运行后恢复下列两段至正确 server 上下文，并核对 TLS 片段仍被 include；不要删除 `https.conf`。

```nginx
location ^~ /.well-known/acme-challenge/ {
    root /var/www/acme;
}
if ($host = student-affairs.site) {
    return 301 https://$host$request_uri;
}
```

另须检查 TLS 片段中也有同一 ACME `location`：80 端口 server 级 301 会先于 location 返回，验证机构随后访问 HTTPS，因此只在 80 配置 webroot 不够。本次已在 `https.conf` 补齐 ACME，保留既有证书/TLS 配置，并增加明确拒绝非 `student-affairs.site` 或空 Host 的规则；未来不要重置这两项。域名 HTTP 仍 301，IP HTTP 仍 200。

8. 80 和 443 都保持全站 `client_max_body_size 1m`，仅 `location /api/` 为 `14m`。域名 HTTP 返回 301 到 HTTPS；直接 `http://118.178.194.96/` 保持 200。未知 Host/无 Host 继续拒绝。核对后执行 `nginx -t`，成功才 reload。

## 服务器本机验收与回滚

验收从服务器执行，显式绕过代理；不能把受干扰出口的结果作为发布结论。以下命令已在 beta.39 部署时运行；后续发版仍须重新核验：

```bash
curl --noproxy '*' --resolve student-affairs.site:443:127.0.0.1 -fsS https://student-affairs.site/ -o /tmp/student-affairs-home-check.html
curl --noproxy '*' --resolve student-affairs.site:443:127.0.0.1 -fsS https://student-affairs.site/api/deepseek/status
curl --noproxy '*' --resolve student-affairs.site:80:127.0.0.1 -sS -o /dev/null -D - http://student-affairs.site/
curl --noproxy '*' -sS -o /dev/null -w '%{http_code}\n' http://118.178.194.96/
```

- HTTPS 首页 200，页面有备案号及正确链接；静态资源与本次 dist 对应。
- `/api/deepseek/status` 为 `configured:true`；配置存在不等于真实识别通过，真实模型请求仍按本轮合法授权及执行器记录验证。
- 域名 HTTP → HTTPS 301，IP HTTP 200；检查 ACME、Host 拒绝及两套 `/api/` 大小配置。
- 核 systemd 实际 Node 路径、服务用户和服务状态；验 env 权限 600，不读出其内容。
- 识别、保存、完成、撤销等按产品改动范围验收；不操作用户已有浏览器数据库。
- 关键失败时恢复本次服务器备份的代码树和相应配置，保留原 env 权限，重启 API、`nginx -t` 后 reload，再复核。**Wrangler rollback 不能回滚这台服务器**，不得以旧 Cloudflare version ID 代替本轮备份。
- 发布报告分别记录产品基准、实际部署 SHA、备份路径、资源及运行验证。服务器无 `.git`，下次不能用服务器 git HEAD 证明部署版本。

Host 拒绝验收显式使用 HTTP/1.1，或正确区分 HTTP/2 的流关闭。Nginx 444 在 curl 中可能是 HTTP/1.1 的 52，也可能是 HTTP/2 的 92，不能仅凭 curl 非零退出误判为服务异常；正常 Host 的成功请求需独立验证。

旧 Workers 发布日志与版本 ID 只作历史证据；不得再作为 apex 正式部署目标或实际线上版本依据。
