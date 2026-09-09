export function Quickstart() {
  return (
    <section className="max-w-280 mx-auto px-6 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-6 items-end mb-10">
        <div>
          <h2 className="text-4xl md:text-5xl font-serif text-balance">One command. No setup.</h2>
        </div>
        <div>
          <p className="text-lg text-muted leading-relaxed mb-5">
            No install, no config file, no API key. Architect parses your TypeScript
            locally and checks it against the Next.js App Router blueprint. Every rule is
            deterministic — there is no model call, and nothing leaves your machine.
          </p>
          <a href="#the-rules" className="inline-flex items-center text-dark font-medium border-b border-dark pb-0.5 hover:text-muted hover:border-muted transition-colors">
            See the rules
          </a>
        </div>
      </div>

      {/* 16:9 master rendered at 1920×1080; full container width keeps the terminal text legible. */}
      <video
        className="w-full aspect-video rounded-2xl shadow-2xl border border-gray-800 bg-black"
        controls
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/demo-poster.jpg"
        aria-label="architect check finding violations in a Next.js project, then verify failing the build on a regression"
      >
        <source src="/demo.mp4" type="video/mp4" />
      </video>
    </section>
  );
}
