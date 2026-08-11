
import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY_SESSION = 'coze_chat_session_id'
const STORAGE_KEY_CONV = 'coze_chat_conversation_id'
const STORAGE_KEY_MSGS = 'coze_chat_messages'

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function makeMessage(role, text) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text
  }
}

/**
 * 浏览器端 AI 聊天组件
 * - 调用 /api/chat 代理 Coze API
 * - localStorage 存储 sessionId、conversationId、历史消息
 */
export default function CozeChat() {
  const title = 'AI 助手'
  const welcome = '你好！我是水鱼Blog的 AI 助手，可以问我任何问题。'

  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // 初始化：从 localStorage 读取
  const [sessionId, setSessionId] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    // 仅在浏览器端执行
    let sid = localStorage.getItem(STORAGE_KEY_SESSION)
    if (!sid) {
      sid = uuid()
      localStorage.setItem(STORAGE_KEY_SESSION, sid)
    }
    setSessionId(sid)

    const cid = localStorage.getItem(STORAGE_KEY_CONV) || ''
    setConversationId(cid)

    try {
      const saved = localStorage.getItem(STORAGE_KEY_MSGS)
      if (saved) {
        setMessages(JSON.parse(saved))
      } else {
        setMessages([makeMessage('assistant', welcome)])
      }
    } catch {
      setMessages([makeMessage('assistant', welcome)])
    }

    setHydrated(true)
  }, [])

  // 持久化消息和会话 ID
  const persistMessages = useCallback((msgs) => {
    setMessages(msgs)
    try {
      localStorage.setItem(STORAGE_KEY_MSGS, JSON.stringify(msgs.slice(-100)))
    } catch {
      // localStorage 满了就清老消息
      localStorage.setItem(STORAGE_KEY_MSGS, JSON.stringify(msgs.slice(-30)))
    }
  }, [])

  const persistConversationId = useCallback((cid) => {
    setConversationId(cid)
    if (cid) {
      localStorage.setItem(STORAGE_KEY_CONV, cid)
    }
  }, [])

  const ask = async (event) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || loading || !hydrated) return

    const nextMessages = [...messages, makeMessage('user', text)]
    persistMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId: conversationId || undefined
        })
      })

      const data = await response.json()

      if (response.ok && data.reply) {
        if (data.conversationId) {
          persistConversationId(data.conversationId)
        }
        persistMessages([...nextMessages, makeMessage('assistant', data.reply)])
      } else {
        persistMessages([
          ...nextMessages,
          makeMessage('assistant', data.error || '请求失败，请稍后再试。')
        ])
      }
    } catch {
      persistMessages([
        ...nextMessages,
        makeMessage('assistant', '网络请求失败，请检查网络后重试。')
      ])
    } finally {
      setLoading(false)
    }
  }

  const clearHistory = () => {
    setConversationId('')
    localStorage.removeItem(STORAGE_KEY_CONV)
    localStorage.removeItem(STORAGE_KEY_MSGS)
    setMessages([makeMessage('assistant', welcome)])
  }

  if (!hydrated) return null

  return (
    <div className='coze-chat'>
      {open && (
        <section className='coze-chat-panel' aria-label={title}>
          <header>
            <strong>{title}</strong>
            <div className='coze-chat-header-actions'>
              <button
                type='button'
                onClick={clearHistory}
                title='清除对话历史'
                aria-label='清除对话历史'
              >
                ↺
              </button>
              <button
                type='button'
                onClick={() => setOpen(false)}
                aria-label='关闭 AI 助手'
              >
                ×
              </button>
            </div>
          </header>
          <div className='coze-chat-messages'>
            {messages.map(msg => (
              <p key={msg.id} className={`coze-chat-message ${msg.role}`}>
                {msg.text}
              </p>
            ))}
            {loading && (
              <p className='coze-chat-message assistant'>正在思考...</p>
            )}
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
        className='coze-chat-fab'
        type='button'
        onClick={() => setOpen(true)}
      >
        AI
      </button>
      <style jsx>{`
        .coze-chat {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 50;
          font-size: 14px;
        }
        .coze-chat-fab {
          border: 0;
          border-radius: 999px;
          width: 50px;
          height: 50px;
          color: white;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          box-shadow: 0 14px 35px rgba(99, 102, 241, 0.32);
          font-weight: 700;
          font-size: 16px;
        }
        .coze-chat-panel {
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
        .coze-chat-header-actions {
          display: flex;
          gap: 8px;
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
          font-size: 18px;
          line-height: 1;
        }
        .coze-chat-messages {
          display: flex;
          flex: 1;
          flex-direction: column;
          gap: 10px;
          min-height: 0;
          padding: 14px;
          overflow-y: auto;
          background: linear-gradient(180deg, #f8fafc, #eef6f7);
        }
        .coze-chat-message {
          max-width: 86%;
          margin: 0;
          padding: 10px 12px;
          border-radius: 14px;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          line-height: 1.65;
        }
        .coze-chat-message.user {
          align-self: flex-end;
          border-bottom-right-radius: 4px;
          color: white;
          background: #6366f1;
        }
        .coze-chat-message.assistant {
          align-self: flex-start;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-bottom-left-radius: 4px;
          color: #172033;
          background: white;
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
          border-color: #6366f1;
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
          background: #6366f1;
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
        :global(.dark) .coze-chat-panel {
          border-color: rgba(148, 163, 184, 0.18);
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
        :global(.dark) .coze-chat-messages {
          background: linear-gradient(180deg, #111827, #0f172a);
        }
        :global(.dark) .coze-chat-message.assistant {
          color: #e5edf7;
          background: #1e293b;
        }
      `}</style>
    </div>
  )
}
