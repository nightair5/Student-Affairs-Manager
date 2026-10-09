# 发送前停机的特定接续

2026-10-09 用户提交完整三小时工作包，明确授权仅在证据证明四身份未发送时续原 grant；新工作包共享最多16请求/US$6，原批仍受US$1.30限制。真实授权与续期价格原件仅在本机 `.data`，不伪造逐批回复。

现场 read-only audit CONSISTENT：四身份 pristine NOT_SENT、1 grant/0 reserve/0 settle、0 raw、1 receipt，原 phase/boundary 无记录。冻结 once-send core 要求 reserve 持久化成功后才可调用 transport；原通用 HALT 不足以推断发送不确定。真正不确定的旧批仍封存。

新增 `current-role-preflight-recovery.mjs` 是既有 recovery host/core、原 grant、精确四请求的薄绑定。它核当前提交/远端、原 Git blobs/请求哈希、完整链/receipt、原状态/HALT/锁身份、续期授权/同路由同费率及三小时共同预算。仅在无并发执行器且证据一致时原子归档原 HALT 和空锁，不删除；未闭合恢复 guard 阻止派发。原 AUTH/PRICE/USER_AUTH 字节不改，续期记录绑定新真实指令。发送严格 ordinal/一次，任何 reserve/send/raw/settle 不确定继续封存。浏览器使用原只读录制接口。

定向24安全反例通过：原 host 真实发送前失败 send=0 可恢复，reserve后失败不可恢复，四请求原 grant 逐身份仅一次，授权漂移/额外费用/路由/并发/孤立文件拒绝，phase与TLS/POST边界观察仍阻断不确定。发送/恢复完成与模型事实质量另记实际结果；本文件不把工具修复算首次正确率提高。

首次本地准备被运行时 CRLF 与 Git LF 字节差异阻断，原 HALT/锁/状态/账本均未变化。新核验分别冻结两份精确字节哈希并要求仅换行规范化后相等；内容改变仍拒绝。未执行准备的空 guard 和补充授权原件经原现场一致核验归档，不删除或更改原批屏障。

原生成/评分冻结不改；当前产品程序和首次展示另固定在输出前，结果分别报告。复用普通 App/ReviewSession/DomainCommitPlan/Repository；没有新依赖、Schema升级或默认替换。
