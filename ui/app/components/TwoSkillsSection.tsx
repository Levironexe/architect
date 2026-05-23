export function TwoSkillsSection() {
  return (
    <section className="max-w-280 mx-auto px-6 py-24">
      <div className="flex flex-col md:flex-row gap-20">
        <div className="flex-1">
          <div className="sticky top-12">
            <h2 className="text-4xl font-serif mb-6">Three slash commands. Full control.</h2>
            <p className="text-lg text-muted mb-8 leading-relaxed">
              Architect installs three specific skills that guide your agent through a structured, predictable refactoring process based on the installed stack blueprint.
            </p>
            <p className="text-sm text-muted leading-relaxed">
              The agent is the intelligence. Architect gives it the map.
            </p>
          </div>
        </div>
        <div className="flex-1 space-y-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
            <div className="inline-block bg-surface px-3 py-1.5 rounded-lg font-mono text-sm font-medium mb-4">
              /architect-plan
            </div>
            <h3 className="text-xl font-serif mb-3">Roadmap Generation</h3>
            <p className="text-muted text-sm leading-relaxed mb-4">
              The agent walks the codebase, calls{" "}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">architect context</code>{" "}
              to load the full blueprint, compares current structure against it, and writes a phased refactoring roadmap to{" "}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">.architect/plan.md</code>.
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-dark rounded-full shrink-0" />
                Compares current structure to blueprint
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-dark rounded-full shrink-0" />
                Identifies concrete steps (source file → target file)
              </li>
            </ul>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
            <div className="inline-block bg-surface px-3 py-1.5 rounded-lg font-mono text-sm font-medium mb-4">
              /architect-refactor
            </div>
            <h3 className="text-xl font-serif mb-3">Guided Execution</h3>
            <p className="text-muted text-sm leading-relaxed mb-4">
              The agent reads{" "}
              <code className="font-mono text-xs bg-gray-100 px-1 rounded">.architect/plan.md</code>{" "}
              and executes each phase step by step, pausing after each phase to wait for your confirmation before continuing.
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-dark rounded-full shrink-0" />
                Follows separation rules as hard constraints
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-dark rounded-full shrink-0" />
                Explains every action during execution
              </li>
            </ul>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
            <div className="inline-block bg-surface px-3 py-1.5 rounded-lg font-mono text-sm font-medium mb-4">
              /architect-catchup
            </div>
            <h3 className="text-xl font-serif mb-3">Skill Refresh</h3>
            <p className="text-muted text-sm leading-relaxed mb-4">
              After you add new code, the agent re-scans the project and refreshes installed skills so guidance stays aligned with the current codebase state.
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-dark rounded-full shrink-0" />
                Re-runs project scan and stack detection
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1 h-1 bg-dark rounded-full shrink-0" />
                Rewrites skills with fresh architecture context
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
