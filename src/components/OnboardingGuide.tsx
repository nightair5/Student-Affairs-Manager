import { ArrowLeft, ArrowRight, Check, ClipboardPaste, ListChecks, Sparkles, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useDialogFocusTrap } from '../lib/useDialogFocusTrap'

interface OnboardingGuideProps {
  onClose: () => void
}

const steps = [
  {
    eyebrow: '第 1 步 · 收到通知',
    title: '直接粘贴，不用先整理',
    description: '把老师消息、群通知或网页正文原样粘进首页。文件、PDF 和截图则点“上传文件或链接”。不用自己先找日期，也不用先想分类。',
    icon: ClipboardPaste,
    points: ['图片与扫描 PDF 在本机 OCR，先核对文字再整理', '公网 HTTPS 链接需逐次授权；登录或反爬页面可粘贴正文', 'DeepSeek 或本地规则只给建议，不会直接建任务'],
  },
  {
    eyebrow: '第 2 步 · 核对拆分',
    title: '先看拆成几件事，再决定',
    description: '系统会按时间点和编号清单拆成多条。你先检查标题与时间；大多数时候直接“全部添加”即可，只有不准确时才展开编辑。',
    icon: ListChecks,
    points: ['每条任务都有自己的时间和来源依据', '不需要的事项可单独移除', '关闭面板不会丢失，稍后可在“待确认”继续'],
  },
  {
    eyebrow: '第 3 步 · 每天执行',
    title: '打开首页，只看前三件',
    description: '确认后任务会回到今日首页。先按“下一步”行动，完成一件就勾掉一件；其余任务留在任务中心，不必一次管理全部。',
    icon: Sparkles,
    points: ['首页最多突出三项当前行动，点击任务可修改', '内容仅保存在当前浏览器，换设备不会自动同步', '定期从“更多 → 隐私与数据”导出 JSON 备份'],
  },

]

export function OnboardingGuide({ onClose }: OnboardingGuideProps) {
  const [step, setStep] = useState(0)
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const current = steps[step]
  const Icon = current.icon

  useDialogFocusTrap(dialogRef, onClose, closeRef)

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [step])

  return <div className="modal-backdrop guide-backdrop" role="presentation">
    <section ref={dialogRef} className="onboarding-guide" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="guide-header">
        <div className="guide-brand"><span><Sparkles size={18} /></span><strong>3 步开始使用</strong></div>
        <button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="关闭新手教程"><X size={19} /></button>
      </header>
      <div className="guide-progress" aria-label={`教程进度：第 ${step + 1} 步，共 ${steps.length} 步`}>
        {steps.map((item, index) => <span key={item.title} className={index <= step ? 'active' : ''} />)}
      </div>
      <div ref={contentRef} className="guide-content" aria-live="polite">
        <div className="guide-illustration" aria-hidden="true"><span>{step + 1}</span><Icon size={42} strokeWidth={1.4} /></div>
        <div>
          <span className="eyebrow">{current.eyebrow}</span>
          <h2 id={titleId}>{current.title}</h2>
          <p>{current.description}</p>
          <ul>{current.points.map((point) => <li key={point}><Check size={15} />{point}</li>)}</ul>
        </div>
      </div>
      <footer className="guide-footer">
        <button className="text-button" type="button" onClick={onClose}>跳过，以后从“更多”重看</button>
        <div>
          {step > 0 && <button className="secondary-button" type="button" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={16} />上一步</button>}
          {step < steps.length - 1
            ? <button className="primary-button" type="button" onClick={() => setStep((value) => value + 1)}>下一步<ArrowRight size={16} /></button>
            : <button className="primary-button" type="button" onClick={onClose}>开始使用<Check size={16} /></button>}
        </div>
      </footer>
    </section>
  </div>
}
