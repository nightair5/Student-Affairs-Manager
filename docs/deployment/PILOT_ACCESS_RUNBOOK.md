# 邀请测试访问控制：待部署方案

发布候选以线上 beta.56 (`8dd17d3e757608b6d59b346d75f601acf8463729`) 为基线。主站使用阿里云杭州 SWAS 的 Nginx 和回环 Node 20 服务。部署时使用当前 Nginx 配置核对 TLS、ACME、主机名和请求体限制，备份原配置和发布目录，保留受保护的环境文件和浏览器工作区。

## 运行边界

- Node 20+、单机单状态文件。无新数据库或依赖。服务端默认启用测试访问控制；仅明确设置 `SAM_PILOT_ENABLED=false` 才关闭，关闭会重新开放产品，不能作为到期停用办法。
- Nginx 必须将站点 HTML、所有静态资源和全部 `/api`、`/__pilot/` 请求转发到启用门禁的同一个 Node 服务。现有静态 Nginx 直出配置会绕过门禁，单独上线 Node 代码不算完成。`deploy/swas/pilot-site.conf` 是候选模板，不覆盖服务器配置；按当前环境人工合并并核对原 TLS、IPv6、证书、续期和安全设置。确保没有其他优先匹配的 location、虚拟主机、监听端口或缓存可以绕过。内部端口仅绑定 127.0.0.1，检查防火墙；管理凭据与 Node 端口不公开。
- 候选模板拒绝裸 IP 与未知 Host 的 80/443 访问；证书实际路径、`ssl_reject_handshake` 支持情况和 ACME 所需规则必须按服务器验证。`nginx -t` 后还需进行真实 HTTPS、HTTP、IP、资产、API 和 ACME 验收；本机 Node 测试不能代替真实 Nginx 验收。现有旧 Workers、预览和其他持有 DeepSeek 密钥的服务须单独清点并关闭或实施等效鉴权，主机门禁不保护其他部署。
- 每个邀请码为高熵随机字符串，状态只保存其 SHA-256 摘要。管理员标签只能是 P01 等非个人识别代号。会话为随机 cookie，服务端保留摘要，服务端查状态；同一个邀请码再次登录会使旧会话失效。邀请码是持有者凭证，不能证明真实身份。不要把明文邀请码放入网址、项目、日志、截图、Git 或公开聊天。账号联系表另行妥善保管。
- 登录限制为单个来源 IP 在 15 分钟内最多 20 次尝试，计数驻留服务进程，重启后重置；共享校园出口的参与者可能互相影响。它不是分布式防护，需按实际网络环境配合边界层防护及异常监控。
- 配置缺失、数据损坏、状态锁不可用时服务拒绝访问，避免绕过。写操作先写权限 600 的临时文件并原子替换；跨 Node/CLI 进程使用同目录锁，锁冲突返回失败而不丢计数。若进程异常留下 `.lock`，先确认无任何进程持有锁并保护/备份状态，再由管理员处理，不能自动清理。此设计不支持多服务器共享文件或多机分布式部署；不支持锁超时自动抢占。状态目录 700、属于专用服务用户，不能被 Web 直接读取。
- 状态时间需含时区，例如 `2026-12-01T20:00:00+08:00`，服务端时间必须同步。测试结束时停止业务 API，已激活的邀请码可继续登录。请在原设备、原浏览器、原域名打开备份下载页，点击「导出 JSON」。新打开的页面在加载产品前核对资格，已打开的测试页面会定时核对并切换到下载页。窗口结束后所有新请求继续检查资格，界面显示测试已结束。已下载备份和浏览器本机工作区仍在用户设备上，已发出的上游请求可能继续处理。
- 每日按北京时间 00:00 重置个人与全体模型接口请求次数，试次失败也计入。7×24 小时可能横跨 8 个自然日。网页读取沿用已有单独限流，导出窗口内一并关闭。
- 每次发往 DeepSeek Flash 的请求都先按其官方上下文和输出上限预留金额。现价的保守算法按高峰、未缓存输入每百万 token 2 元，输出每百万 token 8 元。可观测用量按相同价格结算并释放剩余预留，未观测的用量继续保留预留。运营者可用 `pause-ai` 暂停模型而继续让用户导出。这个控制线覆盖本次主站批次的模型请求。账单、价格变动、其他客户端或历史 Cloudflare 部署的支出由各自的服务和账单决定。

