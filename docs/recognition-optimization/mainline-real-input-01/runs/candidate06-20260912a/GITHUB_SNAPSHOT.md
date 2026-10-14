# 分支源码上传与Cloudflare接入边界

2026-09-13，用户明确要求把分支文件上传GitHub和Cloudflare稳定链接。本次上传现有21个业务文件作为待真实页面验收的源码快照；不再将未提交作为保存代码的唯一方式。上传不改变candidate06不采用及浏览器NOT_RUN的结论。

- 起点32210c03fdc8ef5d650c4f58f81cbde7e743ebb0，当前实验分支不变。
- 55源码逐字匹配原快照；944保护、607历史证据、冻结依赖及215行账本未改。
- 13份原工程日志SHA匹配，复用1310项测试（1309通过、1既有跳过）等原工程结论，不宣称本次重新执行。源码无新修改。
- 本次密钥扫描1707源代码/构建文件通过，暂存只包含21个明确业务路径及本报告、短交接、追加日志；不上传.env、凭据、测试数据库或本机临时目录。
- Q01/Q07真实页面、刷新读库及实际下载仍NOT_RUN。代码存档不是完整业务验收或候选晋级。

## 为什么不能直接发布现有构建

src/main.tsx挂载无实验runtime的App，普通Vite构建不会带出MAINLINE-REAL-INPUT-01入口。直接部署dist只能得到旧默认链路，不能宣称最新实验可用。

realInput01/browser.tsx只允许127.0.0.1；recorded模式额外锁定http://127.0.0.1:6631和原库，禁止缺库创建。runtime.ts也拒绝recorded模式initial及其他库名。Cloudflare HTTPS地址不会拥有本机origin的IndexedDB。因此不能仅改域名或复制网页来获得原库验收，也不能删除这些检查。

现有wrangler默认配置还绑定生产student-affairs.site，不使用默认deploy命令。Cloudflare部署本次尚未执行，未读取/修改Cloudflare或DeepSeek Secret。

## 一次性最小追加范围申请

建议独立的“云端零调用回放实验版”，不是商业上线或开放付费模型。需批准：

| 文件 | 最小职责 |
|---|---|
| src/experiments/realInput01/browser.tsx | 显式HTTPS预览模式、提示新origin与新实验库；用户主动初始化空库；旧6631/default不变 |
| src/experiments/realInput01/runtime.ts | 预览库身份与历史响应原身份分开绑定；不改raw/request/候选或旧库规则 |
| src/experiments/realInput01/acceptance.test.tsx | 新origin初始化、历史回放、确认保存、旧默认及隔离反例 |
| scripts/build-real-input-preview.mjs（新增） | 根env禁读的真实App构建、只打包获准匿名Q01-06/Q07-06响应与必要资源，不打包账本/Expected/密钥/本机路径 |
| cloudflare/real-input-preview.mjs（新增） | 静态资源及固定匿名响应只读返回；无上游模型调用、无Secret、无真实库绑定 |
| wrangler.real-input-preview.jsonc（新增） | 全新独立Worker/预览网址，明确空生产routes，不改原wrangler/RC.4/生产 |

另仅新增相关构建/边界测试可放现有获准Node测试路径，若需独立新测试路径应与上述六文件一并批准。报告仍在原工作包目录。

预览版只公开上述两份人工合成通知及既有响应用于核对/确认，所有用户操作仍保存在该HTTPS域名浏览器内。不迁移本机旧库，不把空库说成原13任务恢复，不新增模型调用。公开站点无登录时仅用于匿名实验，不采真实学生资料。云端真实识别服务的鉴权/配额/计费不在此最小包，不冒称已接通。

验收：HTTPS首页和真实实验JS在线可取；模型路由关闭；新库明确创建后可回放、主动确认、刷新读回；原默认/旧库/历史不变；实际下载对独立读库。必要工程检查后精确Git交付并部署，记录精确版本和真实URL。不能用普通首页或HTTP200替代实验链路验收。
