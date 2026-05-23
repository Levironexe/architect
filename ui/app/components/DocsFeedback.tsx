interface DocsFeedbackProps {
  slug: string
}

export function DocsFeedback({ slug }: DocsFeedbackProps) {
  return (
    <div className="bg-surface rounded-xl p-6 mt-16 flex items-center justify-between">
      <h3 className="font-serif text-sm font-semibold">Help us improve this page</h3>
      <div className="flex gap-3">
        <a
          href={`https://github.com/Levironexe/architect/edit/main/ui/app/docs/content/${slug}.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
          Suggest an edit
        </a>
        <a
          href={`https://github.com/Levironexe/architect/issues/new?title=%5BDocs%5D%3A+${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-dark hover:bg-gray-50 transition-colors inline-flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" x2="4" y1="22" y2="15" /></svg>
          Report an issue
        </a>
      </div>
    </div>
  )
}
