export function Quickstart() {
  return (
    <section className="max-w-280 mx-auto px-6 py-24">
      <div className="flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 max-w-xl">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-4">Quickstart</h3>
          <h2 className="text-4xl font-serif mb-6">Zero API key friction.</h2>
          <p className="text-lg text-muted mb-8 leading-relaxed">
            No provider setup. No{" "}
            <code className="font-mono text-sm">ANTHROPIC_API_KEY</code>, no{" "}
            <code className="font-mono text-sm">OPENAI_API_KEY</code>. Architect runs local static analysis to detect your stack and generates agent-ready skill files. The coding agent you already have IS the intelligence  -  Architect gives it the right knowledge to act on.
          </p>
          <a href="#supported-agents" className="inline-flex items-center text-dark font-medium border-b border-dark pb-0.5 hover:text-muted hover:border-muted transition-colors">
            View supported agents
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
              <p><span className="text-muted">$</span> npm install -g @levironexe/architect</p>
              <br />
              <p><span className="text-muted">$</span> cd my-messy-express-app</p>
              <p><span className="text-muted">$</span> architect init . --integration claude</p>
              <br />
              <p className="text-green-400">✓ Detected stack:  Express.js REST API</p>
              <p className="text-green-400">✓ Detected agent:  Claude Code</p>
              <p className="text-green-400">✓ Installed 3 skills:</p>
              <p className="text-gray-400 ml-4">/architect-plan     → .claude/skills/architect-plan/</p>
              <p className="text-gray-400 ml-4">/architect-refactor → .claude/skills/architect-refactor/</p>
              <p className="text-gray-400 ml-4">/architect-catchup  → .claude/skills/architect-catchup/</p>
              <br />
              <p className="text-white">Open Claude Code and run /architect-plan to get started.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
