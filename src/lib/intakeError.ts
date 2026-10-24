/** User-facing recovery guidance. Never turn a failure into a successful capture. */
export function intakeFailureMessage(reason: string): string {
  if (/quota|indexeddb|database|storage|本机|数据库|(?:来源|原文).*保存|存储|事务/iu.test(reason)) {
    return '这次没能完成浏览器内的保存，输入仍在。请先复制原文；检查浏览器是否允许本站保存数据，再重试。不要清空已有数据。'
  }
  if (/network|fetch|timeout|超时|网络/iu.test(reason)) return '网络暂时没有响应，输入已保留。请检查连接后重试。'
  if (/图片|页面|pdf|multimodal/iu.test(reason)) return '文件暂时没有处理成功。你可以重试，或改为粘贴通知正文。'
  return '这次没有整理成功，输入仍在。可以重试；若仍失败，请先复制原文并查看详细原因。'
}
