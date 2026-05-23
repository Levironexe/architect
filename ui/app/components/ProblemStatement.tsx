export function ProblemStatement() {
  const rows = [
    {
      feature: "File-level code quality checks",
      sonar: true,
      customRules: false,
      architect: false
    },
    {
      feature: "Custom rule mechanism",
      sonar: false,
      customRules: true,
      architect: false
    },
    {
      feature: "Existing codebase architecture scan",
      sonar: false,
      customRules: false,
      architect: true
    },
    {
      feature: "Stack auto-detection",
      sonar: false,
      customRules: false,
      architect: true
    },
    {
      feature: "Stack-specific architecture blueprint",
      sonar: false,
      customRules: false,
      architect: true
    },
    {
      feature: "Auto-generated assistant instructions",
      sonar: false,
      customRules: false,
      architect: true
    },
    {
      feature: "Refactor-phase guidance for messy projects",
      sonar: false,
      customRules: false,
      architect: true
    }
  ];

  const mark = (enabled: boolean) =>
    enabled ? (
      <span className="text-emerald-600 font-semibold">✓</span>
    ) : (
      <span className="text-gray-300">-</span>
    );

  return (
    <section className="bg-cream text-dark py-32 px-6">
      <div className="max-w-280 mx-auto grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-12 items-stretch">
        <div className="md:col-span-2 h-full flex flex-col">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-6">The Gap</h3>
          <h2 className="text-4xl md:text-6xl font-serif mb-8 leading-tight">The Spaghetti Point.</h2>
          <p className="text-lg text-muted mb-6 leading-relaxed font-serif italic">
            &ldquo;Vibe-coded projects accumulate technical debt fast. AI-generated code optimizes for &lsquo;make it work,&rsquo; not &lsquo;make it maintainable.&rsquo;&rdquo;
          </p>
          <p className="text-muted text-sm font-medium mt-auto">
            Nobody installs stack-specific architectural knowledge into a coding agent for an existing project, automatically.{" "}
            <span className="text-dark">Architect fills that gap.</span>
          </p>
        </div>
        <div className="md:col-span-3 h-full bg-[#fafaf8] p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-gray-200">
                  <th className="pb-3 pr-4 font-medium min-w-48">Capability</th>
                  <th className="pb-3 px-2 font-medium text-center min-w-20">Sonar / ESLint</th>
                  <th className="pb-3 px-2 font-medium text-center min-w-24">CLAUDE.md / .cursorrules</th>
                  <th className="pb-3 pl-2 font-medium text-center min-w-18">Architect</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.feature} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-3 pr-4 text-dark">{row.feature}</td>
                    <td className="py-3 px-2 text-center">{mark(row.sonar)}</td>
                    <td className="py-3 px-2 text-center">{mark(row.customRules)}</td>
                    <td className="py-3 pl-2 text-center">{mark(row.architect)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
