#!/usr/bin/env node

/**
 * 构建后生成 Markdown 版本页面
 *
 * 目的：配合 vercel.json 中基于 Accept 头的重写，让请求头带
 * `Accept: text/markdown` 的客户端（AI Agent / 爬虫）拿到 Markdown，
 * 普通浏览器仍然拿到 HTML。
 *
 * 输入：next export 产物 out/**.html
 * 输出：out/md/**.md（与页面路由一一对应）
 *
 * 说明：heo 主题的页面主体由客户端渲染，静态 HTML 里只有数据。
 * 因此 Markdown 由页面内嵌的 __NEXT_DATA__（标题/分类/标签/目录/文章列表）
 * 与 meta description 生成。
 */

const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(process.cwd(), 'out')
const MD_DIR = path.join(OUT_DIR, 'md')

// 这些目录下的 html 不是可访问的路由页面
const SKIP_DIRS = new Set(['_next', 'md'])

function parseNextData(html) {
  const match = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
    html
  )
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch (e) {
    return null
  }
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '')
}

function getAttr(attrs, name) {
  const match = new RegExp(
    `${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i'
  ).exec(attrs)
  return match ? (match[2] ?? match[3] ?? match[4] ?? '') : ''
}

function getMeta(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of tags) {
    const key = getAttr(tag, 'name') || getAttr(tag, 'property')
    if (key && key.toLowerCase() === name.toLowerCase()) {
      return getAttr(tag, 'content')
    }
  }
  return ''
}

function getPageTitle(html) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return match ? stripTags(match[1]).replace(/\s+/g, ' ').trim() : ''
}

function toAbsolute(url, siteUrl) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${siteUrl}${url.startsWith('/') ? '' : '/'}${url}`
}

/** 文章类页面：标题 + 元信息 + 摘要 + 目录 */
function renderPost(post, html, siteUrl) {
  const lines = [`# ${post.title}`]
  lines.push(`> 原文：${toAbsolute(post.href, siteUrl)}`)

  const meta = []
  if (post.category) meta.push(`分类：${post.category}`)
  if (Array.isArray(post.tags) && post.tags.length)
    meta.push(`标签：${post.tags.join('、')}`)
  if (post.publishDay) meta.push(`发布：${post.publishDay}`)
  if (post.wordCount) meta.push(`字数：约 ${post.wordCount} 字`)
  if (meta.length) lines.push(meta.join(' | '))

  const description = getMeta(html, 'description')
  if (description) {
    lines.push('')
    lines.push(`> ${description}`)
  }

  const toc = Array.isArray(post.toc) ? post.toc : []
  if (toc.length) {
    lines.push('')
    lines.push('## 目录')
    lines.push('')
    for (const item of toc) {
      if (!item?.text) continue
      const indent = item.indentLevel ? '  '.repeat(item.indentLevel) : ''
      lines.push(`${indent}- ${item.text}`)
    }
  }

  return lines.join('\n')
}

/** 列表类页面：标题 + 站点说明 + 文章列表 */
function renderList(pageTitle, siteInfo, posts, html, siteUrl, canonical) {
  const title = (pageTitle || siteInfo?.title || '文章列表')
    .replace(/\s+/g, ' ')
    .trim()
  const lines = [`# ${title}`, `> 原文：${canonical}`]

  const description = siteInfo?.description || getMeta(html, 'description')
  if (description) {
    lines.push('')
    lines.push(`> ${description}`)
  }

  const list = (Array.isArray(posts) ? posts : []).filter(p => p?.title)
  if (list.length) {
    lines.push('')
    lines.push('## 文章列表')
    lines.push('')
    for (const post of list) {
      const url = toAbsolute(post.href, siteUrl)
      const extra = [post.publishDay, post.category].filter(Boolean).join(' · ')
      const tags =
        Array.isArray(post.tags) && post.tags.length
          ? `（标签：${post.tags.join('、')}）`
          : ''
      lines.push(`- [${post.title}](${url})${extra ? ` — ${extra}` : ''}${tags}`)
    }
  }

  return lines.join('\n')
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue
      walk(full, files)
    } else if (entry.name.endsWith('.html')) {
      files.push(full)
    }
  }
  return files
}

function readSiteUrl() {
  const robots = path.join(OUT_DIR, 'robots.txt')
  if (!fs.existsSync(robots)) return ''
  const match = /Sitemap:\s*(\S+)\/sitemap\.xml/.exec(
    fs.readFileSync(robots, 'utf8')
  )
  return match ? match[1] : ''
}

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    console.warn('[markdown] 未找到 out/ 目录，跳过生成')
    return
  }

  const siteUrl = readSiteUrl()
  const htmlFiles = walk(OUT_DIR)
  let count = 0

  for (const file of htmlFiles) {
    const rel = path.relative(OUT_DIR, file).replace(/\\/g, '/')
    const routePath = rel
      .replace(/index\.html$/, '')
      .replace(/\.html$/, '')
      .replace(/\/$/, '')
    const mdRel = routePath ? `${routePath}.md` : 'index.md'
    const mdFile = path.join(MD_DIR, mdRel)

    const html = fs.readFileSync(file, 'utf8')
    const data = parseNextData(html)
    const pageProps = data?.props?.pageProps || {}
    const canonical = routePath ? `${siteUrl}/${routePath}` : `${siteUrl}/`

    let content = ''
    if (pageProps.post?.title) {
      content = renderPost(pageProps.post, html, siteUrl)
    } else {
      const posts = pageProps.posts || pageProps.latestPosts
      // 首页用站点标题，其余页面用 <title>
      const pageTitle = routePath
        ? getPageTitle(html)
        : pageProps.siteInfo?.title || getPageTitle(html)
      content = renderList(
        pageTitle,
        pageProps.siteInfo,
        posts,
        html,
        siteUrl,
        canonical
      )
    }

    if (!content.trim()) continue

    fs.mkdirSync(path.dirname(mdFile), { recursive: true })
    fs.writeFileSync(mdFile, `${content.trim()}\n`, 'utf8')
    count++
  }

  console.log(`[markdown] 已生成 ${count} 个 Markdown 页面 → out/md/`)
}

main()
