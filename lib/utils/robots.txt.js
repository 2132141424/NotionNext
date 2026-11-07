import fs from 'fs'

export function generateRobotsTxt(props) {
  const { siteInfo } = props
  const LINK = siteInfo?.link
  // Content Signals 声明 AI 爬虫的内容使用偏好 https://contentsignals.org/
  const CONTENT_SIGNAL =
    process.env.NEXT_PUBLIC_CONTENT_SIGNAL || 'ai-train=no, search=yes, ai-input=no'
  const content = `# *
User-agent: *
Allow: /
Content-Signal: ${CONTENT_SIGNAL}

# Sitemaps
Sitemap: ${LINK}/sitemap.xml
`
  try {
    fs.mkdirSync('./public', { recursive: true })
    fs.writeFileSync('./public/robots.txt', content)
  } catch (error) {
    // 在vercel运行环境是只读的，这里会报错；
    // 但在vercel编译阶段、或VPS等其他平台这行代码会成功执行
  }
}
