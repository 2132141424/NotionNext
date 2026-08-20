/**
 * 双节点故障转移 Worker
 * 主域名:  blog.waterfish.ren
 * 主节点:  ve.blog.waterfish.ren   (Vercel)
 * 备用节点: esa.blog.waterfish.ren (ESA)
 *
 * 逻辑:
 *   1. 每个请求优先请求主节点 ve
 *   2. 主节点超时 / 网络错误 / 5xx 时, 自动切换到备用节点 esa
 *   3. 静态资源(_next/static、图片等)走 Cloudflare 边缘缓存, 加速访问
 *   4. /health 端点返回双节点实时连通状态, 便于拨测
 *
 * 部署步骤:
 *   1. Cloudflare Dashboard -> Workers & Pages -> 创建 Worker -> 粘贴本代码 -> Deploy
 *   2. 进入该 Worker -> Settings -> Domains & Routes -> Add Route
 *      Route: blog.waterfish.ren/*
 *      Zone : waterfish.ren
 *   3. 确认 blog.waterfish.ren 的 DNS 记录已开启代理(橙色云朵), 否则路由不生效
 *
 * 测试:
 *   - 直接访问 Worker 的 workers.dev 地址, 确认能正常返回页面
 *   - 访问 https://blog.waterfish.ren/health 查看双节点状态
 */

const PRIMARY = 'https://ve.blog.waterfish.ren'
const FALLBACK = 'https://esa.blog.waterfish.ren'
const TIMEOUT_MS = 5000 // 主节点超时时间
const ASSET_CACHE_TTL = 60 * 60 * 24 * 7 // 静态资源边缘缓存 7 天

export default {
  async fetch(request) {
    const url = new URL(request.url)

    // 健康检查端点: 返回双节点实时连通状态
    if (url.pathname === '/health') {
      const [primaryOk, fallbackOk] = await Promise.all([
        checkHealth(PRIMARY),
        checkHealth(FALLBACK)
      ])
      return new Response(
        JSON.stringify(
          {
            status: 'ok',
            primary: PRIMARY,
            primaryOk,
            fallback: FALLBACK,
            fallbackOk,
            active: primaryOk ? PRIMARY : FALLBACK
          },
          null,
          2
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 })
    }

    const isStatic = isStaticAsset(url.pathname)

    // 静态资源: 先查边缘缓存, 命中直接返回
    if (isStatic) {
      const cache = caches.default
      const cacheKey = new Request(url.href, { method: 'GET' })
      const cached = await cache.match(cacheKey)
      if (cached) {
        return cached
      }
    }

    // 优先请求主节点
    let response = await fetchOrigin(PRIMARY, url, request)

    // 主节点不可用(网络错误/超时/5xx) -> 切换备用节点
    if (!response || response.status >= 500) {
      console.log(`[FAILOVER] ${PRIMARY} unavailable, switch to ${FALLBACK}`)
      response = await fetchOrigin(FALLBACK, url, request)
    }

    if (!response) {
      return new Response('Both nodes unreachable', { status: 502 })
    }

    // 静态资源写入边缘缓存
    if (isStatic && response.status === 200) {
      const cache = caches.default
      const cacheKey = new Request(url.href, { method: 'GET' })
      const clone = response.clone()
      const headers = new Headers(clone.headers)
      headers.set('Cache-Control', `public, max-age=${ASSET_CACHE_TTL}`)
      await cache.put(
        cacheKey,
        new Response(clone.body, {
          status: clone.status,
          statusText: clone.statusText,
          headers
        })
      )
    }

    return response
  }
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    /\.(js|css|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|eot|avif)$/i.test(pathname)
  )
}

async function fetchOrigin(origin, url, request) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const headers = new Headers(request.headers)
    // 回源时 Host 必须指向目标节点, 否则 Vercel/ESA 无法识别站点
    headers.set('Host', new URL(origin).host)
    // 移除 Cloudflare 特有头, 避免回源被误判
    for (const h of [
      'cf-connecting-ip',
      'cf-ray',
      'cf-visitor',
      'x-forwarded-for',
      'x-forwarded-proto',
      'x-real-ip',
      'cdn-loop'
    ]) {
      headers.delete(h)
    }
    const resp = await fetch(origin + url.pathname + url.search, {
      method: request.method,
      headers,
      redirect: 'manual',
      signal: controller.signal
    })
    // 重写重定向 Location, 让浏览器始终停留在主域名
    if (resp.status >= 300 && resp.status < 400) {
      const location = resp.headers.get('Location')
      if (location) {
        const newResp = new Response(resp.body, resp)
        newResp.headers.set('Location', rewriteLocation(location))
        return newResp
      }
    }
    return resp
  } catch (e) {
    console.log(`[FAILOVER] ${origin} error: ${e.message}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

function rewriteLocation(location) {
  try {
    const loc = new URL(location)
    if (loc.hostname.endsWith('waterfish.ren')) {
      loc.hostname = 'blog.waterfish.ren'
    }
    return loc.toString()
  } catch {
    return location
  }
}

async function checkHealth(origin) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const resp = await fetch(origin + '/', {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal
    })
    clearTimeout(timer)
    return resp.status >= 200 && resp.status < 500
  } catch (e) {
    return false
  }
}
