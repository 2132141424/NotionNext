import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { createSiteUrl, normalizeSiteUrl } from '@/lib/sitemap-utils'
import { isHttpLink, loadExternalResource } from '@/lib/utils'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

/**
 * 页面的Head头，有用于SEO
 * @param {*} param0
 * @returns
 */
const SEO = props => {
  const { children, siteInfo, post, NOTION_CONFIG } = props
  const PATH = siteConfig('PATH')
  const LINK = normalizeSiteUrl(
    siteConfig('LINK', siteInfo?.link, NOTION_CONFIG)
  )
  const SUB_PATH = siteConfig('SUB_PATH', '')
  let url = PATH?.length ? createSiteUrl(LINK, SUB_PATH) || LINK : LINK
  let image
  const router = useRouter()
  const meta = getSEOMeta(props, router, useGlobal()?.locale)
  const webFontUrl = siteConfig('FONT_URL')
  const hasWebFontUrl = Array.isArray(webFontUrl)
    ? webFontUrl.filter(Boolean).length > 0
    : Boolean(webFontUrl)

  useEffect(() => {
    if (!hasWebFontUrl) return

    const timeoutId = window.setTimeout(() => {
      // 使用WebFontLoader字体加载
      loadExternalResource(
        'https://cdnjs.cloudflare.com/ajax/libs/webfont/1.6.28/webfontloader.js',
        'js'
      ).then(url => {
        const WebFont = window?.WebFont
        if (WebFont) {
          // console.log('LoadWebFont', webFontUrl)
          WebFont.load({
            custom: {
              // families: ['"LXGW WenKai"'],
              urls: webFontUrl
            }
          })
        }
      })
    }, 1500)

    return () => window.clearTimeout(timeoutId)
  }, [hasWebFontUrl, webFontUrl])

  // SEO关键词
  const KEYWORDS = siteConfig('KEYWORDS')
  let keywords = meta?.tags || KEYWORDS
  if (post?.tags && post?.tags?.length > 0) {
    keywords = post?.tags?.join(',')
  }
  if (meta) {
    url = createSiteUrl(url, meta.slug) || url
    image = getAbsoluteImageUrl(meta.image || '/bg_image.jpg', LINK)
  }
  const TITLE = siteConfig('TITLE')
  const title = meta?.title || TITLE
  const description = meta?.description || `${siteInfo?.description}`
  const type = meta?.type === 'Post' ? 'article' : meta?.type || 'website'
  const language =
    router?.locale || siteConfig('LANG', 'zh-CN', NOTION_CONFIG)
  const lang = String(language).replace('-', '_') // Facebook OpenGraph 要 zh_CN 這樣的格式才抓得到語言
  const category = Array.isArray(meta?.category)
    ? meta?.category?.[0]
    : meta?.category || KEYWORDS // section 主要是像是 category 這樣的分類，Facebook 用這個來抓連結的分類
  const favicon = siteConfig('BLOG_FAVICON')
  const BACKGROUND_DARK = siteConfig('BACKGROUND_DARK', '', NOTION_CONFIG)

  const SEO_BAIDU_SITE_VERIFICATION = siteConfig(
    'SEO_BAIDU_SITE_VERIFICATION',
    null,
    NOTION_CONFIG
  )

  const SEO_GOOGLE_SITE_VERIFICATION = siteConfig(
    'SEO_GOOGLE_SITE_VERIFICATION',
    null,
    NOTION_CONFIG
  )

  const BLOG_FAVICON = siteConfig('BLOG_FAVICON', null, NOTION_CONFIG)

  const COMMENT_WEBMENTION_ENABLE = siteConfig(
    'COMMENT_WEBMENTION_ENABLE',
    null,
    NOTION_CONFIG
  )

  const COMMENT_WEBMENTION_HOSTNAME = siteConfig(
    'COMMENT_WEBMENTION_HOSTNAME',
    null,
    NOTION_CONFIG
  )
  const COMMENT_WEBMENTION_AUTH = siteConfig(
    'COMMENT_WEBMENTION_AUTH',
    null,
    NOTION_CONFIG
  )
  const ANALYTICS_BUSUANZI_ENABLE = siteConfig(
    'ANALYTICS_BUSUANZI_ENABLE',
    null,
    NOTION_CONFIG
  )

  const FACEBOOK_PAGE = siteConfig('FACEBOOK_PAGE', null, NOTION_CONFIG)
  const TWITTER_SITE = siteConfig('TWITTER_SITE', '', NOTION_CONFIG)
  const TWITTER_CREATOR = siteConfig('TWITTER_CREATOR', '', NOTION_CONFIG)

  const AUTHOR = siteConfig('AUTHOR')
  return (
    <Head>
      <link rel='icon' href={favicon} />
      <title>{title}</title>
      <meta name='theme-color' content={BACKGROUND_DARK} />
      <meta
        name='viewport'
        content='width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=1.0'
      />
      <meta name='robots' content='follow, index, max-snippet:-1, max-image-preview:large, max-video-preview:-1' />
      <meta charSet='UTF-8' />
      <meta name='format-detection' content='telephone=no' />
      <meta name='mobile-web-app-capable' content='yes' />
      <meta name='apple-mobile-web-app-capable' content='yes' />
      <meta name='apple-mobile-web-app-status-bar-style' content='default' />
      <meta name='apple-mobile-web-app-title' content={title} />

      {/* 搜索引擎验证 */}
      {SEO_GOOGLE_SITE_VERIFICATION && (
        <meta
          name='google-site-verification'
          content={SEO_GOOGLE_SITE_VERIFICATION}
        />
      )}
      {SEO_BAIDU_SITE_VERIFICATION && (
        <meta
          name='baidu-site-verification'
          content={SEO_BAIDU_SITE_VERIFICATION}
        />
      )}

      {/* 基础SEO元数据 */}
      <link rel='canonical' href={url} />
      <meta name='keywords' content={keywords} />
      <meta name='description' content={description} />
      <meta name='author' content={AUTHOR} />
      <meta name='generator' content='NotionNext' />

      {/* 语言和地区 */}
      <meta httpEquiv='content-language' content={language} />
      <meta name='geo.region' content={siteConfig('GEO_REGION', 'CN')} />
      <meta name='geo.country' content={siteConfig('GEO_COUNTRY', 'CN')} />
      {/* Open Graph 元数据 */}
      <meta property='og:locale' content={lang} />
      <meta property='og:title' content={title} />
      <meta property='og:description' content={description} />
      <meta property='og:url' content={url} />
      <meta property='og:image' content={image} />
      <meta property='og:image:width' content='1200' />
      <meta property='og:image:height' content='630' />
      <meta property='og:image:alt' content={title} />
      <meta property='og:site_name' content={siteConfig('TITLE')} />
      <meta property='og:type' content={type} />

      {/* Twitter Card 元数据 */}
      <meta name='twitter:card' content='summary_large_image' />
      {TWITTER_SITE && <meta name='twitter:site' content={TWITTER_SITE} />}
      {TWITTER_CREATOR && (
        <meta name='twitter:creator' content={TWITTER_CREATOR} />
      )}
      <meta name='twitter:title' content={title} />
      <meta name='twitter:description' content={description} />
      <meta name='twitter:image' content={image} />
      <meta name='twitter:image:alt' content={title} />

      <link rel='icon' href={BLOG_FAVICON} />

      {COMMENT_WEBMENTION_ENABLE && (
        <>
          <link
            rel='webmention'
            href={`https://webmention.io/${COMMENT_WEBMENTION_HOSTNAME}/webmention`}
          />
          <link
            rel='pingback'
            href={`https://webmention.io/${COMMENT_WEBMENTION_HOSTNAME}/xmlrpc`}
          />
          {COMMENT_WEBMENTION_AUTH && (
            <link href={COMMENT_WEBMENTION_AUTH} rel='me' />
          )}
        </>
      )}

      {ANALYTICS_BUSUANZI_ENABLE && (
        <meta name='referrer' content='no-referrer-when-downgrade' />
      )}
      {/* 文章特定元数据 */}
      {meta?.type === 'Post' && (
        <>
          {meta.publishTime && (
            <meta property='article:published_time' content={meta.publishTime} />
          )}
          {meta.modifiedTime && (
            <meta
              property='article:modified_time'
              content={meta.modifiedTime}
            />
          )}
          <meta property='article:author' content={AUTHOR} />
          <meta property='article:section' content={category} />
          <meta property='article:tag' content={keywords} />
          {FACEBOOK_PAGE && (
            <meta property='article:publisher' content={FACEBOOK_PAGE} />
          )}
        </>
      )}

      {/* 结构化数据 */}
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateStructuredData(meta, siteInfo, url, image, AUTHOR, LINK)
          )
        }}
      />

      {/* DNS预取和预连接 */}
      {hasWebFontUrl && <link rel='dns-prefetch' href='//fonts.googleapis.com' />}
      <link rel='dns-prefetch' href='//www.google-analytics.com' />
      <link rel='dns-prefetch' href='//www.googletagmanager.com' />
      {hasWebFontUrl && (
        <link
          rel='preconnect'
          href='https://fonts.gstatic.com'
          crossOrigin='anonymous'
        />
      )}

      {children}
    </Head>
  )
}

