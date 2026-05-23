"use client"
import { useState } from 'react'
import { DocsMarkdown } from '@/app/components/DocsMarkdown'
import { DocsRightTOC } from '@/app/components/DocsRightTOC'
import { DocsFeedback } from './DocsFeedback'

interface DocsPageContentProps {
  content: string
  breadcrumb: string
  slug: string
}

export function DocsPageContent({ content, breadcrumb, slug }: DocsPageContentProps) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex gap-12">
      <article className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-3">
          <p className="text-sm text-muted leading-none">{breadcrumb}</p>
          <button
            type="button"
            title="Copy page"
            className="w-7 h-7 flex items-center justify-center rounded bg-white border border-gray-200 text-muted hover:text-dark transition-all"
            onClick={() => {
              navigator.clipboard.writeText(content)
              setCopied(true)
              setTimeout(() => setCopied(false), 1200)
            }}
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
            )}
          </button>
        </div>
        <DocsMarkdown content={content} />
        <DocsFeedback slug={slug} />
      </article>
      <DocsRightTOC content={content} />
    </div>
  )
}
