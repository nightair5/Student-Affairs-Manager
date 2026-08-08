# E2-G Model Gateway 与可观测性

Recognition 的模型调用现在统一经过 `model-gateway-1.0.0`。Cloudflare `DeepSeekProvider` 是唯一持有服务端 API Key 的实现；浏览器侧只定义无密钥接口与注入式 transport。`MockRecognitionProvider` 可重复测试 recognize、repair 和 extractFacts，未来替换 Provider 不需要改业务验证与合并规则。

每次 Worker 成功响应包含去除模型正文后的 `execution` 元数据：provider、model、gateway/prompt/schema/pipeline/validator/repair/router 版本、各 operation 的 status、transportStatus、errorCode、attempts、durationMs，以及上游真实返回时的 tokenUsage；任何一次 usage 缺失时聚合 usage 保持 null，不估算成本。

Workspace v8 没有改动。现有 RecognitionRun 继续保存 provider、model、prompt、schema、pipeline、duration、qualityFlags 与 null/真实 tokenUsage 字段；Capture 的 pipelineVersion 记录当前 E2 组件版本组合。服务端密钥不进入响应、浏览器、IndexedDB、日志或 Git。