## 批次开始和管理

目录应由 `student-affairs` 服务账号持有且仅它和管理员可访问。站点切换及上游计费审批完成后执行 `start-now`，它取服务器当时时间，自动计算 7 天测试和随后的 48 小时导出。最后一个参数用百万分之一元表示模型预算，得到明确授权后才填入金额。`0` 表示使用本机整理。以下命令示范本次的 20/80 次额度与预算关闭状态。

```sh
sudo install -d -o student-affairs -g student-affairs -m 0700 /var/lib/student-affairs-pilot
sudo -u student-affairs /usr/local/bin/node scripts/pilot-admin.mjs start-now /var/lib/student-affairs-pilot/state.json 20 80 0
sudo -u student-affairs /usr/local/bin/node scripts/pilot-admin.mjs issue /var/lib/student-affairs-pilot/state.json P01
sudo -u student-affairs /usr/local/bin/node scripts/pilot-admin.mjs status /var/lib/student-affairs-pilot/state.json
sudo -u student-affairs /usr/local/bin/node scripts/pilot-admin.mjs revoke /var/lib/student-affairs-pilot/state.json P01
```

`issue` 的标准输出是唯一的明文邀请码，操作员应写入受保护的临时文件，并私发给对应参与者。重新登录会使该码的旧会话失效。丢失邀请码后可在测试期间停用旧代号并补发，新代号有自己的额度。进入导出窗口后只接受已经登录过、且未撤销的邀请码。`status` 显示匿名代号、用量和模型预算预留，供管理员核对。

可立即暂停云端模型，或紧急终止整个批次。`close` 会同时结束导出窗口。

```sh
sudo -u student-affairs /usr/local/bin/node scripts/pilot-admin.mjs pause-ai /var/lib/student-affairs-pilot/state.json
sudo -u student-affairs /usr/local/bin/node scripts/pilot-admin.mjs close /var/lib/student-affairs-pilot/state.json
```

`status` 不显示邀请码或会话，只显示匿名代号、日期和请求次数。备份应加密或保存在受限服务器位置；状态恢复会回退额度和撤销记录，因此恢复前须停止入口、明确检查期间变化并重新验证，不能静默恢复旧状态。不要直接编辑状态文件。

## 结束与验收

1. 提前至少两天告知结束时间、导出路径和导出截止时间；不要求用户发送备份文件。提前验证原设备、原浏览器、原域名中的导出和导入恢复。
2. 到结束时检查页面显示导出窗口；验证 `/api/deepseek`、提取、多模态、网页读取均被拒绝且没有新增上游请求。用户本机仍可操作，因此文案不称为强制只读。
3. 到截止后使用测试账户验证页面跳转登录，旧会话和邀请码不能再次进入；用未授权浏览器检查域名、静态资源、所有 API、裸 IP、旧域名和预览。验证管理员恢复路径及 HTTPS/ACME 未受影响。
4. 按向参与者说明的期限处理报名名单、测试记录和授权录屏；不把导出文件、真实通知或邀请码提交仓库。

## 开测条件

部署前需明确测试开始及结束时刻、导出期限、邀请人数、个人/全体每日请求额度、费用预算与负责人。对当前版本已知的识别错误、真实模型验证尚未完成和历史未决调用账本做独立评估。不要因 `configured:true` 就宣称模型正常；不要以工程或模拟测试冒充真实用户结果。
