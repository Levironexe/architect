"use client";

import { useState } from "react";

const ROWS: { items: { name: string; slug: string }[]; dir: "left" | "right"; duration: number }[] = [
  {
    items: [
      { name: "React", slug: "react" },
      { name: "Next.js", slug: "nextdotjs" },
      { name: "Vue", slug: "vuedotjs" },
      { name: "Nuxt", slug: "nuxt" },
      { name: "Express", slug: "express" },
      { name: "NestJS", slug: "nestjs" },
      { name: "Fastify", slug: "fastify" },
      { name: "Hono", slug: "hono" },
      { name: "FastAPI", slug: "fastapi" },
      { name: "Django", slug: "django" },
      { name: "Flask", slug: "flask" },
      { name: "TypeScript", slug: "typescript" },
      { name: "Node.js", slug: "nodedotjs" },
      { name: "Bun", slug: "bun" },
      { name: "Tailwind", slug: "tailwindcss" },
    ],
    dir: "left",
    duration: 40,
  },
  {
    items: [
      { name: "Prisma", slug: "prisma" },
      { name: "Drizzle", slug: "drizzle" },
      { name: "MongoDB", slug: "mongodb" },
      { name: "PostgreSQL", slug: "postgresql" },
      { name: "Supabase", slug: "supabase" },
      { name: "Clerk", slug: "clerk" },
      { name: "Vercel", slug: "vercel" },
      { name: "Docker", slug: "docker" },
      { name: ".NET", slug: "dotnet" },
      { name: "GitHub Actions", slug: "githubactions" },
      { name: "Vitest", slug: "vitest" },
      { name: "Selenium", slug: "selenium" },
      { name: "Stripe", slug: "stripe" },
    ],
    dir: "right",
    duration: 40,
  },
];

function LogoItem({ name, slug }: { name: string; slug: string }) {
  return (
    <div
      className="group shrink-0 relative flex items-center justify-center w-16 h-16 cursor-default"
    >
      <img
        src={`/icons/${slug}.svg`}
        alt={name}
        width={47}
        height={47}
        className="object-contain w-11.75 h-11.75 transition-opacity duration-200 group-hover:opacity-0"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
      <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 font-mono text-xs font-medium text-dark text-center leading-tight px-1">
        {name}
      </span>
    </div>
  );
}

function MarqueeRow({
  items,
  dir,
  duration,
}: {
  items: { name: string; slug: string }[];
  dir: "left" | "right";
  duration: number;
}) {
  const [paused, setPaused] = useState(false);
  const items4x = [...items, ...items, ...items, ...items];

  return (
    <div
      className="overflow-hidden w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex gap-6 w-max"
        style={{
          animation: `${dir === "left" ? "marquee-left" : "marquee-right"} ${duration}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
          willChange: "transform",
        }}
      >
        {items4x.map((item, i) => (
          <LogoItem key={i} {...item} />
        ))}
      </div>
    </div>
  );
}

const AGENTS = [
  {
    name: "Claude Code",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
      </svg>
    ),
  },
  {
    name: "Cursor",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
      </svg>
    ),
  },
  {
    name: "Windsurf",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M23.55 5.067c-1.2038-.002-2.1806.973-2.1806 2.1765v4.8676c0 .972-.8035 1.7594-1.7597 1.7594-.568 0-1.1352-.286-1.4718-.7659l-4.9713-7.1003c-.4125-.5896-1.0837-.941-1.8103-.941-1.1334 0-2.1533.9635-2.1533 2.153v4.8957c0 .972-.7969 1.7594-1.7596 1.7594-.57 0-1.1363-.286-1.4728-.7658L.4076 5.1598C.2822 4.9798 0 5.0688 0 5.2882v4.2452c0 .2147.0656.4228.1884.599l5.4748 7.8183c.3234.462.8006.8052 1.3509.9298 1.3771.313 2.6446-.747 2.6446-2.0977v-4.893c0-.972.7875-1.7593 1.7596-1.7593h.003a1.798 1.798 0 0 1 1.4718.7658l4.9723 7.0994c.4135.5905 1.05.941 1.8093.941 1.1587 0 2.1515-.9645 2.1515-2.153v-4.8948c0-.972.7875-1.7594 1.7596-1.7594h.194a.22.22 0 0 0 .2204-.2202v-4.622a.22.22 0 0 0-.2203-.2203Z" />
      </svg>
    ),
  },
  {
    name: "GitHub Copilot",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02 5.937 22.02.939 18.492.078 16.997A.641.641 0 0 1 0 16.741v-2.869a.883.883 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256Zm-11.75-5.992h-.344a4.359 4.359 0 0 1-.355.508c-.77.947-1.918 1.492-3.508 1.492-1.725 0-2.989-.359-3.782-1.259a2.137 2.137 0 0 1-.085-.104L4 11.746v6.585c1.435.779 4.514 2.179 8 2.179 3.486 0 6.565-1.4 8-2.179v-6.585l-.098-.104s-.033.045-.085.104c-.793.9-2.057 1.259-3.782 1.259-1.59 0-2.738-.545-3.508-1.492a4.359 4.359 0 0 1-.355-.508Zm2.328 3.25c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm-5 0c.549 0 1 .451 1 1v2c0 .549-.451 1-1 1-.549 0-1-.451-1-1v-2c0-.549.451-1 1-1Zm3.313-6.185c.136 1.057.403 1.913.878 2.497.442.544 1.134.938 2.344.938 1.573 0 2.292-.337 2.657-.751.384-.435.558-1.15.558-2.361 0-1.14-.243-1.847-.705-2.319-.477-.488-1.319-.862-2.824-1.025-1.487-.161-2.192.138-2.533.529-.269.307-.437.808-.438 1.578v.021c0 .265.021.562.063.893Zm-1.626 0c.042-.331.063-.628.063-.894v-.02c-.001-.77-.169-1.271-.438-1.578-.341-.391-1.046-.69-2.533-.529-1.505.163-2.347.537-2.824 1.025-.462.472-.705 1.179-.705 2.319 0 1.211.175 1.926.558 2.361.365.414 1.084.751 2.657.751 1.21 0 1.902-.394 2.344-.938.475-.584.742-1.44.878-2.497Z" />
      </svg>
    ),
  },
];

export function BuiltInSkills() {
  return (
    <section className="bg-cream py-32 px-6 overflow-hidden">
      <div className="max-w-280 mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-serif mb-4">Built-in Skills</h2>
          <p className="text-muted max-w-xl mx-auto">
            Skills follow the open Agent Skills standard — a SKILL.md file per stack with detection rules, folder structure blueprints, and anti-pattern guidance. Community-extensible.
          </p>
        </div>

        <div
          className="relative py-2 my-8"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 20%, black 90%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 20%, black 90%, transparent 100%)",
          }}
        >
          <div className="flex flex-col gap-4">
            {ROWS.map((row, i) => (
              <MarqueeRow key={i} {...row} />
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <span className="text-xs font-bold uppercase tracking-widest text-muted shrink-0">
              Compatible with
            </span>
            <div className="flex items-center gap-5">
              {AGENTS.map(({ name, icon }) => (
                <div key={name} title={name} className="text-dark opacity-60 hover:opacity-100 transition-opacity duration-200 cursor-default">
                  {icon}
                </div>
              ))}
            </div>
          </div>
          <span className="text-sm italic text-muted">
            Our skill library is expanding
          </span>
        </div>
      </div>
    </section>
  );
}
