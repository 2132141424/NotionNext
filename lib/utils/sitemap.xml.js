import BLOG from '@/blog.config'
import fs from 'fs'
import { siteConfig } from '../config'
import { isExport } from './buildMode'
import { extractLangPrefix } from './pageId'
import {
  buildSitemapLoc,
  normalizeSitemapBaseUrl,
  toSitemapDateString
} from '../sitemap-utils'

/**
 * 静态导出不会生成多语言前缀路由，这些 URL 会 404，不能写进 sitemap
 */
function getUnavailableLocalePrefixes() {
  if (!isExport()) return []
  return String(BLOG.NOTION_PAGE_ID || '')
    .split(',')
    .map(extractLangPrefix)
    .filter(Boolean)
}

/**
 * 多语言站点会把同一页面重复放进 allPages，按 loc 去重并保留最新的 lastmod
 */
function dedupeSitemapUrls(urls) {
  const uniqueUrls = new Map()
  urls.forEach(url => {
    if (!url?.loc) return
    const existing = uniqueUrls.get(url.loc)
    if (!existing || String(url.lastmod) > String(existing.lastmod)) {
      uniqueUrls.set(url.loc, url)
    }
  })
  return Array.from(uniqueUrls.values())
}

/**
 * 生成站点地图
 * @param {*} param0
 */
export function generateSitemapXml({ allPages, NOTION_CONFIG }) {
  const link = normalizeSitemapBaseUrl(
    siteConfig('LINK', BLOG.LINK, NOTION_CONFIG)
  )
  const dateNow = toSitemapDateString(new Date())
  const localePrefixes = getUnavailableLocalePrefixes()
  const isUnavailableLocaleUrl = loc =>
    localePrefixes.some(
      prefix =>
        loc === `${link}/${prefix}` || loc.startsWith(`${link}/${prefix}/`)
    )
  const urls = [
    {
      loc: buildSitemapLoc({ baseUrl: link }),
      lastmod: dateNow,
      changefreq: 'daily',
      priority: 1.0
    },
    {
      loc: buildSitemapLoc({ baseUrl: link, slug: 'archive' }),
      lastmod: dateNow,
      changefreq: 'daily',
      priority: 1.0
    },
    {
      loc: buildSitemapLoc({ baseUrl: link, slug: 'category' }),
      lastmod: dateNow,
      changefreq: 'daily'
    },
    {
      loc: buildSitemapLoc({ baseUrl: link, slug: 'tag' }),
      lastmod: dateNow,
      changefreq: 'daily'
    }
  ].filter(item => Boolean(item?.loc))
  // 循环页面生成
  allPages?.forEach(post => {
    const loc = buildSitemapLoc({
      baseUrl: link,
      slug: post?.slug
    })
    if (!loc) return

    urls.push({
      loc,
      lastmod: toSitemapDateString(post?.publishDay, dateNow),
      changefreq: 'daily'
    })
  })
  const xml = createSitemapXml(
    dedupeSitemapUrls(urls).filter(url => !isUnavailableLocaleUrl(url.loc))
  )
  try {
    fs.writeFileSync('sitemap.xml', xml)
    fs.writeFileSync('./public/sitemap.xml', xml)
  } catch (error) {
    console.warn('无法写入文件', error)
  }
}

/**
 * 生成站点地图
 * @param {*} urls
 * @returns
 */
function createSitemapXml(urls) {
  let urlsXml = ''
  urls.forEach(u => {
    urlsXml += `<url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    </url>
    `
  })

  return `
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
    xmlns:xhtml="http://www.w3.org/1999/xhtml"
    xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
    xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    ${urlsXml}
    </urlset>
    `
}
