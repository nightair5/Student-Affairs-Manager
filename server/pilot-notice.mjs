export const PILOT_NOTICE_VERSION = '2026-11-25.1'
export const PILOT_NOTICE_PATH = '/__pilot/notice'
export const PILOT_NOTICE_TITLE = '学生事务管家用户须知和免责声明'

const dateTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'medium',
})

export function pilotNoticeCopy(schedule) {
  return {
    title: PILOT_NOTICE_TITLE,
    intro: '这份说明适用于本轮邀请试用。学生事务管家帮助你把通知整理成待办、日程与材料提示。请使用个人邀请码参加，你可以随时停止体验。',
    sections: [
      {
        title: '用户须知',
        dates: schedule ? [
          ['试用开始', dateTime.format(new Date(schedule.startsAt))],
          ['试用结束', dateTime.format(new Date(schedule.endsAt))],
          ['导出截止', dateTime.format(new Date(schedule.exportEndsAt))],
        ] : [],
        paragraphs: [
          { text: schedule
            ? `云端请求每人每天最多 ${schedule.dailyUserLimit} 次，全体每天合计最多 ${schedule.dailyGlobalLimit} 次，按北京时间零点刷新。`
            : '试用时间、云端额度和导出截止以本轮邀请通知为准。' },
          { text: '试用结束后，已参加的同学可以在导出截止前，用原设备和原浏览器打开同一网站，下载 JSON 备份。到期后，本轮邀请码和在线会话失效。', emphasis: true },
        ],
      },
      {
        title: '数据如何处理',
        paragraphs: [
          { text: '通知文字、待办和修改记录等工作区数据保存在当前浏览器。你可以自行备份，也可以在浏览器设置中清理本站数据。' },
          { text: '使用云端整理时，站点会将本次用到的通知文字发给 DeepSeek。使用网页读取时，站点会访问相关公开链接，读到的文字可用于本次整理。使用云端问答时，站点发送本次问题和所选的引用摘要。请仅提交你有权使用和提供的内容。' },
          {
            text: '按 DeepSeek 开放平台现行政策，在政策规定的条件下，发送的内容和生成结果可能用于模型训练与改进。',
            link: { text: 'DeepSeek 开放平台隐私政策', url: 'https://cdn.deepseek.com/policies/zh-CN/deepseek-open-platform-privacy-policy.html' },
          },
          { text: '站点处理邀请码及会话的校验信息、须知确认记录、调用次数和必要的运行记录，用于验证访问、管理额度和排查问题。如需反馈，或希望查阅、更正、删除与你有关的个人信息，请联系发放邀请码的微信联系人。' },
        ],
      },
      {
        title: '免责声明',
        paragraphs: [
          { text: '整理结果可能漏项或有误。行动前请对照原通知，重点核对资格、截止时间、材料与提交方式。实际报名或提交请按发布方最新要求，通过其指定渠道办理。', emphasis: true },
          { text: '网络、浏览器或云服务出现问题时，整理或导出可能暂时不可用。临近截止的事项请按原通知及时处理。' },
          { text: '因使用产生的争议或损失，依照法律和实际情况确定各方责任。依法应承担的人身损害、因故意或重大过失造成的财产损失及其他法定责任，按法律规定承担。' },
        ],
      },
    ],
  }
}

const escapeHtml = (value) => value.replace(/[&<>"']/gu, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])

export function renderPilotPage(heading, content, wide = false) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(heading)}</title>
  <style>
    body { font: 16px/1.65 system-ui, sans-serif; background: #f4f7f4; color: #183b36; margin: 0; padding: clamp(12px, 4vw, 24px); }
    main { max-width: 430px; margin: 4vh auto; background: white; padding: clamp(18px, 5vw, 30px); border: 1px solid #c7d9d2; border-radius: 12px; }
    main.notice { max-width: 680px; }
    h1 { font-size: clamp(22px, 4vw, 27px); line-height: 1.35; margin: 0 0 16px; }
    h2 { font-size: 18px; margin: 25px 0 8px; }
    p { margin: 0 0 12px; }
    input[name=code], button { box-sizing: border-box; width: 100%; font: inherit; padding: 12px; margin-top: 10px; }
    button { background: #174c43; color: white; border: 0; border-radius: 6px; cursor: pointer; }
    small { display: block; color: #4b625d; margin-top: 16px; }
    .error { color: #872c19; }
    footer { text-align: center; margin-top: 24px; }
    a { color: #174c43; text-decoration-thickness: 1px; text-underline-offset: 3px; }
    :focus-visible { outline: 3px solid #287567; outline-offset: 3px; }
    .schedule { background: #eef5f1; padding: 12px 16px; border-radius: 8px; margin: 0 0 14px; }
    .schedule div { display: flex; flex-wrap: wrap; gap: 4px 16px; }
    .schedule dd { margin: 0; }
    .confirmation { padding: 16px 0 0; margin-top: 22px; border-top: 1px solid #c7d9d2; }
    .confirmation label { display: flex; gap: 10px; align-items: flex-start; }
    .confirmation input { margin: 5px 0 0; width: 18px; height: 18px; flex: none; accent-color: #174c43; }
  </style>
</head>
<body>
  <main${wide ? ' class="notice"' : ''}>
    <h1>${escapeHtml(heading)}</h1>
    ${content}
  </main>
  <footer><a href="https://beian.miit.gov.cn/">桂ICP备2026027233号-1</a></footer>
</body>
</html>`
}

export function renderPilotNotice(schedule, { confirmation = false, canReturn = false, error = false } = {}) {
  const { title, intro, sections } = pilotNoticeCopy(schedule)
  const blocks = sections.map(({ title: heading, dates, paragraphs }) => {
    const times = dates?.length ? `<dl class="schedule" aria-label="本轮安排 北京时间">${dates.map(([label, value]) =>
      `<div><dt>${label}</dt><dd>${value}（北京时间）</dd></div>`).join('')}</dl>` : ''
    return `<section><h2>${escapeHtml(heading)}</h2>${times}${paragraphs.map(({ text, emphasis, link }) => {
      const body = escapeHtml(text)
      const source = link ? ` <a href="${escapeHtml(link.url)}">${escapeHtml(link.text)}</a>` : ''
      return `<p>${emphasis ? `<strong>${body}</strong>` : body}${source}</p>`
    }).join('')}</section>`
  }).join('')
  const action = confirmation ? `<form class="confirmation" method="post" action="${PILOT_NOTICE_PATH}">
      ${error ? '<p class="error" role="alert">请勾选已阅读，再确认进入体验。</p>' : ''}
      <label><input type="checkbox" name="notice_version" value="${PILOT_NOTICE_VERSION}" required> 我已阅读并确认以上说明，愿意参加本轮试用。</label>
      <button type="submit">确认并进入体验</button>
    </form>` : `<p><a href="${canReturn ? '/' : '/__pilot/login'}">${canReturn ? '返回学生事务管家' : '返回邀请码页'}</a></p>`
  return renderPilotPage(title, `<p>${escapeHtml(intro)}</p>${blocks}${action}`, true)
}
