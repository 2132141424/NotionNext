import { useEffect } from 'react'

/**
 * 通过 Umami 公开分享 token 拉取站点统计数据（浏览量 / 访客数），
 * 填充到 NotionNext 各主题现有的 busuanzi 展示节点中。
 * 复用 .busuanzi_value_* / .busuanzi_container_* 结构，无需改动主题 JSX。
 */
const DEFAULT_API_BASE = 'https://cloud.umami.is/analytics/us/api'

export default function UmamiShareAnalytics({ shareToken, apiBase }) {
  useEffect(() => {
    if (!shareToken || typeof document === 'undefined') return
    let cancelled = false

    const setText = (className, value) => {
      document.querySelectorAll(`.${className}`).forEach(el => {
        el.textContent = value
      })
    }
    const reveal = className => {
      document.querySelectorAll(`.${className}`).forEach(el => {
        el.classList.remove('hidden')
      })
    }

    const load = async () => {
      try {
        const base = apiBase || DEFAULT_API_BASE

        // 1. share token -> websiteId + 访问 token
        const shareRes = await fetch(`${base}/share/${shareToken}`)
        if (!shareRes.ok || cancelled) return
        const shareData = await shareRes.json()
        const websiteId = shareData?.websiteId
        const accessToken = shareData?.token
        if (!websiteId || !accessToken) return

        // 2. 拉取站点全量 PV / UV
        const now = Date.now()
        const statsRes = await fetch(
          `${base}/websites/${websiteId}/stats?startAt=0&endAt=${now}`,
          {
            headers: {
              'x-umami-share-token': accessToken,
              'x-umami-share-context': '1'
            }
          }
        )
        if (!statsRes.ok || cancelled) return
        const stats = await statsRes.json()

        const pageviews = stats?.pageviews ?? 0
        const visitors = stats?.visitors ?? 0

        setText('busuanzi_value_site_pv', pageviews)
        setText('busuanzi_value_page_pv', pageviews)
        setText('busuanzi_value_site_uv', visitors)

        reveal('busuanzi_container_site_pv')
        reveal('busuanzi_container_page_pv')
        reveal('busuanzi_container_site_uv')
      } catch (error) {
        console.error('[UmamiShareAnalytics]', error)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [shareToken, apiBase])

  return null
}
