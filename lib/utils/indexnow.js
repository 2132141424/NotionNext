import fs from 'fs'

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'd63b486f3d1a1a62931e32d0520654cb'
const INDEXNOW_ENDPOINT = 'https://www.bing.com/indexnow'
const SITE_HOST = 'blog.waterfish.ren'

// 构建时生成密钥验证文件
export function generateIndexNowKeyFile() {
  try {
    fs.mkdirSync('./public', { recursive: true })
    fs.writeFileSync(`./public/${INDEXNOW_KEY}.txt`, INDEXNOW_KEY)
    console.log('[IndexNow] 密钥文件已生成')
  } catch (error) {
    console.warn('[IndexNow] 密钥文件生成失败（只读环境，跳过）:', error.message)
  }
}

// 向 IndexNow 推送 URL 列表
export async function pushIndexNow(urls) {
  if (!urls || urls.length === 0) return
  try {
    const payload = {
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${SITE_HOST}/${INDEXNOW_KEY}.txt`,
      urlList: urls
    }
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    console.log(`[IndexNow] 推送 ${urls.length} 个 URL，状态: ${res.status}`)
  } catch (error) {
    console.warn('[IndexNow] 推送失败:', error.message)
  }
}
