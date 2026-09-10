import { readFileSync } from 'fs'
import { join } from 'path'
import { DocsPageContent } from '@/app/components/DocsPageContent'

export default function RulesPage() {
  const content = readFileSync(
    join(process.cwd(), 'app/docs/content/rules.md'),
    'utf-8'
  )
  return <DocsPageContent content={content} breadcrumb="Docs / Rules" slug="rules" />
}
