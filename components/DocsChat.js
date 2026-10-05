import { siteConfig } from '@/lib/config'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'

const MAX_INDEX_HITS = 1000
const RETRIEVE_TOP = 4
const EXCERPT_CHARS = 1200
const MAX_TITLE_LIST = 80
const HISTORY_LIMIT = 6
// 低于这个分数基本是噪声命中，宁可不给正文，让模型照实说没找到
const MIN_SCORE = 20

// 全站索引只在浏览器里拉一次，后续提问直接复用
let indexCache = null

const loadIndex = async () => {
  if (indexCache) return indexCache
  const appId = siteConfig('ALGOLIA_APP_ID')
  const key = siteConfig('ALGOLIA_SEARCH_ONLY_APP_KEY')
  const index = siteConfig('ALGOLIA_INDEX')
  if (!appId || !key || !index) return []

  const response = await fetch(
    `https://${appId}-dsn.algolia.net/1/indexes/${index}/query`,
    {
      method: 'POST',
      headers: {
        'X-Algolia-Application-Id': appId,
        'X-Algolia-API-Key': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: '', hitsPerPage: MAX_INDEX_HITS })
    }
  )
  if (!response.ok) {
    throw new Error(`索引加载失败 HTTP ${response.status}`)
  }
  const data = await response.json()
  indexCache = data.hits || []
  return indexCache
}

const postUrl = record => {
  const slug = record?.slug || ''
  if (!slug) return ''
  return slug.startsWith('/') ? slug : `/${slug}`
}

// Algolia 默认不对中文分词，中文长句检索几乎命中不了，
// 所以把索引整体拉到本地，用字/二字组合自己打分
const STOPWORDS = new Set([
  '的', '了', '是', '在', '我', '你', '他', '她', '它', '和', '与', '就', '都',
  '也', '有', '吗', '呢', '吧', '这', '那', '个', '些', '们', '为', '之', '其',
  '及', '或', '很', '好', '要', '会', '到', '把', '被', '对', '从', '但', '而',
  '并', '等', '中', '上', '下', '里', '一', '二', '三', '不', '能', '可', '以',
  '什', '么', '怎', '如', '何', '请', '问', '哪', '谁', '时', '候', '多', '少',
  '样', '没', '来', '去', '说', '看', '想', '知', '道', '用', '做', '给', '让'
])

const tokenize = text => {
  const words = new Set()
  const singles = new Set()
  const lower = text.toLowerCase()
  ;(lower.match(/[a-z0-9_+#-]{2,}/g) || []).forEach(token => words.add(token))
  ;(text.match(/[\u4e00-\u9fa5]+/g) || []).forEach(run => {
    for (let i = 0; i < run.length; i++) {
      if (i + 1 < run.length) {
        const bigram = run.slice(i, i + 2)
        // 「的博」这类全由虚词拼成的二字组合没有区分度
        if (!(STOPWORDS.has(run[i]) && STOPWORDS.has(run[i + 1]))) {
          words.add(bigram)
        }
      }
      if (!STOPWORDS.has(run[i])) singles.add(run[i])
    }
  })
  // 有二字词时不再掺单字，单字命中太泛会带来噪声
  return words.size > 0 ? [...words] : [...singles]
}

const countOccurrences = (haystack, needle) => {
  if (!haystack || !needle) return 0
  let count = 0
  let cursor = haystack.indexOf(needle)
  while (cursor !== -1) {
    count++
    cursor = haystack.indexOf(needle, cursor + needle.length)
  }
  return count
}

const scoreRecord = (record, tokens) => {
  const title = (record.title || '').toLowerCase()
  const meta = `${(record.tags || []).join(' ')} ${record.category || ''}`.toLowerCase()
  const summary = (record.summary || '').toLowerCase()
  const content = (record.content || '').toLowerCase()

  let score = 0
  for (const token of tokens) {
    // 二字词更能代表意图，单字只做兜底
    const weight = token.length >= 2 ? 2 : 1
    score += countOccurrences(title, token) * 6 * weight
    score += countOccurrences(meta, token) * 4 * weight
    score += countOccurrences(summary, token) * 3 * weight
    score += Math.min(countOccurrences(content, token), 5) * weight
  }
  return score
}

const retrieve = (records, question, currentSlug) => {
  const tokens = tokenize(question)
  const scored = records
    .map(record => ({ record, score: scoreRecord(record, tokens) }))
    .filter(item => item.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)

  const top = scored.slice(0, RETRIEVE_TOP).map(item => item.record)

  // 用户正在看的这篇优先塞进上下文
  const current = records.find(record => postUrl(record) === currentSlug)
  if (current && !top.includes(current)) {
    top.unshift(current)
  }
  return top.slice(0, RETRIEVE_TOP + 1)
}

const buildSystemPrompt = (records, hits, currentPath) => {
  const title = siteConfig('TITLE')
  const description = siteConfig('DESCRIPTION')
  const lines = [
    `你是「${title}」的站内 AI 助手。`,
    `站点简介：${description || '一个个人博客'}`,
    '必须使用简体中文回答，语气友好、直接。',
    '只依据下面给出的站点资料回答；资料里没有的内容就直说没找到，不要编造文章、链接或事实。',
    '回答尽量简短。引用文章时用 Markdown 链接，格式必须是 [标题](/article/xxx)。'
  ]
  if (currentPath) {
    lines.push(`用户当前正在浏览：${currentPath}`)
  }

  const titles = records
    .slice(0, MAX_TITLE_LIST)
    .map(record => `- ${record.title}（${postUrl(record)}）`)
  if (titles.length > 0) {
    lines.push('', '站点文章列表：', ...titles)
  }

  if (hits.length > 0) {
    lines.push('', '与问题最相关的文章正文：')
    hits.forEach((record, index) => {
      lines.push(
        `【${index + 1}】${record.title}`,
        `链接：${postUrl(record)}`,
        `正文：${(record.content || '').slice(0, EXCERPT_CHARS)}`,
        ''
      )
    })
  }
  return lines.join('\n')
}

const streamChat = async ({ endpoint, model, system, history, onDelta }) => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: 'system', content: system }, ...history]
    })
  })

  if (!response.ok) {
    throw new Error(
      response.status === 429 ? 'rate-limit' : `HTTP ${response.status}`
    )
  }

  // 免费通道偶尔忽略 stream 参数，直接按整包 JSON 处理
  if (!response.body || !response.body.getReader) {
    const data = await response.json()
    onDelta(data.choices?.[0]?.message?.content || '')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE 的 JSON 可能被切在两个 chunk 里，只处理完整的行
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const chunk = JSON.parse(payload)
        const delta = chunk.choices?.[0]?.delta?.content
        if (delta) onDelta(delta)
      } catch {
        // 忽略不完整的片段
      }
    }
  }
}

