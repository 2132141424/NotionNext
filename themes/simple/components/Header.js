import LazyImage from '@/components/LazyImage'
import { siteConfig } from '@/lib/config'
import SmartLink from '@/components/SmartLink'

/**
 * 网站顶部 - 紧凑模式，与导航栏同行
 * @returns
 */
export default function Header(props) {
  const { siteInfo } = props

  return (
    <div className='flex items-center space-x-3 flex-shrink-0'>
      <SmartLink href='/' className='flex items-center space-x-3'>
        <div className='hover:rotate-45 hover:scale-125 transform duration-200 cursor-pointer flex-shrink-0'>
          <LazyImage
            priority={true}
            src={siteInfo?.icon}
            className='rounded-full'
            width={36}
            height={36}
            alt={siteConfig('AUTHOR')}
          />
        </div>
        <span className='text-lg font-bold dark:text-white whitespace-nowrap hover:text-red-400 transition-colors duration-200'>
          {siteConfig('AUTHOR')}
        </span>
      </SmartLink>
    </div>
  )
}
