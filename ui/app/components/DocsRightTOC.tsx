interface TocEntry {
  text: string
  slug: string
  level: 2 | 3
  href: string
}

function normalizeHeadingText(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function extractTocEntries(markdown: string): TocEntry[] {
  return markdown
    .split('\n')
    .filter(line => /^#{2,3} /.test(line))
    .map(line => {
      const level = line.startsWith('### ') ? 3 : 2
      const text = normalizeHeadingText(line.replace(/^#{2,3} /, ''))
      const slug = slugify(text)
      return { text, slug, level, href: `#${slug}` }
    })
}

interface DocsRightTOCProps {
  content: string
}

export function DocsRightTOC({ content }: DocsRightTOCProps) {
  const entries = extractTocEntries(content)

  if (entries.length === 0) return null

  return (
    <aside className="hidden xl:block w-44 shrink-0">
      <div className="sticky top-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
          On this page
        </p>
        <ul className="space-y-1.5">
          {entries.map(entry => (
            <li key={entry.href} className={entry.level === 3 ? 'pl-3' : ''}>
              <a
                href={entry.href}
                className="text-xs text-muted hover:text-dark transition-colors leading-relaxed block"
              >
                {entry.text}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
