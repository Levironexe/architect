"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type Easing, motion, type Transition } from "motion/react";
import { InstallCommand } from "../install-command";

const ARCHITECT_LETTERS = "Architect".split("");

const ARCHITECT_STYLES = [
  {
    id: "default-random",
    render: (letters: string[]) => ["#FF5E1A", "#2B4FE8", "#A020F0", "#22C55E", "#FF5E1A", "#0EA5E9", "#FACC15", "#FF5E1A", "#2DD4BF"].map((color, index) => ({
      letter: letters[index],
      style: { color },
    })),
  },
  {
    id: "rainbow",
    render: (letters: string[]) => ["#FF5E1A", "#F97316", "#FACC15", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6"].map((color, index) => ({
      letter: letters[index],
      style: { color },
    })),
  },
  {
    id: "cool",
    render: (letters: string[]) => ["#2DD4BF", "#38BDF8", "#10B981", "#3B82F6", "#14B8A6", "#0EA5E9", "#06B6D4", "#22C55E", "#2563EB"].map((color, index) => ({
      letter: letters[index],
      style: { color },
    })),
  },
  {
    id: "hot",
    render: (letters: string[]) => ["#F97316", "#B45309", "#EF4444", "#DC2626", "#C2410C", "#F59E0B", "#991B1B", "#FB7185", "#EA580C"].map((color, index) => ({
      letter: letters[index],
      style: { color },
    })),
  },
  {
    id: "outline",
    render: (letters: string[]) => letters.map((letter) => ({
      letter,
      style: {
        color: "transparent",
        WebkitTextStroke: "1.5px #111111",
        WebkitTextFillColor: "transparent",
      },
    })),
  },
] as const;

const HERO_STYLE_STORAGE_KEY = "architect.hero.style-index";
const FIRST_LOAD_STYLE_INDEX = 2;

function pickDifferentStyleIndex(previousIndex: number, styleCount: number) {
  if (styleCount <= 1) {
    return 0;
  }

  let nextIndex = previousIndex;
  while (nextIndex === previousIndex) {
    nextIndex = Math.floor(Math.random() * styleCount);
  }

  return nextIndex;
}

const BLUR_FROM = { filter: "blur(10px)", opacity: 0, y: -50 };
const BLUR_STEPS = [
  { filter: "blur(5px)", opacity: 0.5, y: 5 },
  { filter: "blur(0px)", opacity: 1, y: 0 },
];
const BLUR_DELAY_MS = 80;
const BLUR_STEP_DURATION = 0.25;
const BLUR_TIMES = [0, 0.5, 1];
const BLUR_EASING: Easing = (t: number) => t;

export function Hero() {
  const [styleIndex, setStyleIndex] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let previousIndex: number | null = null;

    try {
      const storedValue = window.localStorage.getItem(HERO_STYLE_STORAGE_KEY);
      if (storedValue !== null) {
        const parsed = Number(storedValue);
        if (Number.isInteger(parsed) && parsed >= 0 && parsed < ARCHITECT_STYLES.length) {
          previousIndex = parsed;
        }
      }
    } catch (e) {
      // Ignore storage read failures.
    }

    const nextStyleIndex =
      previousIndex === null
        ? FIRST_LOAD_STYLE_INDEX
        : pickDifferentStyleIndex(previousIndex, ARCHITECT_STYLES.length);

    setStyleIndex(nextStyleIndex);

    try {
      window.localStorage.setItem(HERO_STYLE_STORAGE_KEY, String(nextStyleIndex));
    } catch (e) {
      // Ignore storage write failures.
    }
  }, []);

  const selectedStyle = ARCHITECT_STYLES[styleIndex ?? FIRST_LOAD_STYLE_INDEX];
  const wordmark = useMemo(() => selectedStyle.render(ARCHITECT_LETTERS), [selectedStyle]);

  return (
    <header ref={headerRef} className="max-w-5xl mx-auto text-center px-6 min-h-screen flex flex-col items-center justify-center">
      <h1
        className="text-6xl md:text-8xl font-serif mb-6 tracking-tightest leading-none flex"
        aria-label="Architect"
      >
        {wordmark.map(({ letter, style }, index) => {
          const animateKeyframes = {
            filter: [BLUR_FROM.filter, ...BLUR_STEPS.map(s => s.filter)],
            opacity: [BLUR_FROM.opacity, ...BLUR_STEPS.map(s => s.opacity)],
            y: [BLUR_FROM.y, ...BLUR_STEPS.map(s => s.y)],
          };
          const transition: Transition = {
            duration: BLUR_STEP_DURATION * 2,
            times: BLUR_TIMES,
            delay: (index * BLUR_DELAY_MS) / 1000,
            ease: BLUR_EASING,
          };
          return (
            <motion.span
              key={`${selectedStyle.id}-${letter}-${index}`}
              initial={BLUR_FROM}
              animate={inView && styleIndex !== null ? animateKeyframes : BLUR_FROM}
              transition={transition}
              style={{ ...style, display: "inline-block", willChange: "transform, filter, opacity" }}
            >
              {letter}
            </motion.span>
          );
        })}
      </h1>
      <h2 className="text-3xl md:text-5xl font-serif text-dark mb-8 leading-tight">
        Best practices for your stack.<br />Anti-patterns caught. Zero config.
      </h2>
      <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10 font-normal leading-relaxed">
        Point it at an existing vibe-coded project, pick your agent, and Architect installs three slash commands that teach your agent the best practices, separation rules, and anti-patterns for your exact stack.
      </p>
      <div className="flex justify-center mb-8">
        <InstallCommand />
      </div>
      {/* <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button className="bg-dark text-white px-8 py-3.5 rounded-full font-medium hover:bg-gray-800 transition-colors w-full sm:w-auto">
          Get Started
        </button>
        <a href={"/docs"} className="bg-surface text-dark px-8 py-3.5 rounded-full font-medium hover:bg-gray-200 transition-colors w-full sm:w-auto flex items-center justify-center">
          Read the Docs <span className="ml-2 text-muted">→</span>
        </a>
      </div> */}
    </header>
  );
}
