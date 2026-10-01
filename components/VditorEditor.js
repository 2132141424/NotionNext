import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { useCallback, useEffect, useRef, useState } from 'react'

const VDITOR_BASE = '/vditor'
const CONTENT_THEME_PATH = `${VDITOR_BASE}/dist/css/content-theme`
const DRAFT_ID = 'waterfish-write-draft'

/**
 * 按需加载自托管的 Vditor（见 scripts/sync-vditor.js），
 * 不把 20MB 的运行时资源打进页面 bundle，也不依赖公共 CDN。
 */
function loadVditor() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.Vditor) return Promise.resolve(window.Vditor)
  if (!window.__vditorLoading) {
    window.__vditorLoading = new Promise((resolve, reject) => {
      if (!document.getElementById('vditor-style')) {
        const link = document.createElement('link')
        link.id = 'vditor-style'
        link.rel = 'stylesheet'
        link.href = `${VDITOR_BASE}/dist/index.css`
        document.head.appendChild(link)
      }
      const script = document.createElement('script')
      script.src = `${VDITOR_BASE}/dist/index.min.js`
      script.onload = () => resolve(window.Vditor)
      script.onerror = () => reject(new Error('Vditor 资源加载失败'))
      document.head.appendChild(script)
    })
  }
  return window.__vditorLoading
}

/**
 * 把图片传到 Cloudinary，返回 Vditor 约定的响应结构。
 * 用的是 unsigned upload preset，浏览器直传，不需要后端和 api secret。
 */
