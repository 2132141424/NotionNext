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
      // 跟随系统深浅色设置
      shouldBeDark = prefersDark
    }
  }
  
  // 立即设置 html 元素的类
  document.documentElement.classList.add(shouldBeDark ? 'dark' : 'light')
})()
`

const preloadHtml = `
<div id="preload-cover" style="position:fixed;top:0;left:0;width:100%;height:100%;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f7f9fe;">
  <div style="text-align:center;">
    <img id="preload-icon" src="${BLOG.BLOG_FAVICON || '/favicon.ico'}" alt="logo" style="width:64px;height:64px;margin-bottom:28px;border-radius:12px;" />
    <div style="width:180px;height:4px;background:#e5e7eb;border-radius:2px;overflow:hidden;">
      <div id="preload-progress" style="height:100%;width:0%;background:#4f65f0;border-radius:2px;transition:width 0.4s ease;"></div>
    </div>
  </div>
</div>
<style>
  .dark #preload-cover { background:#18171d !important; }
  .dark #preload-progress { background:#dca846 !important; }
</style>
<script>
(function(){
  var c=document.getElementById('preload-cover');
  if(!c) return;
  var p=document.getElementById('preload-progress');
  var v=0;
  function set(pct){ if(pct>v){ v=pct; p.style.width=pct+'%'; } }
  function hide(){
    if(c.dataset.done) return;
    c.dataset.done='1';
    set(100);
    setTimeout(function(){
      c.style.opacity='0';
      c.style.transition='opacity 0.5s ease';
      setTimeout(function(){
        if(c.parentNode) c.parentNode.removeChild(c);
        window.dispatchEvent(new Event('scroll'));
      }, 500);
    }, 200);
  }
  set(8);
  // 关键脚本就绪(React 水合开始)后即可淡出
  document.addEventListener('DOMContentLoaded',function(){ set(50); });
  // DOM 就绪后再额外等待极短的 100ms，让首屏可交互，随后淡出，不等 window.load（避免被慢图/超时图阻塞）
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){
      set(70);
      setTimeout(hide, 800);
    });
  } else {
    set(70);
    setTimeout(hide, 800);
  }
})();
</script>
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
        </Head>

        <body>
          <div
            id='preload-container'
            dangerouslySetInnerHTML={{ __html: preloadHtml }}
          />
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}

export default MyDocument
