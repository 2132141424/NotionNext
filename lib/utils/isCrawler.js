/**
 * 常见爬虫 / 蜘蛛 UA 关键字
 * 覆盖国内外主流搜索引擎爬虫（Googlebot、Bingbot、百度蜘蛛、神马、360、Sogou、DuckDuckBot、Yandex 等）
 */
const BOT_UA_REGEX =
  /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|embedly|preview|fetch|monitor|baiduspider|baidu-ads|googlebot|google-adwords|googleweblight|yandex|duckduckgo|sogou|360spider|haosou|bytespider|ahrefsbot|semrushbot|mj12bot|petalbot|applebot|linkedinbot|twitterbot|whatsapp|telegrambot|discordbot|slackbot|skypeuripreview|naver|ia_archiver|archive\.org_bot|wget|curl|python-requests|httpclient|puppeteer|playwright|headlesschrome|phantomjs|selenium/i

/**
 * 判断当前请求方是否为搜索引擎爬虫 / 自动化客户端
 * 用于在统计脚本初始化前过滤，避免爬虫访问被记入 UV/PV
 * @param {string} [ua] 自定义 UA，默认取 navigator.userAgent
 * @returns {boolean}
 */
export function isCrawler(ua) {
  if (typeof navigator === 'undefined' && !ua) return false
  const userAgent = (ua || (typeof navigator !== 'undefined' && navigator.userAgent) || '').toLowerCase()
  if (!userAgent) return false
  return BOT_UA_REGEX.test(userAgent)
}
