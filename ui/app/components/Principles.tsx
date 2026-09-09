/**
 * The only place the landing page enumerates rules. Every row names a rule id
 * that exists in the blueprint; `architect check --list-rules` is the source of
 * truth and this list must match it.
 */
const RULES: { id: string; severity: "critical" | "warning"; when: string }[] = [
  { id: "direct_db_in_page", severity: "critical", when: "A database client is imported in page.tsx or layout.tsx — directly, or one hop away through a workspace package or local file" },
  { id: "direct_db_in_route", severity: "critical", when: "A database client is imported in route.ts" },
  { id: "leaked_server_secret", severity: "critical", when: "A 'use client' file reads a non-NEXT_PUBLIC_ env var" },
  { id: "illegal_import", severity: "critical", when: "components/ imports from app/" },
  { id: "use_client_everywhere", severity: "warning", when: "'use client' sits on a layout" },
  { id: "client_data_fetching_by_default", severity: "warning", when: "A client component loads data with a GET fetch inside useEffect" },
  { id: "server_action_throws", severity: "warning", when: "A Server Action throws instead of returning a result" },
  { id: "scattered_process_env", severity: "warning", when: "process.env is read outside lib/config.ts, within the app's own layers" },
  { id: "alert_for_errors", severity: "warning", when: "alert() is used to show an error" },
  { id: "oversized_extraction", severity: "warning", when: "A file exceeds 300 lines (test files exempt)" },
  { id: "missing_layer", severity: "warning", when: "A required directory from the blueprint does not exist" },
];

export function Principles() {
  return (
    <section id="the-rules" className="max-w-280 mx-auto px-6 py-24">
      <div className="mb-10 max-w-3xl">
        <span className="inline-block border border-gray-300 rounded-full px-4 py-1.5 text-xs font-medium text-muted mb-6">
          The rules
        </span>
        <h2 className="text-4xl md:text-5xl font-serif mb-4">
          Eleven rules.
          <br />
          Every one of them deterministic.
        </h2>
        <p className="text-lg text-muted leading-relaxed">
          No model call, no heuristics, no score out of a hundred. Ten are{" "}
          <code className="font-mono text-base bg-gray-100 px-1.5 py-0.5 rounded">detect:</code>{" "}
          blocks in the stack blueprint, matched against a real parse of your code; the
          eleventh comes from the directories the blueprint requires. Run{" "}
          <code className="font-mono text-base bg-gray-100 px-1.5 py-0.5 rounded">architect check --list-rules</code>{" "}
          to print this list from the blueprint itself.
        </p>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {RULES.map((rule, index) => (
          <div
            key={rule.id}
            className={[
              "grid grid-cols-1 md:grid-cols-[6rem_18rem_1fr] gap-x-6 gap-y-1 items-baseline px-6 py-4",
              index === 0 ? "" : "border-t border-gray-100",
            ].join(" ")}
          >
            <span
              className={[
                "text-[11px] font-bold uppercase tracking-widest",
                rule.severity === "critical" ? "text-red-700" : "text-amber-700",
              ].join(" ")}
            >
              {rule.severity}
            </span>
            <code className="font-mono text-sm text-dark">{rule.id}</code>
            <span className="text-sm text-gray-600">{rule.when}</span>
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted max-w-3xl">
        One further rule,{" "}
        <code className="font-mono text-xs">auth_mechanism_mismatch</code>, ships in the
        blueprint as guidance for a coding agent but is never reported by{" "}
        <code className="font-mono text-xs">check</code> — it needs judgement a static
        matcher would get wrong. Silence any rule with{" "}
        <code className="font-mono text-xs">--ignore</code> or an{" "}
        <code className="font-mono text-xs">architect-ignore-next-line</code> comment.
      </p>
    </section>
  );
}
