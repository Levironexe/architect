import { readFileSync } from 'fs'
import { join } from 'path'
import { DocsPageContent } from '@/app/components/DocsPageContent'

export default function CommandsPage() {
  const content = readFileSync(
    join(process.cwd(), 'app/docs/content/commands.md'),
    'utf-8'
  )
  return <DocsPageContent content={content} breadcrumb="Docs / Commands" slug="commands" />
}
