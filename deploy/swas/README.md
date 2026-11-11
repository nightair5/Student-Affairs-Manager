# 阿里云轻量服务器部署

在杭州轻量应用服务器 `118.178.194.96` 上用 Nginx 提供网页，用本机 Node 提供与当前站点相同的 `/api`。这一步先使用 HTTP。证书准备好之后，再在这台服务器上开启 HTTPS，并把 `/etc/student-affairs.env` 里的 `SAM_HTTPS` 改为 `true`。

应用目录默认是 `/opt/student-affairs`。下面的命令假设仓库已经放在这个目录。

## 服务器准备

- 系统需要 Node.js 20 或更新版本，以及 Nginx。
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

Nginx 为静态页面加上与 Cloudflare 相同的框架和内容类型防护，并把 `.mjs` 标成 JavaScript，PDF 文本提取才能加载 worker。本机证书启用前不发送 HSTS。

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
curl -fsS http://127.0.0.1/api/deepseek/status
curl -I http://127.0.0.1/
```

浏览器打开 `http://118.178.194.96/`。每个页面底部居中显示 `桂ICP备2026027233号-1`，点击后打开 `https://beian.miit.gov.cn`。未填写密钥时，状态接口里的 `configured` 为 `false`。

## 域名

确认 IP 访问正常后，再把 `student-affairs.site` 的 A 记录指到 `118.178.194.96`，并停止 Cloudflare 代理。Nginx 已同时接受这个域名和上述 IP。DNS 生效前，用 IP 访问即可。

HTTPS 不在本次范围内。之后可以在 Nginx 上配置证书；启用后再把 `SAM_HTTPS=true` 并重启 API，避免浏览器在证书就绪前被强制跳到 HTTPS。
