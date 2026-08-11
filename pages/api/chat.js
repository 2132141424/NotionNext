
/**
 * Coze API 代理端点
 * 前端调用 /api/chat，由 Vercel 服务端转发到 Coze API
 * PAT 从 Vercel 环境变量读取，不暴露到浏览器
 *
 * 需要配置的 Vercel 环境变量（Settings → Environment Variables）：
 *   COZE_PAT      - 扣子国际版个人访问令牌（Personal Access Token）
 *   COZE_BOT_ID   - 扣子 Bot ID
 */

export const config = {
  api: {
    bodyParser: true,
    responseLimit: false
  },
  maxDuration: 60
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message, conversationId } = req.body || {}

  if (!message) {
    return res.status(400).json({ error: 'Message is required' })
  }

  const PAT = process.env.COZE_PAT
  const BOT_ID = process.env.COZE_BOT_ID

  if (!PAT || !BOT_ID) {
    console.error('[Coze API] Missing COZE_PAT or COZE_BOT_ID')
    return res.status(500).json({ error: 'Server misconfigured' })
  }

  try {
    const body = {
      bot_id: BOT_ID,
      user_id: 'blog_visitor',
      stream: true,
      additional_messages: [
        { role: 'user', content: message, content_type: 'text' }
      ]
    }

    // 如果有历史会话 ID，传入以实现多轮对话
    if (conversationId) {
      body.conversation_id = conversationId
    }

    const response = await fetch('https://api.coze.com/v3/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAT}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[Coze API] HTTP ${response.status}:`, errText)
      return res.status(response.status).json({
        error: `Coze API 返回 ${response.status}`
      })
    }

    // 收集 SSE 流式响应
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let newConversationId = conversationId || null
    let replyText = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      // 保留最后一行不完整的部分
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const jsonStr = trimmed.slice(5).trim()
        if (jsonStr === '[DONE]') continue

        try {
          const event = JSON.parse(jsonStr)

          // 提取 conversation_id（首次出现）
          if (!newConversationId && event.conversation_id) {
            newConversationId = event.conversation_id
          }

          // 收集助手回复内容
          if (event.type === 'answer' && event.content) {
            replyText += event.content
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }

    return res.status(200).json({
      reply: replyText || '(AI 未返回内容)',
      conversationId: newConversationId
    })
  } catch (error) {
    console.error('[Coze API] Error:', error.message)
    return res.status(500).json({
      error: error.message || 'Internal server error'
    })
  }
}