/**
 * 生成结构化数据
 * @param {*} meta
 * @param {*} siteInfo
 * @param {*} url
 * @param {*} image
 * @param {*} author
 * @returns
 */
export const generateStructuredData = (
  meta,
  siteInfo,
  url,
  image,
  author,
  siteUrl
) => {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteInfo?.title,
    description: siteInfo?.description,
    url: siteUrl,
    author: {
      '@type': 'Person',
      name: author
    },
    publisher: {
      '@type': 'Organization',
      name: siteInfo?.title,
      logo: {
        '@type': 'ImageObject',
        url: getAbsoluteImageUrl(siteInfo?.icon, siteUrl)
      }
    }
  }

  // 如果是文章页面，添加文章结构化数据
  if (meta?.type === 'Post') {
    return {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: meta.title,
      description: meta.description,
      image: image,
      url: url,
      datePublished: meta.publishTime,
      dateModified: meta.modifiedTime || meta.publishTime,
      author: {
        '@type': 'Person',
        name: author
      },
      publisher: {
        '@type': 'Organization',
        name: siteInfo?.title,
        logo: {
          '@type': 'ImageObject',
          url: getAbsoluteImageUrl(siteInfo?.icon, siteUrl)
        }
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': url
      },
      keywords: meta.tags?.join(', '),
      articleSection: meta.category
    }
  }

  return baseData
}

