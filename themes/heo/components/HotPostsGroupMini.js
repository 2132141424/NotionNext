import LazyImage from '@/components/LazyImage'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'

/**
 * 热门文章列表（按浏览量倒序）
 * @param hotPosts 已按浏览量排序的文章数据
 * @constructor
 */
export default function HotPostsGroupMini({ hotPosts, siteInfo }) {
  const currentPath = useRouter().asPath
  const { locale } = useGlobal()
  const SUB_PATH = siteConfig('SUB_PATH', '')

  return hotPosts?.length ? (
    <>
      <div className=' mb-2 px-1 flex flex-nowrap justify-between'>
        <div>
          <i className='mr-2 fa-solid fa-fire-flame-curved' />
          {locale.COMMON.HOT_POSTS}
        </div>
      </div>
      {hotPosts.map(post => {
        const selected = currentPath === `${SUB_PATH}/${post.slug}`
        const headerImage = post?.pageCoverThumbnail
          ? post.pageCoverThumbnail
          : siteInfo?.pageCover

        return (
          <SmartLink
            key={post.id}
            title={post.title}
            href={post?.href}
            passHref
            className={'my-3 flex'}>
            <div className='w-20 h-14 overflow-hidden relative'>
              <LazyImage
                src={`${headerImage}`}
                className='object-cover w-full h-full rounded-lg'
              />
            </div>
            <div
              className={
                (selected ? ' text-[var(--heo-color-primary)] ' : 'dark:text-gray-200') +
                ' text-sm overflow-x-hidden hover:text-[var(--heo-color-primary)] px-2 duration-200 w-full rounded ' +
                ' dark:hover:text-[var(--heo-color-accent)] cursor-pointer items-center flex'
              }>
              <div>
                <div className='line-clamp-2 menu-link'>{post.title}</div>
                <div className='text-gray-400'>
                  {post.pageViews ?? 0} {locale.COMMON.VIEWS}
                </div>
              </div>
            </div>
          </SmartLink>
        )
      })}
    </>
  ) : null
}
