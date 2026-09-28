# D13 实际浏览器验收

2026-09-28；官方 Computer Use → Codex in-app browser，tab 9。最终入口 `http://127.0.0.1:6646/?automation=1`；全新 D13 数据库 `rco-mainline-01-02-i1-real-input-candidate16-d13-engineering-2`。旧 6633—6642 服务及用户库未操作。ENGINEERING_REPLAY，非真人试次，非 Candidate16 输出。

## 实际操作及结果

| 场景 | 页面操作和实际结果 | 可审查证据 |
|---|---|---|
| 明确条件 false、纯信息 | 打开通知、核对来源、确认无任务；Source/Draft 保留，正式 Task=0/Project=0/Event=0 | [01 读回](browser-evidence/01-no-task-readback.json) |
| 独立模糊事件 | 打开字段依据；编辑地点为匿名服务台；注入下一次原子保存失败；页面保留编辑和错误 | [02 失败截图](browser-evidence/02-event-save-failure.png)、[页面文字](browser-evidence/02-event-save-failure.txt) |
| 手动恢复 | 再点击保存，核对事件并确认无任务；Task=0/Project=0/Event=1/TimePoint=1；周三晚 normalizedValue=null、needsConfirmation=true | [03 恢复读回](browser-evidence/03-event-recovery-readback.json) |
| 事件刷新与重开 | 刷新、收件箱、查看来源；地点和模糊原文时间保持，无虚假日程 | [04 页面](browser-evidence/04-event-refresh.txt)、[最终构建截图](browser-evidence/11-final-event-refresh.png) |
| 错误修订/部分确认 | 错误海报替代缺旧端点，相关项不能确认；无关预约 T4 核对并独立入库，其余保持待纠正 | [05 阻断](browser-evidence/05-revision-blocked.txt)、[06 部分确认](browser-evidence/06-partial-confirmation.txt)、[06 读回](browser-evidence/06-partial-readback.json) |
| 任务字段编辑 | 原标题改为“复核项目成员资料（核对后）”，明确保存修改、核对、加入任务；保存的字段与 commit/readback 可对应 | [07 任务读回](browser-evidence/07-task-edit-readback.json) |
| 拒绝错误任务 | 将“联系项目办”记录为不需要，再确认正确项；只新增 1 正式任务；disposition.reject.T2、structural=true，不能计零修改 | [08 页面](browser-evidence/08-reject-correction.txt)、[08 读回](browser-evidence/08-reject-readback.json) |
| 真正 D11 旧回答 | S10 Candidate15 原回答带 BAD_REVISION_REFERENCE；显示 MISSING_OR_INVALID_ENDPOINT，标记无任务按钮禁用，原回答保留 | [09 页面](browser-evidence/09-d11-s10-reference-block.txt)、[09 截图](browser-evidence/09-d11-reference-block.png) |
| 最终独立读回 | 独立 repository 读回与主 repository 一致；6 个草稿、3 Task、0 Project、1 Event、1 TimePoint；原始回答 sidecar 同时导出 | [10 完整读回](browser-evidence/10-final-readback.json) |

最后将 Picker 移至独立组件文件以消除新增 Fast Refresh warning，行为未改变。随后重新构建并重启本轮自建 6646 服务、刷新重开事件，见 [11 页面](browser-evidence/11-final-event-refresh.txt)；[初始验收构建](browser-evidence/BUILD_AT_ACCEPTANCE.json) 和 [最终构建](browser-evidence/FINAL_PREVIEW_BUILD.json) 分别保留资源 SHA。最终页面 console error/warn 列表为空，不推断未访问路径也无错。

## 测量证据与限制

读回包含 workspace、originals、events、metrics。编辑事件与原子提交、字段差异、独立 readback 一起保留；原始模型 HTTP/raw 从 sidecar 看，页面兼容字段不得取代它。D13 复用旧 UI 的 provider 文案，匿名夹具仍可能显示“DeepSeek V4 Flash 建议”；全局与来源标题明确工程身份，不意味着本轮发生调用。首条无任务夹具在开发早期沿旧兼容执行标签写入，未事后改库洗掉；其 engineering 记录身份与实际 0 请求不变，后续使用 seen_engineering_replay。

无任务阅读 35,990ms/编辑 0ms；任务标题编辑 129ms/阅读 189,257ms/等待 175ms；拒绝编辑 121ms/阅读 48,002ms/等待 148ms。上述都是工具操作记录。模糊事件的跨刷新试次时间缺失为 null（refresh time discontinuity）；坏引用录制回答未完成处置，缺 terminal commit/readback。正确性仍为 null，四项真人指标均 NOT_OBSERVABLE。

隐藏/空闲、实际保存排队、重复事件、缺读回、精确时间、合法双端点等由定向测试补充；没有把这些单测说成各自实际浏览器点击。浏览器完成了本表列出的场景，未开展手机/跨浏览器/真人验证。

## 工具问题与恢复

最初通道曾返回 `nodeRepl.fetch request failed`，重新绑定独立 IAB 标签后可操作；浏览器 blob 下载工具有等待下载超时（一次 30 秒、一次 10 秒），故没有宣称下载 API 通过。改用页面真实可见的“查看完整匿名读回 JSON”读取导出文本并保存上述证据，不注入脚本访问 IndexedDB、不用单测冒充浏览器。该替代不改变页面保存逻辑。

所有录制资料与工程证据均为匿名已见合成内容；没有真人数据或 Secret。本机服务可在后续查看时用 `node scripts/serve-candidate16-d13.mjs 6646` 启动；端口被占用时脚本拒绝接管，不结束其他服务。
