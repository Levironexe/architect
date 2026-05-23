import { Navbar } from '@/app/components/Navbar'
import { DocsSidebar } from '@/app/components/DocsSidebar'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-sans bg-cream text-dark min-h-screen">
      <Navbar />
      <div className="px-6">
        <div className="max-w-280 mx-auto flex flex-col lg:flex-row gap-10 py-12">
          <DocsSidebar />
          <main className="flex-1 min-w-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
