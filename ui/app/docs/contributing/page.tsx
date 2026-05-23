import { readFileSync } from 'fs'
import { join } from 'path'
import { DocsPageContent } from '@/app/components/DocsPageContent'

export default function ContributingPage() {
  const content = readFileSync(
    join(process.cwd(), 'app/docs/content/contributing.md'),
    'utf-8'
  )
  return <DocsPageContent content={content} breadcrumb="Docs / Contributing" slug="contributing" />
}
