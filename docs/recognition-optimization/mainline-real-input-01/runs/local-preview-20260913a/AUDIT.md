# 本地独立试用入口

- 用户明确批准在新本地地址创建独立试用库，旧数据全部保留。基线本地/远端04b56391e86ebf6be3ffde9d4512c31a2724f223，工作区原干净。
- 地址：http://127.0.0.1:6632/。原6631和HTTPS服务/浏览器库不改、不迁移、不清除。
- 只修改build-real-input-preview.mjs、browser.tsx、acceptance.test.tsx。无新产品路径、依赖、候选、模型请求或账本追加。

## 用户操作

1. 打开新地址，点击“创建本地独立试用库并进入”。访问页面本身不创建库。
2. 点击“新事务”选择已有匿名通知；历史回放不等于重新调用模型。
3. 明确核对和保存后主动确认；刷新后任务中心、日历与详情均从同一独立库恢复。

新库使用原preview数据库名，但IndexedDB隔离键包含地址、端口和浏览器，因此6632、6631及HTTPS数据互不通用。仅访问固定preview库；不导入原库、不伪造旧任务。坏库或打开失败保持拒绝，不fallback，不自动重建。

## 实现与验证

- 显式localOnly配置仅允许http://127.0.0.1:6632，普通HTTPS配置不放宽。旧6631录制模式的禁止创建/升级保护不变。
- 服务只绑定127.0.0.1:6632，严格Host/Origin/Sec-Fetch-Site和静态路径白名单；POST405，未列资源404。无根目录静态托管、Secret、远程请求、写入API或模型服务。
- 复用原Worker的静态安全响应处理器，不使用Wrangler、不部署；本地产物不生成可部署Wrangler配置。原公开站点没有重新部署。
- 同时修复前端fetch名单遗漏R11/R12的问题；只加入已绑定两示例，任意请求仍拒绝。
- 新增2公开代码/HTTP测试：地址与显式建库/恢复分流、四示例读取、错误地址/跨域/模型/私密路径拒绝。真实启动按钮逻辑由AST提取执行，不另写替代算法；属于模拟测试，不是浏览器证据。
- 66条acceptance全部通过，包括既有真实IndexedDB升级事件模拟、原子保存、未知材料、旧默认和来源完整性反例。未改动层复用前次证据，不重复模型/OCR/时区全部流程。
- 类型app/node通过，lint0错误/4既有警告，Vite临时构建通过（旧大包警告保留），本地esbuild通过。框架configFile:false/envFile:false，新envDir/cacheDir/output；模拟.env隔离探针通过。无根.env读取。
- Secret scan1844文件通过；旧开发依赖漏洞未升级或宣称解决。
- 已运行服务7个HTTP资产SHA匹配、状态模型false、模型POST405。63未改源码SHA匹配，账本200447字节SHA9d4352be315600eeafe887284492398b95e9b2a3dd97721a39f5fe2439316d52不变。
- 旧日志前缀340656字节SHA dfd9e3059e2a14ddc0738993425c2ff2e37c53c2839d767bb4c57e13a3412d08保留。
- 后台Start-Process工具请求被平台策略拒绝，未执行；改用工具支持的普通长期exec会话启动本地Node服务。未修改系统设置。
- 后续官方 in-app browser 控制恢复，实际打开6632独立库；确认前下载证据为0任务，随后从R11仅确认独立任务“填写送样登记单”，未强行确认仍受前置条件约束的“提交检测样本”。
- 明确保存的材料“送样登记单”为required=true、status=unverified；没有映射成缺少、不需要或已备齐。正式任务截止2026-09-17T14:00（Asia/Shanghai），无提醒作业。
- 刷新后任务中心显示1项待推进，9月17日日历显示同一任务与14:00，详情显示confirmed、原始时间、材料和review_material/review_task/confirm三类历史。
- 独立仓储读回下载`real-input-local-evidence (12).json`，完整导出下载`mainline-real-input-01-workspace (4).json`；两条实际读取路径的canonical workspace稳定序列化SHA均为7a3b21a3fcbf02c19c5ae56cf3558cf4ea8aedacc214e6779b4100ecfc2b8c7f，差异路径为空。
- 操作前`real-input-local-evidence (11).json`为0任务；操作后为1任务、1材料、1时间点。两份SourceVersion与RecognitionRun集合、未操作的Q01草稿、R11 raw/first/sourceIndex均保持；R11只追加confirm操作、绑定与状态变化。证据清单见BROWSER.json。

## 启动与停止

在唯一实验仓库执行：`node scripts/build-real-input-preview.mjs --local`。保持进程运行，停止时Ctrl+C；重启服务不会清除浏览器数据。不需安装依赖或读取凭据。页面使用固定6632，勿改成localhost或换端口。

当前服务由node进程在127.0.0.1:6632监听。源码交付记录见Git，实际HTTP与源码摘要见CHECKS.json，真实操作与下载比较见BROWSER.json。本轮验证了“准备情况尚未核实”的正确任务能够主动确认并刷新找回；没有提高或重新测量模型首次准确率。