const getAbsoluteImageUrl = (image, siteUrl) => {
  if (typeof image !== 'string') return ''

  const rawImage = image.trim()
  if (!rawImage) return ''
  if (isHttpLink(rawImage) || rawImage.startsWith('data:')) {
    return rawImage
  }

  return createSiteUrl(siteUrl, rawImage) || rawImage
}

const getIsoTime = value => {
  if (!value) return undefined

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined

  return date.toISOString()
}

// 搜索引擎建议的描述长度上限，超出会被截断
const META_DESCRIPTION_MAX_LENGTH = 160
// 低于该长度视为过短，需要补充页面上下文
const META_DESCRIPTION_MIN_LENGTH = 60

const normalizeDescriptionText = text =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * 组合页面描述：过滤空值、压缩空白、超长截断
 * 保证各页面的 description 互不相同且长度充足，避免被判为重复/过短
 */
const joinDescriptionText = (...parts) => {
  const text = parts.map(normalizeDescriptionText).filter(Boolean).join(' ')
  if (text.length <= META_DESCRIPTION_MAX_LENGTH) return text
  return `${text.slice(0, META_DESCRIPTION_MAX_LENGTH - 1).trimEnd()}…`
}

/**
 * 文章/单页描述：优先用摘要，摘要缺失或过短时用标题、分类、标签补足
 */
const buildPostDescription = (post, siteInfo) => {
  const summary = normalizeDescriptionText(post?.summary)
  if (summary.length >= META_DESCRIPTION_MIN_LENGTH) {
    return joinDescriptionText(summary)
  }

  const category = Array.isArray(post?.category)
    ? post?.category?.[0]
    : post?.category
  const tags = Array.isArray(post?.tags) ? post?.tags?.slice(0, 5)?.join('、') : ''
  const detail = [
    post?.title ? `本文《${post.title}》` : '',
    category ? `属于「${category}」分类` : '',
    tags ? `涉及 ${tags} 等主题` : ''
  ]
    .filter(Boolean)
    .join('，')

  return joinDescriptionText(
    summary,
    detail ? `${detail}。` : '',
    siteInfo?.description
  )
}

/**
 * 获取SEO信息
 * @param {*} props
 * @param {*} router
 */
