const RULES: { id: string; severity: "critical" | "warning"; when: string }[] = [
  { id: "direct_db_in_page", severity: "critical", when: "A database client is imported in page.tsx or layout.tsx" },
  { id: "direct_db_in_route", severity: "critical", when: "A database client is imported in route.ts" },
  { id: "leaked_server_secret", severity: "critical", when: "A 'use client' file reads a non-NEXT_PUBLIC_ env var" },
  { id: "illegal_import", severity: "critical", when: "components/ imports from app/" },
  { id: "use_client_everywhere", severity: "warning", when: "'use client' sits on a layout" },
  { id: "client_data_fetching_by_default", severity: "warning", when: "A client component fetches in useEffect" },
  { id: "server_action_throws", severity: "warning", when: "A Server Action throws instead of returning a result" },
  { id: "scattered_process_env", severity: "warning", when: "process.env is read outside lib/config.ts" },
  { id: "alert_for_errors", severity: "warning", when: "alert() is used to show an error" },
  { id: "oversized_extraction", severity: "warning", when: "A file exceeds 300 LOC" },
  { id: "missing_layer", severity: "warning", when: "A required directory from the blueprint does not exist" },
];

export function BuiltInSkills() {
  return (
    <section className="bg-cream py-32 px-6 overflow-hidden">
      <div className="max-w-280 mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-serif mb-4">The rules</h2>
          <p className="text-muted max-w-2xl mx-auto">
            One stack blueprint, eleven rules. Each one is a{" "}
            <code className="font-mono text-sm">detect:</code> block in a SKILL.md file — data,
            not TypeScript — so adding a rule means writing YAML and two fixtures.
          </p>
        </div>

        <div className="max-w-4xl mx-auto rounded-4xl border border-gray-200 bg-white overflow-hidden">
          {RULES.map((rule, index) => (
            <div
              key={rule.id}
              className={`flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-6 px-6 py-4 ${
                index === 0 ? "" : "border-t border-gray-100"
              }`}
            >
              <span
                className={`text-xs font-bold uppercase tracking-widest shrink-0 w-20 ${
                  rule.severity === "critical" ? "text-red-700" : "text-amber-700"
                }`}
              >
                {rule.severity}
              </span>
              <code className="font-mono text-sm text-dark shrink-0 sm:w-72">{rule.id}</code>
              <span className="text-sm text-gray-600">{rule.when}</span>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div id="supported-agents" className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-widest text-muted shrink-0">
              Agent integration
            </span>
            <div className="flex items-center gap-3 text-dark opacity-70">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6" aria-hidden="true">
                <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
              </svg>
              <span className="text-sm">Claude Code</span>
            </div>
          </div>
          <span className="text-sm italic text-muted">
            Next.js App Router + TypeScript only
          </span>
        </div>
      </div>
    </section>
  );
}
