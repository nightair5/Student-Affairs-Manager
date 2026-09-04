# RCO-5-008-B8-M1 调用前审查

- 授权：12 个冻结 B8 案例各 1 次 candidate；verifier、Repair、retry 均为 0；人民币硬上限 10 元。
- 模型：`deepseek-v4-flash-vision-exp`；temperature `0`；thinking `none`。
- 输入：匿名合成 sourceText、参考时间/时区和不可变 scope catalog；不含 Expected、语义、安全默认、修订标签或 selected。
- 本机链路：冻结的 composer v2、P4 和 evaluator v2；不接稳定路径。
- 一次性保护：只接受空 checkpoint 和空 raw result；首次 dispatch 前先写 checkpoint，未知回执或上游错误立即停止。
- 理论最坏代理成本：`2.2053504 CNY`，低于 10 元硬上限；服务商实扣金额不可观测时记 `NOT_OBSERVABLE`。
- Secret：仅从当前进程环境读取，不写文件、日志、请求正文或 Git。
- 调用前状态：`READY_FROZEN_NO_DISPATCH`；模型/网络/Repair/retry 为 `0/0/0/0`。
- 禁止：修改 B8 冻结数据、Expected、contract、RCO-5-008 组件或 cache；接稳定路径；启动 RCO-6；部署。
