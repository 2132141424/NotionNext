import { useEffect } from 'react'
import { useRouter } from 'next/router'

/**
 * 通过 Umami 公开分享 token 拉取站点统计数据，填充到 NotionNext 各主题现有的
 * busuanzi 展示节点中：
 * - 全站浏览量 / 访客数：.busuanzi_value_site_pv / .busuanzi_value_page_pv / .busuanzi_value_site_uv
 * - 当前文章阅读量（单页 PV）：.umami_value_post_pv
 */
const DEFAULT_API_BASE = 'https://cloud.umami.is/analytics/us/api'

export default function UmamiShareAnalytics({ shareToken, apiBase }) {
  const router = useRouter()

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

    // 缓存 share token 解析结果，避免 SPA 路由切换时重复请求
    let websiteCache = null

    const resolveWebsite = async () => {
      if (websiteCache) return websiteCache
      const base = apiBase || DEFAULT_API_BASE
      const shareRes = await fetch(`${base}/share/${shareToken}`)
      if (!shareRes.ok) return null
      const shareData = await shareRes.json()
      const websiteId = shareData?.websiteId
      const accessToken = shareData?.token
      if (!websiteId || !accessToken) return null
      websiteCache = { base, websiteId, accessToken }
      return websiteCache
    }

    const load = async () => {
      // 先加载站点快照（stats.json），秒显避免空白；后台再拉实时值覆盖
      try {
        const snapRes = await fetch('/stats.json')
        if (snapRes.ok && !cancelled) {
          const snap = await snapRes.json()
          setText('busuanzi_value_site_pv', snap?.pageviews ?? 0)
          setText('busuanzi_value_page_pv', snap?.pageviews ?? 0)
          setText('busuanzi_value_site_uv', snap?.visitors ?? 0)
          reveal('busuanzi_container_site_pv')
          reveal('busuanzi_container_page_pv')
          reveal('busuanzi_container_site_uv')

          // 单页 PV 快照：按当前路径从 pages 映射中秒显，后台再实时覆盖
          const path = window.location.pathname
          if (path && path !== '/') {
            const pagePv = snap?.pages?.[path]
            if (typeof pagePv === 'number') {
              setText('umami_value_post_pv', pagePv)
            }
          }
        }
      } catch (e) {
        // 快照加载失败不影响后续实时拉取
      }

      try {
        const site = await resolveWebsite()
        if (!site || cancelled) return
        const { base, websiteId, accessToken } = site
        const now = Date.now()
        const headers = {
          'x-umami-share-token': accessToken,
          'x-umami-share-context': '1'
        }

        // 1. 站点全量 PV / UV
        const statsRes = await fetch(
          `${base}/websites/${websiteId}/stats?startAt=0&endAt=${now}`,
          { headers }
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

        // 2. 当前文章阅读量（单页 PV），按当前路径统计
        const path = window.location.pathname
        if (path && path !== '/') {
          const pageStatsRes = await fetch(
            `${base}/websites/${websiteId}/stats?startAt=0&endAt=${now}&path=${encodeURIComponent(path)}`,
            { headers }
          )
          if (!pageStatsRes.ok || cancelled) return
          const pageStats = await pageStatsRes.json()
          setText('umami_value_post_pv', pageStats?.pageviews ?? 0)
        } else {
          setText('umami_value_post_pv', '')
        }
      } catch (error) {
        console.error('[UmamiShareAnalytics]', error)
      }
    }

    load()

    // SPA 内导航（如切换到另一篇文章）时重新拉取单页阅读量
    router.events?.on('routeChangeComplete', load)

    return () => {
      cancelled = true
      router.events?.off('routeChangeComplete', load)
    }
  }, [shareToken, apiBase, router])

  return null
}