const getSEOMeta = (props, router, locale) => {
  const { post, siteInfo, tag, category, page } = props
  const keyword = router?.query?.s

  const TITLE = siteConfig('TITLE')
  const siteTitle = siteInfo?.title
  const siteDescription = siteInfo?.description
  switch (router.route) {
    case '/':
      return {
        title: `${siteInfo?.title} | ${siteInfo?.description}`,
        description: joinDescriptionText(
          siteDescription,
          '提供文章归档、分类与标签浏览，持续更新原创文章。'
        ),
        image: `${siteInfo?.pageCover}`,
        slug: '',
        type: 'website'
      }
    case '/archive':
      return {
        title: `${locale.NAV.ARCHIVE} | ${siteInfo?.title}`,
        description: joinDescriptionText(
          `${siteTitle} 文章归档`,
          siteDescription,
          '按发布时间浏览全部文章。'
        ),
        image: `${siteInfo?.pageCover}`,
        slug: 'archive',
        type: 'website'
      }
    case '/page/[page]':
      return {
        title: `${page} | Page | ${siteInfo?.title}`,
        description: joinDescriptionText(
          `${siteTitle} 文章列表第 ${page} 页`,
          siteDescription
        ),
        image: `${siteInfo?.pageCover}`,
        slug: 'page/' + page,
        type: 'website'
      }
    case '/category/[category]':
      return {
        title: `${category} | ${locale.COMMON.CATEGORY} | ${siteInfo?.title}`,
        description: joinDescriptionText(
          `${siteTitle}「${category}」分类下的全部文章`,
          siteDescription
        ),
        slug: 'category/' + category,
        image: `${siteInfo?.pageCover}`,
        type: 'website'
      }
    case '/category/[category]/page/[page]':
      return {
        title: `${category} | ${locale.COMMON.CATEGORY} | ${siteInfo?.title}`,
        description: joinDescriptionText(
          `${siteTitle}「${category}」分类下的文章第 ${page} 页`,
          siteDescription
        ),
        slug: 'category/' + category,
        image: `${siteInfo?.pageCover}`,
        type: 'website'
      }
    case '/tag/[tag]':
    case '/tag/[tag]/page/[page]':
      return {
        title: `${tag} | ${locale.COMMON.TAGS} | ${siteInfo?.title}`,
        description: joinDescriptionText(
          `「${tag}」标签下的全部文章`,
          siteDescription
        ),
        image: `${siteInfo?.pageCover}`,
        slug: 'tag/' + tag,
        type: 'website'
      }
    case '/search':
      return {
        title: `${keyword || ''}${keyword ? ' | ' : ''}${locale.NAV.SEARCH} | ${siteInfo?.title}`,
        description: joinDescriptionText(
          `在 ${siteTitle} 站内搜索文章`,
          siteDescription
        ),
        image: `${siteInfo?.pageCover}`,
        slug: 'search',
        type: 'website'
      }
    case '/search/[keyword]':
    case '/search/[keyword]/page/[page]':
      return {
        title: `${keyword || ''}${keyword ? ' | ' : ''}${locale.NAV.SEARCH} | ${siteInfo?.title}`,
        description: joinDescriptionText(
          keyword
            ? `与「${keyword}」相关的搜索结果`
            : `在 ${siteTitle} 站内搜索文章`,
          siteDescription
        ),
        image: `${siteInfo?.pageCover}`,
        slug: 'search/' + (keyword || ''),
        type: 'website'
      }
    case '/404':
      return {
        title: `${siteInfo?.title} | ${locale.NAV.PAGE_NOT_FOUND}`,
        image: `${siteInfo?.pageCover}`
      }
    case '/tag':
      return {
        title: `${locale.COMMON.TAGS} | ${siteInfo?.title}`,
        description: joinDescriptionText(
          `${siteTitle} 文章标签`,
          siteDescription,
          '按标签浏览全部文章。'
        ),
        image: `${siteInfo?.pageCover}`,
        slug: 'tag',
        type: 'website'
      }
    case '/category':
      return {
        title: `${locale.COMMON.CATEGORY} | ${siteInfo?.title}`,
        description: joinDescriptionText(
          `${siteTitle} 文章分类`,
          siteDescription,
          '按分类浏览全部文章。'
        ),
        image: `${siteInfo?.pageCover}`,
        slug: 'category',
        type: 'website'
      }
    default:
      const category = Array.isArray(post?.category)
        ? post?.category?.[0]
        : post?.category
      return {
        title: post
          ? `${post?.title} | ${siteInfo?.title}`
          : `${siteInfo?.title} | loading`,
        description: buildPostDescription(post, siteInfo),
        type: post?.type,
        slug: post?.slug,
        image: post?.pageCoverThumbnail || `${siteInfo?.pageCover}`,
        category,
        tags: post?.tags,
        publishDay: post?.publishDay,
        lastEditedDay: post?.lastEditedDay,
        publishTime:
          getIsoTime(post?.publishDate) ||
          getIsoTime(post?.date?.start_date),
        modifiedTime: getIsoTime(post?.lastEditedTime || post?.lastEditedDate)
      }
  }
}

export default SEO
