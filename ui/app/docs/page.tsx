import { readFileSync } from 'fs'
import { join } from 'path'
import { DocsPageContent } from '@/app/components/DocsPageContent'

export default function DocsPage() {
  const content = readFileSync(
    join(process.cwd(), 'app/docs/content/overview.md'),
    'utf-8'
  )
  return <DocsPageContent content={content} breadcrumb="Docs" slug="overview" />
}
