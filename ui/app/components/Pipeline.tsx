/**
 * The CLI surface. Every command and claim here is checked against
 * `architect <cmd> --help` on the published build -- see docs/commands.
 */
const COMMANDS = [
  {
    command: "architect check .",
    title: "Report",
    body: "Parses every TypeScript file and evaluates the blueprint's rules against it. Prints each violation with its file, line, rule id and the move that fixes it, then exits 1 on anything critical so it fails CI as-is.",
    flags: ["--json", "--list-rules", "--ignore <rules>", "--baseline"],
  },
  {
    command: "architect init .",
    title: "Install",
    body: "Detects the stack from package.json and file conventions, then writes three slash commands into .claude/skills/, rendered from that stack's blueprint so the agent gets your architecture, not generic advice.",
    flags: ["--skill <id>", "--update"],
  },
  {
    command: "architect verify . --strict",
    title: "Hold the line",
    body: "Re-checks the project against .architect/baseline.json and fails when the violation count rises. Also checks TypeScript compilation, import resolution and circular dependencies. Existing debt stays; new debt does not.",
    flags: ["--phase <n>", "--json"],
  },
];

export function Pipeline() {
  return (
    <section className="max-w-280 mx-auto px-6 py-32">
      <div className="mb-16 max-w-3xl">
        <h2 className="text-4xl md:text-5xl font-serif mb-4">Three commands.</h2>
        <p className="text-lg text-muted leading-relaxed">
          Architect matches your project to its stack blueprint, then evaluates that
          blueprint&apos;s rules against every file. The blueprint is data, so adding a rule
          means writing YAML, not TypeScript.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {COMMANDS.map((cmd) => (
          <div
            key={cmd.command}
            className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 flex flex-col"
          >
            <div className="inline-block self-start bg-surface px-3 py-1.5 rounded-lg font-mono text-sm font-medium mb-4">
              {cmd.command}
            </div>
            <h3 className="text-xl font-serif mb-3">{cmd.title}</h3>
            <p className="text-muted text-sm leading-relaxed mb-6">{cmd.body}</p>
            <div className="mt-auto flex flex-wrap gap-2">
              {cmd.flags.map((flag) => (
                <code
                  key={flag}
                  className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded"
                >
                  {flag}
                </code>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
