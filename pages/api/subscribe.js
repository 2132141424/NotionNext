import subscribeToMailchimpApi from '@/lib/plugins/mailchimp'

const rateWindowMs = 60 * 1000
const rateLimit = 5
const hits = new Map()

const getClientIp = req => {
  const forwardedFor = req.headers['x-forwarded-for']
  const list = String(
    Array.isArray(forwardedFor) ? forwardedFor.join(',') : forwardedFor || ''
  )
    .split(',')
    .map(ip => ip.trim())
    .filter(Boolean)
  // 取可信代理追加的最后一个值，避免客户端伪造首项绕过限流
  if (list.length > 0) {
    return list[list.length - 1]
  }
  return req.socket?.remoteAddress || ''
}

const isRateLimited = key => {
  const now = Date.now()
  const recent = (hits.get(key) || []).filter(time => now - time < rateWindowMs)
  if (recent.length >= rateLimit) {
    hits.set(key, recent)
    return true
  }
  recent.push(now)
  hits.set(key, recent)
  return false
}

const isValidEmail = email =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

/**
 * 接受邮件订阅
 * @param {*} req
 * @param {*} res
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { email, firstName, lastName } = req.body

    if (!isValidEmail(email)) {
      return res
        .status(400)
        .json({ status: 'error', message: 'Invalid email address' })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const ip = getClientIp(req) || 'unknown'
    if (isRateLimited(normalizedEmail) || isRateLimited(ip)) {
      return res
        .status(429)
        .json({ status: 'error', message: 'Too many requests' })
    }

    try {
      const response = await subscribeToMailchimpApi({
        email: normalizedEmail,
        first_name: firstName,
        last_name: lastName
      })
      await response.json()
      res
        .status(200)
        .json({ status: 'success', message: 'Subscription successful!' })
    } catch (error) {
      console.error('Subscription error:', error)
      res
        .status(400)
        .json({ status: 'error', message: 'Subscription failed!' })
    }
  } else {
    res.status(405).json({ status: 'error', message: 'Method not allowed' })
  }
}
