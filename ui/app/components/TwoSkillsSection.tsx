/**
 * The single place the landing page enumerates commands. Every command, flag and
 * behaviour below is checked against `architect <cmd> --help` on the built CLI
 * and against the shipped templates in templates/.
 */
const GROUPS = [
  {
    label: "In your terminal",
    note: "The CLI. Deterministic, no model call.",
    cards: [
      {
        command: "architect check .",
        title: "Report",
        body: (
          <>
            Parses every TypeScript file and evaluates the blueprint&apos;s rules against
            it. Prints each violation with its file, line, rule id and the move that
            fixes it, then exits 1 on anything critical so it fails CI as-is.
          </>
        ),
        flags: ["--json", "--list-rules", "--ignore <rules>", "--baseline"],
      },
      {
        command: "architect init .",
        title: "Install",
        body: (
          <>
            Detects the stack from package.json and file conventions, then writes the
            three slash commands into <Code>.claude/skills/</Code>, rendered from that
            stack&apos;s blueprint so the agent gets your architecture, not generic advice.
          </>
        ),
        flags: ["--skill <id>", "--update"],
      },
      {
        command: "architect verify . --strict",
        title: "Hold the line",
        body: (
          <>
            Re-checks the project against <Code>.architect/baseline.json</Code> and fails
            when the violation count rises. Also checks TypeScript compilation, import
            resolution and circular dependencies. Existing debt stays; new debt does not.
          </>
        ),
        flags: ["--phase <n>", "--json"],
      },
    ],
  },
  {
    label: "In your coding agent",
    note: "Installed by init. The agent is the intelligence.",
    cards: [
      {
        command: "/architect-plan",
        title: "Roadmap generation",
        body: (
          <>
            The agent walks the codebase, reads the stack blueprint that{" "}
            <Code>init</Code> installed, compares your current structure against it, and
            writes a phased refactoring roadmap to <Code>.architect/plan.md</Code>.
          </>
        ),
        flags: [],
      },
      {
        command: "/architect-refactor",
        title: "Guided execution",
        body: (
          <>
            The agent reads <Code>.architect/plan.md</Code> and executes each phase step by
            step. After every phase it runs <Code>architect verify . --phase N --strict</Code>,
            stops on a failure, and pauses for your confirmation before continuing.
          </>
        ),
        flags: [],
      },
      {
        command: "/architect-catchup",
        title: "Skill refresh",
        body: (
          <>
            After you add new code, the agent re-runs <Code>architect init . --update</Code>{" "}
            so the installed guidance reflects the current codebase, not the state it was
            in when you first ran init.
          </>
        ),
        flags: [],
      },
    ],
  },
];

function Code({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-xs bg-gray-100 px-1 rounded">{children}</code>;
}

export function TwoSkillsSection() {
  return (
    <section className="max-w-280 mx-auto px-6 py-24">
      <div className="flex flex-col md:flex-row gap-20">
        <div className="flex-1">
          <div className="sticky top-12">
            <h2 className="text-4xl md:text-5xl font-serif mb-6 text-balance">
              Three in your terminal.
              <br />
              Three in your agent.
            </h2>
            <p className="text-lg text-muted mb-8 leading-relaxed">
              Architect is a CLI you run and a set of skills your agent runs. The CLI finds
              the violations and gates them; the skills give the agent a plan to fix them,
              built from the same blueprint.
            </p>
            <p className="text-sm text-muted leading-relaxed">
              The blueprint is data, so adding a rule means writing YAML, not TypeScript.
            </p>
          </div>
        </div>
        <div className="flex-1 space-y-8">
          {GROUPS.map((group) => (
            <div key={group.label} className="space-y-8">
              <div className="flex items-baseline gap-3 pt-2">
                <span className="text-xs font-bold uppercase tracking-widest text-dark">
                  {group.label}
                </span>
                <span className="text-xs text-muted">{group.note}</span>
              </div>
              {group.cards.map((card) => (
                <div
                  key={card.command}
                  className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200"
                >
                  <div className="inline-block bg-surface px-3 py-1.5 rounded-lg font-mono text-sm font-medium mb-4">
                    {card.command}
                  </div>
                  <h3 className="text-xl font-serif mb-3">{card.title}</h3>
                  <p className="text-muted text-sm leading-relaxed">{card.body}</p>
                  {card.flags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {card.flags.map((flag) => (
                        <code
                          key={flag}
                          className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded"
                        >
                          {flag}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