const LINK_PATTERN = /\[([^\]]+)\]\(\s*([^)\s]+)\s*\)/g

// 模型输出是纯文本，只把 Markdown 链接转成 <a>，其余原样展示，避免 XSS
const renderText = text => {
  const nodes = []
  let lastIndex = 0
  let match
  LINK_PATTERN.lastIndex = 0

  while ((match = LINK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const href = match[2]
    if (href.startsWith('/') || /^https?:\/\//.test(href)) {
      const external = !href.startsWith('/')
      nodes.push(
        <a
          key={`${match.index}-${href}`}
          href={href}
          target={external ? '_blank' : undefined}
          rel={external ? 'noreferrer' : undefined}
        >
          {match[1]}
        </a>
      )
    } else {
      nodes.push(match[0])
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

const makeMessage = (role, text) => ({
  id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  role,
  text
})

export default function DocsChat() {
  const endpoint = siteConfig('AI_CHAT_ENDPOINT')
  const model = siteConfig('AI_CHAT_MODEL')
  const title = siteConfig('AI_CHAT_TITLE', 'AI 助手')
  const welcome = siteConfig(
    'AI_CHAT_WELCOME',
    '你好，我是这个站点的 AI 助手。你可以问我站点内容相关问题。'
  )
  const router = useRouter()
  // 文章页的 asPath 可能带锚点或查询串，比对索引时要去掉
  const currentPath = (router?.asPath || '').split(/[?#]/)[0]

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [messages, setMessages] = useState([makeMessage('assistant', welcome)])
  const indexRef = useRef(null)

  // 首次打开面板时才加载全站索引
  useEffect(() => {
    if (!open || indexRef.current) return
    let cancelled = false
    loadIndex()
      .then(records => {
        if (!cancelled) indexRef.current = records
      })
      .catch(() => {
        if (!cancelled) {
          indexRef.current = []
          setNotice('站点索引加载失败，仍可提问，但可能答不出文章细节。')
        }
      })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!endpoint) return null

  const ask = async event => {
    event.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    const userMessage = makeMessage('user', question)
    const replyId = `assistant-${Date.now()}-reply`
    const history = [...messages, userMessage]
    setMessages([...history, { id: replyId, role: 'assistant', text: '' }])
    setInput('')
    setLoading(true)
    setNotice('')

    try {
      const records = indexRef.current || (await loadIndex().catch(() => []))
      indexRef.current = records
      const hits = retrieve(records, question, currentPath)
      const system = buildSystemPrompt(records, hits, currentPath)

      let answer = ''
      await streamChat({
        endpoint,
        model,
        system,
        history: history
          .slice(-HISTORY_LIMIT)
          .map(message => ({ role: message.role, content: message.text })),
        onDelta: delta => {
          answer += delta
          setMessages(previous =>
            previous.map(message =>
              message.id === replyId ? { ...message, text: answer } : message
            )
          )
        }
      })

      if (!answer) {
        setMessages(previous =>
          previous.map(message =>
            message.id === replyId
              ? { ...message, text: '模型这次没有返回内容，请再问一次。' }
              : message
          )
        )
      }
    } catch (error) {
      const text =
        error?.message === 'rate-limit'
          ? '免费通道大约每 15 秒只能回答一次，请稍等片刻再问。'
          : '请求失败，请稍后再试。'
      setMessages(previous =>
        previous.map(message =>
          message.id === replyId ? { ...message, text } : message
        )
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='docs-chat'>
      {open && (
        <section className='docs-chat-panel' aria-label={title}>
          <header>
            <strong>{title}</strong>
            <button
              type='button'
              onClick={() => setOpen(false)}
              aria-label='关闭 AI 助手'
            >
              ×
            </button>
          </header>
          <div className='docs-chat-messages'>
            {messages.map(message => (
              <p
                key={message.id}
                className={`docs-chat-message ${message.role}`}
              >
                {message.text ? renderText(message.text) : '正在思考...'}
              </p>
            ))}
            {notice && <p className='docs-chat-notice'>{notice}</p>}
          </div>
          <form onSubmit={event => void ask(event)}>
            <textarea
              value={input}
              maxLength={1000}
              rows={2}
              placeholder='输入你的问题'
              onChange={event => setInput(event.target.value)}
            />
            <button
              type='submit'
              disabled={loading || !input.trim()}
              aria-label='发送'
            >
              ↑
            </button>
          </form>
        </section>
      )}
      <button
        className='docs-chat-fab'
        type='button'
        onClick={() => setOpen(true)}
      >
        {title}
      </button>
      <style jsx>{`
        .docs-chat {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 50;
          font-size: 14px;
        }
        .docs-chat-fab {
          border: 0;
          border-radius: 999px;
          padding: 12px 18px;
          color: white;
          background: linear-gradient(135deg, #0f766e, #2563eb);
          box-shadow: 0 14px 35px rgba(15, 118, 110, 0.32);
          font-weight: 700;
        }
        .docs-chat-panel {
          display: flex;
          flex-direction: column;
          width: min(380px, calc(100vw - 28px));
          height: min(560px, calc(100vh - 92px));
          margin-bottom: 12px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.24);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.96);
          box-shadow: 0 24px 70px rgba(15, 23, 42, 0.22);
          backdrop-filter: blur(16px);
        }
        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.18);
          color: #0f172a;
        }
        header button {
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border: 0;
          border-radius: 999px;
          background: #f1f5f9;
          color: #475569;
          font-size: 22px;
          line-height: 1;
        }
        .docs-chat-messages {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 10px;
          min-height: 0;
          padding: 14px;
          overflow-y: auto;
          background: linear-gradient(180deg, #f8fafc, #eef6f7);
        }
        .docs-chat-message {
          max-width: 86%;
          margin: 0;
          padding: 10px 12px;
          border-radius: 14px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.65;
        }
        .docs-chat-message.user {
          align-self: flex-end;
          border-bottom-right-radius: 4px;
          color: white;
          background: #2563eb;
        }
        .docs-chat-message.assistant {
          align-self: flex-start;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-bottom-left-radius: 4px;
          color: #172033;
          background: white;
        }
        .docs-chat-message a {
          color: #2563eb;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .docs-chat-message.user a {
          color: #dbeafe;
        }
        .docs-chat-notice {
          margin: 0;
          padding: 8px 10px;
          border-radius: 10px;
          color: #92400e;
          background: #fef3c7;
          font-size: 12px;
        }
        form {
          position: relative;
          padding: 12px;
          border-top: 1px solid rgba(148, 163, 184, 0.18);
          background: white;
        }
        textarea {
          width: 100%;
          min-height: 58px;
          resize: none;
          border: 1px solid #d8e0ea;
          border-radius: 12px;
          padding: 10px 48px 10px 12px;
          outline: none;
          color: #0f172a;
          background: #f8fafc;
          font: inherit;
        }
        textarea:focus {
          border-color: #0f766e;
          background: white;
        }
        form button {
          position: absolute;
          right: 22px;
          bottom: 22px;
          width: 34px;
          height: 34px;
          border: 0;
          border-radius: 999px;
          color: white;
          background: #0f766e;
          font-size: 20px;
          font-weight: 800;
        }
        button {
          cursor: pointer;
        }
        button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
        :global(.dark) .docs-chat-panel {
          border-color: rgba(148, 163, 184, 0.22);
          background: rgba(15, 23, 42, 0.96);
        }
        :global(.dark) header,
        :global(.dark) textarea {
          color: #e5edf7;
        }
        :global(.dark) header,
        :global(.dark) form {
          background: #0f172a;
        }
        :global(.dark) header button,
        :global(.dark) textarea {
          background: #1e293b;
        }
        :global(.dark) .docs-chat-messages {
          background: linear-gradient(180deg, #111827, #0f172a);
        }
        :global(.dark) .docs-chat-message.assistant {
          color: #e5edf7;
          background: #1e293b;
        }
        :global(.dark) .docs-chat-message a {
          color: #7dd3fc;
        }
      `}</style>
    </div>
  )
}
