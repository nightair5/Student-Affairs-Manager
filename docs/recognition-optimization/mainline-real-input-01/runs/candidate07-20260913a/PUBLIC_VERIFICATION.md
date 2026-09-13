# 本轮官方公开资料核验

核验时间：2026-09-13 07:44 UTC。只读取公开文档，未请求模型或余额接口。

- https://api-docs.deepseek.com/zh-cn/quick_start/pricing/ ：deepseek-flash对应DeepSeek-V4.1-Flash；1M上下文；峰时未缓存输入2元/百万token、输出8元/百万token，缓存更低。旧别名不能作为旧模型对照。API不提供本轮可锁定的不可变版本。
- https://api-docs.deepseek.com/api/create-response/ ：POST /responses，支持deepseek-flash；temperature范围0至2；reasoning.effort=none关闭思考；stream=false；max_output_tokens为总输出上限，取8192；结构化JSON参数支持。
- 现有保守输入上限1048576、输出8192，全部按峰时未缓存计，最坏2162688微元，小于3300000预留。预算机制与旧结算不改价，只有新grant的次数上限128。
- 搜索缓存曾返回旧型号/旧价格，未采用；以上为本轮成功打开的官方页面。最初英文价格页超时，中文官方当前页成功，不属于模型请求。
