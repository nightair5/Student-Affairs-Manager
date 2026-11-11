# 阿里云轻量服务器部署

在杭州轻量应用服务器 `118.178.194.96` 上用 Nginx 提供网页，用本机 Node 提供与当前站点相同的 `/api`。这一步先使用 HTTP。证书准备好之后，再在这台服务器上开启 HTTPS，并把 `/etc/student-affairs.env` 里的 `SAM_HTTPS` 改为 `true`。

应用目录默认是 `/opt/student-affairs`。下面的命令假设仓库已经放在这个目录。

## 服务器准备

- 系统需要 Node.js 20 或更新版本，以及 Nginx。Node 必须装在 `student-affairs` 用户能够执行的路径，例如 `/usr/local/bin/node`；安装脚本会实际用该用户试运行。`npm run serve:public` 会自行读取可选的 `.env`，不依赖较新的 Node 命令行参数。
- 阿里云安全组放行 TCP 80。服务器本机防火墙也要放行 80。
- Node 进程只监听 `127.0.0.1:8788`。公网只访问 Nginx。

## 环境变量

在服务器上创建 `/etc/student-affairs.env`，权限设为 `600`。不要把这个文件提交到 Git。

| 变量 | 作用 |
| --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek 密钥。留空时页面仍可使用，状态接口返回 `configured: false`，整理会回退到本机规则。 |
| `SAM_PUBLIC_HOST` | 保持 `127.0.0.1`。 |
| `SAM_PUBLIC_PORT` | 保持 `8788`。 |
| `SAM_STATIC_DIR` | Vite 构建目录，例如 `/opt/student-affairs/dist`。 |
| `SAM_HTTPS` | 当前填 `false`。只有这台服务器自己启用 HTTPS 后才改为 `true`。 |
| `ALLOWED_ORIGINS` | 额外允许的浏览器来源，用逗号分隔。同源访问不需要填写。 |

`DEEPSEEK_API_URL` 和模型名由服务端代码固定为 `https://api.deepseek.com/chat/completions` 与 `deepseek-v4-flash`，不从这里读取。同步、邮件队列仍是可选的另一个进程（`npm run server`，端口 `8787`），公网站点不依赖它。

## 安装

```bash
cd /opt/student-affairs
sudo bash deploy/swas/install.sh
```

脚本会执行 `npm ci`、`npm run build`，安装 systemd 服务 `student-affairs-api`，并写入 Nginx 站点配置。再次运行会重启 API 进程，使新的后端代码生效。首次运行会从 `deploy/swas/student-affairs.env.example` 生成 `/etc/student-affairs.env`；如果该文件已存在，脚本不会覆盖。

Nginx 为静态页面加上与 Cloudflare 相同的框架和内容类型防护，并把 `.mjs` 标成 JavaScript，PDF 文本提取才能加载 worker。入口 HTML 使用 `no-cache`，避免更新后继续引用已删除的脚本。本机证书启用前不发送 HSTS。未知 Host 会被拒绝。API 进程以系统用户 `student-affairs` 运行。

以后把 HTTPS 配置放在 `/etc/nginx/snippets/student-affairs-extra/`。安装脚本会更新站点文件，但不会改动这个目录。

写入密钥后重启 API：

```bash
sudo systemctl restart student-affairs-api
```

只在本机检查时：

```bash
npm run build
npm run serve:public
```

## 验收

```bash
curl -fsS -H 'Host: student-affairs.site' http://127.0.0.1/api/deepseek/status
curl -I -H 'Host: student-affairs.site' http://127.0.0.1/
```

本机检查必须带上站点允许的 Host。直接用 `127.0.0.1` 作为 Host 会被未知主机规则拒绝。

浏览器打开 `http://118.178.194.96/`。每个页面底部居中显示 `桂ICP备2026027233号-1`，点击后打开 `https://beian.miit.gov.cn`。未填写密钥时，状态接口里的 `configured` 为 `false`。

## 域名

用 `http://118.178.194.96/` 检查安装即可。现在的生产域名已经在 Cloudflare 上通过 HTTPS 发布，并且响应包含一天的 HSTS。在这台服务器的 443 端口证书实际可用之前，不要把 `student-affairs.site` 指到该 IP，也不要关闭 Cloudflare 代理。已经访问过站点的浏览器会直接走 HTTPS，证书未就绪时页面会打不开。

证书配置放在 `/etc/nginx/snippets/student-affairs-extra/`。确认 `https://student-affairs.site` 从这台服务器打开后，再切换 DNS，然后把 `SAM_HTTPS=true` 并重启 API。
