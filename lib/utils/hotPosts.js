import fs from 'fs'
import path from 'path'

/**
 * 热门文章（按浏览量排行）
 *
 * 数据来源是 Umami 的浏览量快照 public/stats.json，
 * 由 .github/workflows/indexnow-daily.yml 定时抓取并提交，构建时读取。
 */

/** 去掉锚点/查询串与结尾斜杠，把同一篇文章的不同访问路径归一 */
function normalizePathname(rawPath) {
  const pathname = String(rawPath ?? '')
    .split('#')[0]
    .split('?')[0]
  if (!pathname || pathname === '/') return '/'
  return pathname.replace(/\/+$/, '')
}

/**
 * Umami 会把带锚点的访问记成独立路径（如 /article/xxx#block），
 * 这里按归一后的路径合并浏览量
 */
export function normalizePageViews(pages) {
  const result = {}
  if (!pages || typeof pages !== 'object') return result
  Object.entries(pages).forEach(([rawPath, value]) => {
    const views = Number(value)
    if (!Number.isFinite(views) || views <= 0) return
    const pathname = normalizePathname(rawPath)
    result[pathname] = (result[pathname] || 0) + views
  })
  return result
}

/**
 * 读取浏览量快照；文件缺失或格式异常时返回空表，热门榜退化为按时间排序
 */
export function readPageViewsSnapshot() {
  try {
    const file = path.join(process.cwd(), 'public', 'stats.json')
    const snapshot = JSON.parse(fs.readFileSync(file, 'utf8'))
    return normalizePageViews(snapshot?.pages)
  } catch (error) {
    console.warn('[hotPosts] 读取 stats.json 失败，热门文章将退化为按时间排序', error?.message)
    return {}
  }
}

/**
 * 按浏览量倒序取前 count 篇文章，浏览量相同则按发布时间倒序
 */
export function rankHotPosts({ allPages, postUrlPrefix, count, pageViews }) {
  const prefix = postUrlPrefix ? `/${postUrlPrefix}` : ''
  return (allPages ?? [])
    .filter(page => page?.type === 'Post' && page?.status === 'Published')
    .map(post => {
      const pathname =
        typeof post?.href === 'string' && post.href.startsWith('/')
          ? normalizePathname(post.href)
          : `${prefix}/${post?.slug}`
      return { post, views: pageViews?.[pathname] ?? 0 }
    })
    .sort((a, b) => {
      if (b.views !== a.views) return b.views - a.views
      return (b.post?.publishDate ?? 0) - (a.post?.publishDate ?? 0)
    })
    .slice(0, count)
    .map(item => ({ ...item.post, pageViews: item.views }))
}
