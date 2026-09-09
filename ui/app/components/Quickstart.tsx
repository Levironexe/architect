export function Quickstart() {
  return (
    <section className="max-w-280 mx-auto px-6 py-24">
      <div className="flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 max-w-xl">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-4">Quickstart</h3>
          <h2 className="text-4xl font-serif mb-6">One command. No setup.</h2>
          <p className="text-lg text-muted mb-8 leading-relaxed">
            No install, no config file, no API key. Architect parses your TypeScript
            locally and checks it against the Next.js App Router blueprint. Every rule is
            deterministic — there is no model call, and nothing leaves your machine.
          </p>
          <a href="#the-rules" className="inline-flex items-center text-dark font-medium border-b border-dark pb-0.5 hover:text-muted hover:border-muted transition-colors">
            See the rules
          </a>
        </div>
        <div className="flex-1 w-full">
          <div className="bg-[#0a0a0a] rounded-2xl shadow-2xl p-6 font-mono text-sm leading-relaxed overflow-hidden border border-gray-800">
            <div className="flex space-x-2 mb-6 border-b border-gray-800 pb-4">
              <div className="w-3 h-3 rounded-full bg-gray-700" />
              <div className="w-3 h-3 rounded-full bg-gray-700" />
              <div className="w-3 h-3 rounded-full bg-gray-700" />
            </div>
            <div className="text-gray-300">
              <p><span className="text-muted">$</span> npx @levironexe/architect check .</p>
              <br />
              <p><span className="text-red-400">✗</span> src/app/projects/page.tsx<span className="text-gray-500">:24</span></p>
              <p className="text-gray-300 ml-4">Database client imported directly in a page component.</p>
              <p className="text-gray-400 ml-4"><span className="text-green-400">→</span> Move the query into lib/ and call that function from the page.</p>
              <p className="text-gray-500 ml-4">direct_db_in_page</p>
              <br />
              <p><span className="text-yellow-400">⚠</span> src/components/TaskCard.tsx<span className="text-gray-500">:7</span></p>
              <p className="text-gray-300 ml-4">alert() used to surface an error to the user.</p>
              <p className="text-gray-400 ml-4"><span className="text-green-400">→</span> Render the error in the UI, or use a toast component.</p>
              <p className="text-gray-500 ml-4">alert_for_errors</p>
              <br />
              <p className="text-white">11 violations (4 critical, 7 warning) <span className="text-gray-500">· 13 files checked · nextjs-app-router</span></p>
              <p className="text-red-400">exit 1<span className="text-gray-500"> — fails CI as-is</span></p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
