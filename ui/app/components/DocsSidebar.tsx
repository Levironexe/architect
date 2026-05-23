'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

interface NavItem {
  label: string
  href: string
  matchMode: 'exact' | 'prefix'
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    label: 'LEARN',
    items: [
      { label: 'Overview', href: '/docs', matchMode: 'exact' },
    ],
  },
  {
    label: 'REFERENCE',
    items: [
      { label: 'Commands', href: '/docs/commands', matchMode: 'prefix' },
      { label: 'Skills', href: '/docs/skills', matchMode: 'prefix' },
      { label: 'Agent Integrations', href: '/docs/integrations', matchMode: 'prefix' },
    ],
  },
  {
    label: 'CONTRIBUTING',
    items: [
      { label: 'Writing Skills', href: '/docs/contributing', matchMode: 'prefix' },
    ],
  },
]

function isActive(item: NavItem, pathname: string): boolean {
  if (item.matchMode === 'exact') return pathname === item.href.split('#')[0]
  return pathname.startsWith(item.href)
}

function getActiveLabel(pathname: string): string {
  for (const group of NAV) {
    for (const item of group.items) {
      if (isActive(item, pathname)) return item.label
    }
  }
  return 'Docs'
}

export function DocsSidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const activeLabel = getActiveLabel(pathname)
  const flatItems = NAV.flatMap(group => group.items)
  const totalPages = flatItems.length

  return (
    <>
      {/* Mobile: dropdown */}
      <nav className="lg:hidden w-full" ref={dropdownRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="w-full flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm transition-colors hover:bg-surface"
          >
            <span className="font-medium text-dark">{activeLabel}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted tabular-nums">
                {totalPages}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {open && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
              {NAV.map((group, gi) => (
                <div key={group.label}>
                  {gi > 0 && <div className="border-t border-gray-100" />}
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                      {group.label}
                    </p>
                  </div>
                  {group.items.map(item => {
                    const active = isActive(item, pathname)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`block px-4 py-2.5 text-sm transition-colors ${
                          active
                            ? 'bg-surface text-dark font-medium'
                            : 'text-muted hover:bg-surface hover:text-dark'
                        }`}
                      >
                        {item.label}
                      </Link>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Desktop: sticky sidebar */}
      <nav className="hidden lg:block w-52 shrink-0">
        <div className="sticky top-8 space-y-6">
          {NAV.map(group => (
            <div key={group.label}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-2">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map(item => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`block text-sm py-1 transition-colors ${
                        isActive(item, pathname)
                          ? 'text-dark font-medium'
                          : 'text-muted hover:text-dark'
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  )
}
