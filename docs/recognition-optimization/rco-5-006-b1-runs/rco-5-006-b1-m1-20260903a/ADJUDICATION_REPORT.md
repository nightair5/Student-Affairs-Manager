# RCO-5-006-B1-M1 首次启动裁定

## 结论

- 该次启动是 `LOCAL_CREDENTIAL_PREFLIGHT_REJECTED_BEFORE_NETWORK`，不是一次真实模型调用。
- runner 为了保守审计，在调用 `fetch` 前已把 checkpoint 标记为 `dispatched`；因此原始 checkpoint/result 继续保留“1 次未知回执”的原样记录，不回写掩盖现场。
- 随后使用相同剪贴板内容单独构造标准 `Headers`，稳定复现相同 `TypeError`：值中含非 ByteString 中文字符，浏览器网络请求对象无法构造。
- 剪贴板内容的无敏感摘要为：463 字符、17 行、包含空白、非纯 ASCII、不以 `sk-` 开头；它是普通文本，不是 DeepSeek API key。
- DeepSeek 服务根地址的匿名 HEAD 连通性检查同时返回 HTTP 401，说明基本直连与环境代理均可达；本次失败点在本机请求头构造之前。

## 调用与费用裁定

- 实际模型调用：0。
- 实际 HTTP 模型请求：0。
- Provider request ID：无。
- Provider usage：无。
- Provider billed cost：`NOT_OBSERVABLE`；基于“请求对象未构造”的本地证据，本次不应产生模型费用。
- Repair / retry：0 / 0。

## 后续约束

- 不复用该 run ID，不篡改其原始 checkpoint/result。
- 新 run 必须先检查密钥为单行、ASCII、Bearer-safe 且可构造 Headers，然后才能写入 dispatch 预留记录。
- 原 24 次真实模型调用额度尚未消耗；是否继续仍取决于安全凭证是否可用。
- Dataset、Expected、scopeIndex、plan、validator、cache、稳定路径、RCO-6 和部署均未修改。
