import { siteConfig } from '@/lib/config'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { useSimpleGlobal } from '..'
import { MenuList } from './MenuList'

/**
 * 菜单导航
 * @param {*} props
 * @returns
 */
export default function NavBar(props) {
  const [showSearchInput, changeShowSearchInput] = useState(false)
  const router = useRouter()
  const { searchModal } = useSimpleGlobal()

  // 展示搜索框
  const toggleShowSearchInput = () => {
    if (siteConfig('ALGOLIA_APP_ID')) {
      searchModal.current.openSearch()
    } else {
      changeShowSearchInput(!showSearchInput)
    }
  }

  const onKeyUp = e => {
    if (e.keyCode === 13) {
      const search = document.getElementById('simple-search').value
      if (search) {
        router.push({ pathname: '/search/' + search })
      }
    }
  }

  return (
    <nav className='flex-1 bg-white md:pt-0 relative z-20 dark:bg-black'>
      <div
        id='nav-bar-inner'
        className='h-12 mx-auto max-w-9/10 flex justify-between items-center text-sm md:text-md'>
        {/* 菜单/搜索区域 */}
        <div className='h-full flex-1 flex items-center md:justify-start space-x-4 px-2 md:px-0'>
          {showSearchInput && (
            <input
              autoFocus
              id='simple-search'
              onKeyUp={onKeyUp}
              className='float-left w-full outline-none h-full px-4 text-base'
              aria-label='Submit search'
              type='search'
              name='s'
              autoComplete='off'
              placeholder='Type then hit enter to search...'
            />
          )}
          {!showSearchInput && <MenuList {...props} />}
        </div>

        <div className='h-full text-center px-2 flex items-center text-blue-400 cursor-pointer flex-shrink-0'>
          <i
            className={
              showSearchInput
                ? 'fa-regular fa-circle-xmark'
                : 'fa-solid fa-magnifying-glass' + ' align-middle'
            }
            onClick={toggleShowSearchInput}></i>
        </div>
      </div>
    </nav>
  )
}