async function uploadToCloudinary(files, { cloudName, uploadPreset }) {
  const errFiles = []
  const succMap = {}

  if (!cloudName || !uploadPreset) {
    return {
      msg: '还没有配置图床，图片不会被上传',
      code: 1,
      data: { errFiles: files.map(f => f.name), succMap }
    }
  }

  for (const file of files) {
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('upload_preset', uploadPreset)
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: 'POST', body: form }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.secure_url) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`)
      }
      succMap[file.name] = data.secure_url
    } catch (e) {
      console.warn('[write] 图片上传失败', file.name, e)
      errFiles.push(file.name)
    }
  }

  return { msg: '', code: 0, data: { errFiles, succMap } }
}

/** 复制富文本：优先走 Clipboard API，不支持时回退到选中后 execCommand */
async function writeRichText(html, text) {
  if (window.ClipboardItem && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' })
      })
    ])
    return
  }
  const holder = document.createElement('div')
  holder.contentEditable = 'true'
  holder.innerHTML = html
  holder.style.position = 'fixed'
  holder.style.left = '-9999px'
  document.body.appendChild(holder)
  const range = document.createRange()
  range.selectNodeContents(holder)
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
  document.execCommand('copy')
  selection.removeAllRanges()
  document.body.removeChild(holder)
}

const VditorEditor = props => {
  const { isDarkMode } = useGlobal()
  const containerRef = useRef(null)
  const vditorRef = useRef(null)
  const configRef = useRef(null)
  const darkRef = useRef(isDarkMode)
  const [status, setStatus] = useState('')
  const [ready, setReady] = useState(false)

  const cloudName = siteConfig(
    'CLOUDINARY_CLOUD_NAME',
    '',
    props.NOTION_CONFIG
  )
  const uploadPreset = siteConfig(
    'CLOUDINARY_UPLOAD_PRESET',
    '',
    props.NOTION_CONFIG
  )
  configRef.current = { cloudName, uploadPreset }
  darkRef.current = isDarkMode

  // 初始化编辑器，只做一次
  useEffect(() => {
    let disposed = false

    loadVditor()
      .then(Vditor => {
        if (disposed || !Vditor || !containerRef.current) return
        vditorRef.current = new Vditor(containerRef.current, {
          cdn: VDITOR_BASE,
          height: 'calc(100vh - 20rem)',
          minHeight: 420,
          mode: 'ir',
          icon: 'ant',
          theme: darkRef.current ? 'dark' : 'classic',
          placeholder: '在这里用 Markdown 写作，写完点上面的按钮复制到 Notion…',
          cache: { enable: true, id: DRAFT_ID },
          counter: { enable: true },
          outline: { enable: false, position: 'left' },
          toolbarConfig: { pin: true },
          preview: {
            theme: {
              current: darkRef.current ? 'dark' : 'light',
              path: CONTENT_THEME_PATH
            },
            hljs: { style: darkRef.current ? 'github-dark' : 'github' }
          },
          toolbar: [
            'headings',
            'bold',
            'italic',
            'strike',
            '|',
            'list',
            'ordered-list',
            'check',
            'quote',
            '|',
            'code',
            'inline-code',
            'link',
            'table',
            '|',
            'upload',
            'undo',
            'redo',
            '|',
            'fullscreen',
            'preview'
          ],
          upload: {
            accept: 'image/*',
            handler: files =>
              uploadToCloudinary(files, configRef.current).then(result =>
                JSON.stringify(result)
              )
          },
          after: () => {
            if (!disposed) setReady(true)
          }
        })
      })
      .catch(e => {
        console.error('[write] Vditor 初始化失败', e)
        if (!disposed) setStatus('编辑器加载失败，请刷新页面重试')
      })

    return () => {
      disposed = true
      try {
        vditorRef.current?.destroy()
      } catch (e) {
        console.warn('[write] 销毁编辑器失败', e)
      }
      vditorRef.current = null
    }
  }, [])

  // 跟随博客的明暗模式
  useEffect(() => {
    const vditor = vditorRef.current
    if (!vditor) return
    vditor.setTheme(isDarkMode ? 'dark' : 'classic')
    vditor.setContentTheme(
      isDarkMode ? 'dark' : 'light',
      CONTENT_THEME_PATH
    )
    vditor.setCodeTheme(isDarkMode ? 'github-dark' : 'github')
  }, [isDarkMode])

  const copyMarkdown = useCallback(async () => {
    const value = vditorRef.current?.getValue()
    if (!value) {
      setStatus('还没有内容')
      return
    }
    await navigator.clipboard.writeText(value)
    setStatus('Markdown 已复制')
  }, [])

  const copyRichText = useCallback(async () => {
    const vditor = vditorRef.current
    if (!vditor) return
    const html = vditor.getHTML()
    if (!html) {
      setStatus('还没有内容')
      return
    }
    await writeRichText(html, vditor.getValue())
    setStatus('富文本已复制，粘贴进 Notion 会自动抓取图片')
  }, [])

  const clearDraft = useCallback(() => {
    const vditor = vditorRef.current
    if (!vditor) return
    if (!window.confirm('确定清空当前草稿？该操作不可撤销。')) return
    vditor.setValue('')
    vditor.clearCache()
    setStatus('草稿已清空')
  }, [])

  const uploadReady = Boolean(cloudName && uploadPreset)

  return (
    <div id='write-page' className='w-full'>
      <div className='rounded-xl border bg-[var(--heo-color-card)] dark:border-gray-600 p-4 md:p-5'>
        <div className='flex flex-wrap items-center gap-2 mb-3'>
          <button
            type='button'
            onClick={() => {
              copyRichText()
            }}
            disabled={!ready}
            className='rounded-lg px-4 py-2 text-sm shadow transition-all duration-200 bg-[var(--heo-color-primary)] text-[var(--heo-color-primary-text)] hover:bg-[var(--heo-color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed'>
            复制富文本（推荐）
          </button>
          <button
            type='button'
            onClick={() => {
              copyMarkdown()
            }}
            disabled={!ready}
            className='rounded-lg px-4 py-2 text-sm border transition-all duration-200 hover:border-[var(--heo-color-border)] hover:text-[var(--heo-color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed'>
            复制 Markdown
          </button>
          <button
            type='button'
            onClick={clearDraft}
            disabled={!ready}
            className='rounded-lg px-4 py-2 text-sm border transition-all duration-200 hover:border-[var(--heo-color-border)] disabled:opacity-50 disabled:cursor-not-allowed'>
            清空草稿
          </button>
          {status ? (
            <span className='text-sm text-[var(--heo-color-text-secondary)] ml-1'>
              {status}
            </span>
          ) : null}
        </div>

        {!uploadReady ? (
          <div className='mb-3 rounded-lg border border-dashed px-3 py-2 text-sm text-[var(--heo-color-text-secondary)]'>
            还没有配置图床：配置 <code>NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> 和{' '}
            <code>NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> 之后，粘贴或拖入的图片会自动上传到
            Cloudinary 并替换成外链。
          </div>
        ) : null}

        <div className='vditor-wrapper' ref={containerRef} />
      </div>

      <style jsx global>{`
        /* 把 Vditor 的配色映射到 heo 主题的 CSS 变量，让编辑器跟博客保持一套色板 */
        #write-page .vditor {
          border: 1px solid var(--heo-color-border);
          border-radius: 0.75rem;
          background-color: var(--heo-color-card);
          font-family: inherit;
        }

        #write-page .vditor-toolbar {
          background-color: var(--heo-color-card-muted);
          border-bottom: 1px solid var(--heo-color-border);
          border-radius: 0.75rem 0.75rem 0 0;
        }

        #write-page .vditor-toolbar__item .vditor-tooltipped,
        #write-page .vditor-toolbar__divider {
          color: var(--heo-color-text);
        }

        #write-page .vditor-toolbar__item .vditor-tooltipped:hover {
          color: var(--heo-color-primary-hover);
          background-color: transparent;
        }

        #write-page .vditor-reset {
          color: var(--heo-color-text);
          font-family: inherit;
        }

        #write-page .vditor-ir,
        #write-page .vditor-sv,
        #write-page .vditor-wysiwyg {
          background-color: var(--heo-color-card);
        }

        #write-page .vditor-ir pre.vditor-reset,
        #write-page .vditor-wysiwyg pre.vditor-reset {
          background-color: var(--heo-color-card);
        }

        #write-page .vditor-reset a,
        #write-page .vditor-ir__marker {
          color: var(--heo-color-primary-hover);
        }

        #write-page .vditor-reset blockquote {
          border-left: 4px solid var(--heo-color-border);
          color: var(--heo-color-text-secondary);
        }

        #write-page .vditor-reset code:not(.hljs) {
          background-color: var(--heo-color-card-muted);
          color: var(--heo-color-primary-hover);
        }

        #write-page .vditor-reset table tr {
          background-color: var(--heo-color-card);
        }

        #write-page .vditor-reset table th,
        #write-page .vditor-reset table td {
          border-color: var(--heo-color-border);
        }

        #write-page .vditor-counter,
        #write-page .vditor-resize {
          color: var(--heo-color-text-secondary);
        }

        #write-page .vditor-resize--selected,
        #write-page .vditor-resize:hover {
          background-color: var(--heo-color-primary);
        }

        #write-page .vditor-panel {
          background-color: var(--heo-color-card);
          color: var(--heo-color-text);
          border: 1px solid var(--heo-color-border);
        }

        #write-page .vditor-hint {
          background-color: var(--heo-color-card);
          color: var(--heo-color-text);
          border: 1px solid var(--heo-color-border);
        }

        #write-page .vditor-hint--current,
        #write-page .vditor-hint button:hover {
          background-color: var(--heo-color-primary);
          color: var(--heo-color-primary-text);
        }

        .dark #write-page .vditor,
        .dark #write-page .vditor-reset,
        .dark #write-page .vditor-ir,
        .dark #write-page .vditor-sv,
        .dark #write-page .vditor-wysiwyg,
        .dark #write-page .vditor-ir pre.vditor-reset,
        .dark #write-page .vditor-wysiwyg pre.vditor-reset,
        .dark #write-page .vditor-panel,
        .dark #write-page .vditor-hint {
          background-color: var(--heo-color-card-dark);
          border-color: var(--heo-color-border-dark);
        }

        .dark #write-page .vditor-toolbar {
          background-color: var(--heo-color-bg-dark);
          border-bottom-color: var(--heo-color-border-dark);
        }

        .dark #write-page .vditor-toolbar__item .vditor-tooltipped,
        .dark #write-page .vditor-reset,
        .dark #write-page .vditor-toolbar__divider {
          color: var(--heo-color-text-dark);
        }

        .dark #write-page .vditor-reset blockquote {
          border-left-color: var(--heo-color-border-dark);
          color: var(--heo-color-text-secondary-dark);
        }

        .dark #write-page .vditor-reset code:not(.hljs) {
          background-color: var(--heo-color-bg-dark);
          color: var(--heo-color-accent);
        }

        .dark #write-page .vditor-reset table th,
        .dark #write-page .vditor-reset table td {
          border-color: var(--heo-color-border-dark);
        }

        .dark #write-page .vditor-counter,
        .dark #write-page .vditor-resize {
          color: var(--heo-color-text-secondary-dark);
        }

        /* 编辑器内的图片：给个浅边框，避免深色背景下白图糊成一片 */
        #write-page .vditor-reset img {
          border-radius: 0.5rem;
          max-width: 100%;
        }
      `}</style>
    </div>
  )
}

export default VditorEditor
