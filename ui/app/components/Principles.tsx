/**
 * Every entry names the rule that enforces it. If a rule is removed from the
 * blueprint, its card must go too — nothing here describes behaviour architect
 * does not actually check. `architect check --list-rules` is the source of truth.
 */
const RULES = [
  {
    group: "Data access",
    severity: "critical" as const,
    rules: ["direct_db_in_page", "direct_db_in_route"],
    description:
      "A database client imported straight into a page, layout or route handler. Queries belong in lib/, where a Server Action or another route can reuse them.",
  },
  {
    group: "Layer direction",
    severity: "critical" as const,
    rules: ["illegal_import"],
    description:
      "components/ importing from app/. Components are shared leaves: routes depend on them, never the other way round.",
  },
  {
    group: "Server/client boundary",
    severity: "critical" as const,
    rules: ["leaked_server_secret"],
    description:
      "A 'use client' file reading a server-only environment variable. NEXT_PUBLIC_ and NODE_ENV are excluded — they are inlined at build time.",
  },
  {
    group: "Client bundle size",
    severity: "warning" as const,
    rules: ["use_client_everywhere", "client_data_fetching_by_default"],
    description:
      "'use client' on a layout drags the whole subtree into the client bundle, and a client component fetching in useEffect forfeits server rendering.",
  },
  {
    group: "Configuration",
    severity: "warning" as const,
    rules: ["scattered_process_env"],
    description:
      "process.env read outside lib/config.ts. Test files and tool configs are exempt — reading env there is correct.",
  },
  {
    group: "Error handling",
    severity: "warning" as const,
    rules: ["server_action_throws", "alert_for_errors"],
    description:
      "A Server Action that throws instead of returning a typed result, or alert() standing in for real error UI.",
  },
  {
    group: "Structure",
    severity: "warning" as const,
    rules: ["oversized_extraction", "missing_layer"],
    description:
      "A file past 300 LOC doing several jobs, or a directory the blueprint requires that does not exist yet.",
  },
];

export function Principles() {
  return (
    <section id="the-rules" className="max-w-280 mx-auto px-6 py-24">
      <div className="mb-12">
        <span className="inline-block border border-gray-300 rounded-full px-4 py-1.5 text-xs font-medium text-muted mb-6">
          The rules
        </span>
        <h2 className="text-4xl md:text-5xl font-serif mb-4">
          Ten rules.
          <br />
          Every one of them deterministic.
        </h2>
        <p className="text-lg text-muted leading-relaxed max-w-2xl">
          No model call, no heuristics, no score out of a hundred. Each rule is a{" "}
          <code className="font-mono text-base bg-gray-100 px-1.5 py-0.5 rounded">detect:</code>{" "}
          block in the stack blueprint, matched against a real parse of your code. Run{" "}
          <code className="font-mono text-base bg-gray-100 px-1.5 py-0.5 rounded">architect check --list-rules</code>{" "}
          to print this list from the blueprint itself.
        </p>
      </div>

      <div className="bg-[#fafaf8] border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
        {RULES.map((entry, index) => (
          <div
            key={entry.group}
            className={[
              "p-8 md:p-10 flex flex-col md:flex-row md:items-baseline gap-4 md:gap-10",
              index < RULES.length - 1 ? "border-b border-gray-200" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="md:w-64 shrink-0">
              <div className="flex items-baseline gap-3">
                <h3 className="text-lg font-semibold">{entry.group}</h3>
                <span
                  className={[
                    "text-[10px] font-bold uppercase tracking-widest",
                    entry.severity === "critical" ? "text-red-700" : "text-amber-700",
                  ].join(" ")}
                >
                  {entry.severity}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {entry.rules.map((rule) => (
                  <code key={rule} className="font-mono text-xs text-muted">
                    {rule}
                  </code>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted leading-relaxed flex-1">{entry.description}</p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted">
        One further rule,{" "}
        <code className="font-mono text-xs">auth_mechanism_mismatch</code>, ships in the
        blueprint as guidance for a coding agent but is never reported by{" "}
        <code className="font-mono text-xs">check</code> — it needs judgement a static
        matcher would get wrong.
      </p>
    </section>
  );
}
