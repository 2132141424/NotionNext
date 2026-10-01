import VditorEditor from '@/components/VditorEditor'
import { fetchGlobalAllData } from '@/lib/db/SiteDataApi'

/**
 * 写作页：用自托管的 Vditor 写 Markdown，粘贴/拖入的图片自动传到 Cloudinary，
 * 写完复制富文本粘贴到 Notion，图片会被 Notion 抓取并转存。
 */
const Write = props => {
  return (
    <div id='write-outer-wrapper' className='px-5 md:px-0'>
      <h1 className='mb-4 text-2xl font-extrabold dark:text-gray-200'>
        写作
      </h1>
      <VditorEditor {...props} />
    </div>
  )
}

export async function getStaticProps({ locale }) {
  const props = await fetchGlobalAllData({ from: 'write', locale })
  props.posts =
    props.allPages?.filter(
      page => page.type === 'Post' && page.status === 'Published'
    ) || []
  delete props.allPages
  return { props }
}

export default Write
