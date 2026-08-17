// eslint-disable-next-line @next/next/no-document-import-in-page
import BLOG from '@/blog.config'
import Document, { Head, Html, Main, NextScript } from 'next/document'

const isLocalFontAwesome = BLOG.FONT_AWESOME?.startsWith(
  '/vendor/fontawesome/'
)

// 预先设置深色模式的脚本内容
const darkModeScript = `
(function() {
  const darkMode = localStorage.getItem('darkMode')

  const prefersDark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches

  const defaultAppearance = '${BLOG.APPEARANCE || 'auto'}'

  let shouldBeDark = darkMode === 'true' || darkMode === 'dark'

  if (darkMode === null) {
    if (defaultAppearance === 'dark') {
      shouldBeDark = true
    } else if (defaultAppearance === 'auto') {
      // 检查是否在深色模式时间范围内
      const date = new Date()
      const hours = date.getHours()
      const darkTimeStart = ${BLOG.APPEARANCE_DARK_TIME ? BLOG.APPEARANCE_DARK_TIME[0] : 18}
      const darkTimeEnd = ${BLOG.APPEARANCE_DARK_TIME ? BLOG.APPEARANCE_DARK_TIME[1] : 6}
      
      shouldBeDark = prefersDark || (hours >= darkTimeStart || hours < darkTimeEnd)
    }
  }
  
  // 立即设置 html 元素的类
  document.documentElement.classList.add(shouldBeDark ? 'dark' : 'light')
})()
`

class MyDocument extends Document {
  static async getInitialProps(ctx) {
    const initialProps = await Document.getInitialProps(ctx)
    return { ...initialProps }
  }

  render() {
    return (
      <Html lang={BLOG.LANG}>
        <Head>
          <link rel='preconnect' href='https://images.unsplash.com' />
          <link rel='dns-prefetch' href='//images.unsplash.com' />

          {/* 预加载字体 */}
          {BLOG.FONT_AWESOME && (
            <>
              {isLocalFontAwesome && (
                <>
                  <link
                    rel='preload'
                    href='/vendor/fontawesome/webfonts/fa-solid-900.woff2'
                    as='font'
                    type='font/woff2'
                    crossOrigin='anonymous'
                  />
                  <link
                    rel='preload'
                    href='/vendor/fontawesome/webfonts/fa-regular-400.woff2'
                    as='font'
                    type='font/woff2'
                    crossOrigin='anonymous'
                  />
                  <link
                    rel='preload'
                    href='/vendor/fontawesome/webfonts/fa-brands-400.woff2'
                    as='font'
                    type='font/woff2'
                    crossOrigin='anonymous'
                  />
                </>
              )}
              <style
                dangerouslySetInnerHTML={{
                  __html:
                    '.fa,.fas,.far,.fab,.fa-solid,.fa-regular,.fa-brands{display:inline-flex;width:1.25em;min-width:1.25em;height:1em;align-items:center;justify-content:center;text-align:center;line-height:1}'
                }}
              />
              <link
                id='font-awesome-css'
                rel='preload'
                as='style'
                href={BLOG.FONT_AWESOME}
              />
              <script
                dangerouslySetInnerHTML={{
                  __html:
                    "requestAnimationFrame(function(){var l=document.getElementById('font-awesome-css');if(l)l.rel='stylesheet'})"
                }}
              />
              <noscript>
                <link rel='stylesheet' href={BLOG.FONT_AWESOME} />
              </noscript>
            </>
          )}

          {/* 预先设置深色模式，避免闪烁 */}
          <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
          {/* 预加载遮罩的深色模式样式 */}
          <style dangerouslySetInnerHTML={{ __html: '.dark #preload-cover{background:#18171d!important} .dark #preload-progress{background:#dca846!important}' }} />
        </Head>

        <body>
          {/* 预加载遮罩：在 React 水合前显示，加载完成后淡出 */}
          <div id='preload-cover' style='position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f7f9fe;'>
            <div style='text-align:center;'>
              <img id='preload-icon' src={BLOG.BLOG_FAVICON || '/favicon.ico'} alt='logo' style='width:64px;height:64px;margin-bottom:28px;border-radius:12px;' />
              <div style='width:180px;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;'>
                <div id='preload-progress' style='height:100%;width:0%;background:#4f65f0;border-radius:2px;transition:width 0.4s ease;'></div>
              </div>
            </div>
          </div>
          <script dangerouslySetInnerHTML={{ __html: `
(function(){
  var p = document.getElementById('preload-progress');
  var c = document.getElementById('preload-cover');
  var v = 0;
  function set(pct) { if(pct>v){ v=pct; p.style.width=pct+'%'; } }
  set(8);
  if(document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded',function(){ set(45); });
  } else { set(45); }
  window.addEventListener('load',function(){
    set(85);
    var si = setInterval(function(){
      if(v>=95){ clearInterval(si); set(100); return; }
      set(v+2);
    }, 80);
    setTimeout(function(){
      c.style.opacity='0';
      c.style.transition='opacity 0.5s ease';
      setTimeout(function(){
        c.remove();
        window.dispatchEvent(new Event('scroll'));
      }, 500);
    }, 600);
  });
})();
          `}} />
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
