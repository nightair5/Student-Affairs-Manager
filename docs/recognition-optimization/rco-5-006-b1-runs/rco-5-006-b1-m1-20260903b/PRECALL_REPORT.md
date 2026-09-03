# RCO-5-006-B1-M1 联网前冻结报告

- authorization：`RCO-5-006-B1-M1`
- run：`rco-5-006-b1-m1-20260903b`；前一 run `rco-5-006-b1-m1-20260903a` 因剪贴板不是密钥而在本机构造请求头前终止，裁定为 0 次真实模型调用。
- model：`deepseek-v4-flash-vision-exp`
- candidate：12 次；verifier：最多 12 次；总调用：最多 24 次。
- temperature：0；Repair / retry：0 / 0。
- 人民币硬上限：10 CNY；理论最坏代理成本：8.504602 CNY。
- Dataset、Expected、scopeIndex、plan、validator、cache：未修改。
- 模型调用 / 网络请求 / Secret access：0 / 0 / NONE。
- 密钥策略：先验证单行 Bearer-safe 格式和 Headers 可构造性，再写 dispatch；密钥只从当前进程环境读取一次，仅驻留内存，不写 checkpoint、result、report、日志或 Git。
- 稳定路径 / RCO-6 / 部署：UNCHANGED / BLOCKED / NOT_RUN。
