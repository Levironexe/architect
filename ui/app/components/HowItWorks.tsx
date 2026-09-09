const STEPS = [
  {
    n: "1",
    title: "Detect",
    body: "Walks the project directory, respecting .gitignore, and detects the stack from package.json and file conventions. Nothing leaves your machine.",
  },
  {
    n: "2",
    title: "Check",
    body: "Parses every TypeScript file and evaluates the blueprint's eleven rules against it - imports, directives, calls and layer boundaries. Deterministic, no model call.",
  },
  {
    n: "3",
    title: "Report",
    body: "Prints each violation with its file, line, rule id and the move that fixes it. Exits 1 on anything critical, so it fails CI as-is.",
  },
];

export function HowItWorks() {
  return (
    <section className="max-w-280 mx-auto px-6 py-32">
      <div className="text-center mb-20">
        <h2 className="text-4xl md:text-5xl font-serif mb-6">Rescue existing projects.</h2>
        <p className="text-xl text-muted max-w-2xl mx-auto">
          Architect is for the developer who already has a messy project. It&apos;s the ER room, not the gym.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-12 gap-y-16">
        {STEPS.map((step) => (
          <div key={step.n} className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full border border-gray-200 flex items-center justify-center mb-6 text-xl font-serif bg-white shadow-sm leading-0">
              {step.n}
            </div>
            <h3 className="text-2xl font-serif mb-4">{step.title}</h3>
            <p className="text-muted leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
