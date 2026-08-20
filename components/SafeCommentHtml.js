import DOMPurify from 'dompurify'

/**
 * 安全渲染不可信 HTML（如 Waline 评论正文）。
 * DOMPurify 依赖浏览器 DOM，SSR 阶段不执行消毒，直接返回 null；
 * 评论数据只在客户端 fetch 后才有，因此 SSR 时不会渲染任何内容，无闪烁。
 */
const SafeCommentHtml = ({ html, className }) => {
  if (typeof window === 'undefined') {
    return null
  }
  const sanitized = DOMPurify.sanitize(html || '', {
    FORBID_TAGS: [
      'style',
      'iframe',
      'form',
      'input',
      'button',
      'object',
      'embed',
      'link',
      'meta',
      'base',
      'svg',
      'math'
    ]
  })
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />
}

export default SafeCommentHtml
