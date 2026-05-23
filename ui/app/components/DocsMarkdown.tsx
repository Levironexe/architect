"use client"
import { Children, isValidElement, type ReactNode, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function getNodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join('')
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getNodeText(node.props.children)
  }

  return Children.toArray(node).map(getNodeText).join('')
}

const components: Components = {
  h1: ({ children }) => (
    <h1 id={slugify(getNodeText(children))} className="font-serif text-3xl font-semibold text-dark mb-6 mt-2">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 id={slugify(getNodeText(children))} className="font-serif text-xl font-semibold text-dark mt-10 mb-3">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={slugify(getNodeText(children))} className="font-sans text-base font-semibold text-dark mt-6 mb-2">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="font-sans text-dark leading-7 mb-4">{children}</p>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-dark underline underline-offset-2 hover:text-muted transition-colors">
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="pl-5 space-y-1 mb-4 list-disc font-sans text-dark">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="pl-5 space-y-1 mb-4 list-decimal font-sans text-dark">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-7">{children}</li>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = 'data-language' in props || className?.startsWith('language-')
    if (isBlock) {
      return <code className={className}>{children}</code>
    }
    return (
      <code className="font-mono text-sm bg-surface py-0.5 rounded text-dark">
        {children}
      </code>
    )
  },
  pre: ({ children }) => {
    const code = getNodeText(children)
    const [copied, setCopied] = useState(false)
    return (
      <div className="relative group mb-4">
        <pre className="font-mono text-sm bg-surface rounded-lg p-4 overflow-x-auto mb-0">
          {children}
        </pre>
        <button
          type="button"
          title="Copy"
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded bg-white border border-gray-200 text-muted hover:text-dark opacity-0 group-hover:opacity-100 transition-all z-10"
          onClick={() => {
            navigator.clipboard.writeText(code)
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
    )
  },
  table: ({ children }) => (
    <div className="overflow-x-auto mb-6 rounded-2xl border border-gray-200 overflow-hidden">
      <table className="w-full border-collapse text-sm font-sans">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left px-4 py-3 font-semibold text-dark border-b border-gray-200">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-3 text-dark border-b border-gray-100 last:border-b-0">{children}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-surface pl-4 text-muted mb-4">{children}</blockquote>
  ),
  hr: () => <hr className="border-gray-200 my-8" />,
}

interface DocsMarkdownProps {
  content: string
}

export function DocsMarkdown({ content }: DocsMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  )
}
