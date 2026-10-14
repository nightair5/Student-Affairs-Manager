# 原第3单元发送前锁的一次恢复

2026-10-04。用户另行明确授权仅恢复此遗留锁、续原3—12身份，唯一原grant、整批US$3.90，前2不重发。不是第二批许可。原授权和价格文件不覆盖；真实许可补充原件仅留本机.data。

冻结host/core不变。新candidate19-recovery及scoped-execution-recovery-host复用原once-send core、完整账本/raw/receipt对账、发送前持久状态及不确定封存协议。恢复层没有prepare入口，不创建grant。

恢复须同时满足：只读audit CONSISTENT、无HALT/孤立写入、唯一grant和2reserve/2settle、两份SETTLED raw与receipt SHA对应、3—12为纯NOT_SENT、下一ordinal=3、空目录锁文件系统身份未变，以及系统可检查进程中没有存活/未知派发器。旧执行器未记录owner PID，所以不会假称已核到原owner；使用当前派发进程清点、真实持久化读集和空锁身份共同证明发送前状态。

补充记录绑定原AUTH SHA、原head/grant/cap/Manifest/12身份、当前已提交推送head、最新官方核价及恢复前账本/STATE/锁身份。价格变化本恢复版本拒绝，避免拿新费率重算历史settle。价格证据更新时间可续，峰时最坏单价/上下文/output界和原参数不变。整批上界仍按12个计算，不以已发低耗时扩大请求范围。

独立recovery-guard与原空目录排除标准并发派发；原锁比较后原子rename到本机recovery-1/lock-original，保持原目录身份。再次对账通过后才写一次RECOVERED记录。任何中途失败保留guard/现场，不能自动重复恢复。后续send前重查补充许可、原授权SHA、推送head、核价、固定身份及完整账本；只接受3—12。第二次恢复、原授权变化、价格变化或不确定发送继续封存。

离线故障覆盖：live/unknown owner、锁身份变化、已存在隔离锁、HALT/未决/额外raw/receipt/STATE.new、追加reserve、授权/hash/head/cap/边界漂移、无第二grant、前2原字节不变、3—12一次顺序执行、reserve后故障封存。工程测试使用匿名temp账本/假transport；不计真实模型或权威账本。

正式操作先提交并立即推送本恢复代码，再创建本机补充绑定、保全原现场、--recover-once。每次--dispatch-next仅一个原ordinal；任何失败停止后续。原冻结评分只有12确定结局、对账一致、无lock/HALT才运行。此次恢复本身0模型、0账本追加；合法续发仍属于原批。
