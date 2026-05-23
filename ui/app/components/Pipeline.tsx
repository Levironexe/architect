export function Pipeline() {
  return (
    <section className="max-w-280 mx-auto px-6 py-32">
      <div className="text-center mb-16">
        <h2 className="text-4xl font-serif mb-4">How Architect Builds Context</h2>
        <p className="text-muted max-w-2xl mx-auto">
          When your agent asks for context (usually via <code className="font-mono text-sm">architect context</code>), Architect picks the right stack blueprint and returns clear guidance for how your project should be organized.
        </p>
      </div>
      <div className="bg-surface rounded-4xl p-12 flex flex-col md:flex-row items-center justify-center gap-8 border border-gray-200">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center w-full md:w-64">
          <div className="text-xs font-bold uppercase tracking-widest text-muted mb-2">What You Provide</div>
          <div className="text-sm text-gray-600">Your project (and optionally a stack hint)</div>
        </div>
        <div className="hidden md:block text-muted">→</div>
        <div className="md:hidden text-muted">↓</div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center w-full md:w-64">
          <div className="text-xs font-bold uppercase tracking-widest text-muted mb-2">What Architect Does</div>
          <div className="text-sm text-gray-600">Detects the stack and loads the matching architecture rules</div>
        </div>
        <div className="hidden md:block text-muted">→</div>
        <div className="md:hidden text-muted">↓</div>
        <div className="bg-dark p-6 rounded-2xl shadow-lg border border-gray-800 text-center w-full md:w-64 text-white">
          <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">What You Get</div>
          <div className="text-sm">A clear blueprint your agent can follow</div>
        </div>
      </div>
    </section>
  );
}
