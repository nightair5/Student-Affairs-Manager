# 正式环境：阿里云杭州 SWAS

生效：2026-11-11，依据负责人本轮生产迁移交接。网站名为「个人事务整理工具」。此记录替代此前面向 apex 正式站的 Workers 部署与回滚说明。

证据边界：本轮通过 GitHub 核实了 PR #15 的 head/base、文件及安装脚本；服务器、DNS、证书和实际部署状态按负责人交接登记，未通过 SSH 再验。本轮不部署、不合并 PR、不修改服务器或 DNS。

## 生产基准与分支

- 正式域名：`https://student-affairs.site`；阿里云杭州轻量应用服务器 `118.178.194.96`，Alibaba Cloud Linux 4。
- 产品基准：`v3.0.0-beta.38` / `5ceb325efc3ccbb1d1aae12d07bea44abe7a8ba0`。
- 负责人报告的实际部署：`253953163701a43a43a327684dcfe712256a09e6`，即 [PR #15](https://github.com/nightair5/Student-Affairs-Manager/pull/15)，分支 `cursor/v3-beta38-swas-icp-15fe`，base `release/v3-beta-38`。本轮查询 PR 仍 open、未合并；PR 状态不能代替服务器运行状态。
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
2. 检查 PR #14 后续安全修复是否已逐项移植：请求体上限、NAT64、413 响应不拆套接字、限流清理上限、拒绝 `//evil.com` 类绝对/协议相对路径、限流槽满拒绝新客户端而不抹掉已有计数。当前交接明确这些后续修复尚未在 PR #15/生产落地；所需移植应带对应测试，不能整支替换。
3. 发布前在服务器 `/root/sa-backups/` 建立本次备份：代码树、Nginx 站点、`https.conf`、env；保留原权限。env 备份只留受保护的服务器位置，不回传到开发目录，不显示内容。记录实际备份路径与代码 SHA。
4. 服务器访问 GitHub:443 不稳定，不依赖 `git fetch`。从已验证候选制作精简源码包并通过 scp 上传；排除 `node_modules`、`dist`、`.git`、`.data`、`docs/.aris`、`refine-logs`、凭据与用户数据。不打包整个 docs。
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

8. 80 和 443 都保持全站 `client_max_body_size 1m`，仅 `location /api/` 为 `14m`。域名 HTTP 返回 301 到 HTTPS；直接 `http://118.178.194.96/` 保持 200。未知 Host/无 Host 继续拒绝。核对后执行 `nginx -t`，成功才 reload。

## 服务器本机验收与回滚

验收从服务器执行，显式绕过代理；不能把受干扰出口的结果作为发布结论。以下是待执行命令，不代表本轮已运行：

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

旧 Workers 发布日志与版本 ID 只作历史证据；不得再作为 apex 正式部署目标或实际线上版本依据。
