# 阿里云轻量服务器部署

杭州轻量应用服务器 `118.178.194.96` 用 Nginx 提供网页，用本机 Node 提供与当前站点相同的 `/api`。应用目录是 `/opt/student-affairs`。`student-affairs.site` 的 DNS 是指向该 IP 的仅 DNS A 记录。HTTPS 由这台机器上的 Let's Encrypt 证书终结，证书配置放在 `/etc/nginx/snippets/student-affairs-extra/https.conf`。

这次安装的产品代码是 `v3.0.0-beta.38`。不要把服务器直接切到该 tag：那个树没有 `deploy/`，也没有备案页脚。使用包含本目录的分支。

## 服务器准备

- 系统需要 Node.js 20 或更新版本，以及 Nginx。Node 必须装在 `student-affairs` 用户能够执行的路径，例如 `/usr/local/bin/node`；安装脚本会实际用该用户试运行。`npm run serve:public` 会自行读取可选的 `.env`，不依赖较新的 Node 命令行参数。
- 阿里云安全组放行 TCP 80 和 443。服务器本机防火墙也要放行这两个端口。
- Node 进程只监听 `127.0.0.1:8788`。公网只访问 Nginx。

## 环境变量

密钥只放在服务器的 `/etc/student-affairs.env`，权限 `600`。不要把这个文件提交到 Git。

安装脚本只在该文件不存在时，从 `deploy/swas/student-affairs.env.example` 生成它。文件已存在时原样保留，不会清空 `DEEPSEEK_API_KEY` 或其他已有变量。

| 变量 | 作用 |
| --- | --- |
| `DEEPSEEK_API_KEY` | DeepSeek 密钥。留空时页面仍可使用，状态接口返回 `configured: false`，整理会回退到本机规则。 |
| `SAM_PUBLIC_HOST` | 保持 `127.0.0.1`。 |
| `SAM_PUBLIC_PORT` | 保持 `8788`。 |
| `SAM_STATIC_DIR` | Vite 构建目录，例如 `/opt/student-affairs/dist`。 |
| `SAM_HTTPS` | 这台机器已经自己终结 HTTPS 时填 `true`。只影响回环后的来源判断，以及是否保留 API 响应里的 HSTS。Nginx 送来的 `X-Forwarded-Proto` 仍然优先。 |
| `SAM_ALLOWED_HOSTS` | 允许的 Host，默认 `student-affairs.site,118.178.194.96`。未知 Host 返回 421。 |
| `ALLOWED_ORIGINS` | 额外允许的浏览器来源，用逗号分隔。同源访问不需要填写。 |

`DEEPSEEK_API_URL` 和模型名由服务端代码固定，不从这里读取。同步、邮件队列仍是可选的另一个进程（`npm run server`，端口 `8787`），公网站点不依赖它。

## 覆盖安装

在已有杭州服务器上更新时，先把这个分支放到 `/opt/student-affairs`，然后：

```bash
cd /opt/student-affairs
sudo bash deploy/swas/install.sh
```

脚本会执行 `npm ci`、`npm run build`，安装 systemd 服务 `student-affairs-api`，并用仓库里的 HTTP 模板覆盖生成的站点文件。再次运行会重启 API 进程。这个模板只监听 80，直接提供网页和 `/api`，不写入证书、80 端口 HTTPS 跳转或 HSTS。

`/etc/student-affairs.env` 已存在时原样保留。`/etc/nginx/snippets/student-affairs-extra/` 只在目录不存在时创建；脚本不写入、不删除其中的文件。已有 `https.conf` 和其他操作员片段会继续被模板末尾的 `include` 加载。请在覆盖前确认 443 与证书续期都在这个目录里。如果它们只写在即将被覆盖的生成站点文件中，安装后会回到上述 HTTP 模板。

Nginx 为静态页面加上框架和内容类型防护，并把 `.mjs` 标成 JavaScript，PDF 文本提取才能加载 worker。入口 HTML 使用 `no-cache`。未知 Host 会被拒绝。API 进程以系统用户 `student-affairs` 运行。本机证书启用前，打包的站点配置不发送 HSTS。

确认已有环境文件里的 `SAM_HTTPS`。证书已经由本机 Nginx 终结时保持 `true`。脚本不会替你改这个值。修改后重启 API：

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
curl -fsS https://127.0.0.1/api/deepseek/status -H 'Host: student-affairs.site' --resolve student-affairs.site:443:127.0.0.1
curl -fsSI http://127.0.0.1/ -H 'Host: student-affairs.site'
```

浏览器打开 `https://student-affairs.site/`。每个页面底部居中显示 `桂ICP备2026027233号-1`，点击后打开 `https://beian.miit.gov.cn`。未填写密钥时，状态接口里的 `configured` 为 `false`。公网安备号尚未下发，页面不要写这一行。
