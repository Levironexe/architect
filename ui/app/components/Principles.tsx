const PRINCIPLES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
    title: "Separation of Concerns",
    description:
      "Your agent learns which code belongs where — routes, services, models, middleware — and enforces boundaries.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
      </svg>
    ),
    title: "SOLID Principles",
    description:
      "Single Responsibility, Open-Closed, Interface Segregation, and Dependency Injection — taught per stack.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h16M4 18h16" />
        <path d="M8 3v3M8 21v-3M16 3v3M16 21v-3" />
      </svg>
    ),
    title: "Layered Architecture",
    description:
      "Route → Controller → Service → Model. Every stack gets its own data flow blueprint with strict layer rules.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2v6l-2 2" />
        <path d="M15 2v6l2 2" />
        <path d="M12 17v5" />
        <circle cx="12" cy="14" r="3" />
      </svg>
    ),
    title: "DRY",
    description:
      "Duplicate code detected and eliminated. Shared logic extracted into reusable hooks, utilities, and modules.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        <circle cx="12" cy="16" r="1" />
      </svg>
    ),
    title: "Security Patterns",
    description:
      "Secrets from environment only. Auth middleware enforced. Input validated. RLS policies on every table.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
    ),
    title: "Error Handling",
    description:
      "Typed errors, fail-fast validation, no empty catch blocks. Resilient patterns from day one.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8M8 17h8" />
      </svg>
    ),
    title: "API Contracts",
    description:
      "Clean DTOs, separate input and output schemas, typed responses. Your API surface stays predictable.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
    title: "Testability",
    description:
      "Services accept plain data, not HTTP objects. Every layer independently testable without mocking the world.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20V10" />
        <path d="M18 20V4" />
        <path d="M6 20v-4" />
      </svg>
    ),
    title: "Config Management",
    description:
      "Environment validated at startup via schema. No scattered process.env reads. One source of truth.",
  },
];

export function Principles() {
  return (
    <section className="max-w-280 mx-auto px-6 py-24">
      <div className="mb-12">
        <span className="inline-block border border-gray-300 rounded-full px-4 py-1.5 text-xs font-medium text-muted mb-6">
          Principles
        </span>
        <h2 className="text-4xl md:text-5xl font-serif mb-4">
          Real engineering principles.
          <br />
          Not generic advice.
        </h2>
        <p className="text-lg text-muted leading-relaxed max-w-2xl">
          Every skill is grounded in battle-tested software engineering principles — your agent doesn{"'"}t guess, it follows the blueprint.
        </p>
      </div>

      <div className="bg-[#fafaf8] border border-gray-200 rounded-3xl shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3">
          {PRINCIPLES.map((principle, index) => (
            <div
              key={principle.title}
              className={[
                "p-8 md:p-10",
                index % 3 !== 2 ? "md:border-r md:border-gray-200" : "",
                index < 6 ? "border-b border-gray-200" : "",
                index >= 6 && index < PRINCIPLES.length - (PRINCIPLES.length % 3 || 3)
                  ? "border-b border-gray-200"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="text-muted mb-6">{principle.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{principle.title}</h3>
              <p className="text-sm text-muted leading-relaxed">
                {principle.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
