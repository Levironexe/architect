import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Quickstart } from "./components/Quickstart";
import { HowItWorks } from "./components/HowItWorks";
import { ProblemStatement } from "./components/ProblemStatement";
import { Pipeline } from "./components/Pipeline";
import { TwoSkillsSection } from "./components/TwoSkillsSection";
import { Principles } from "./components/Principles";
import { BuiltInSkills } from "./components/BuiltInSkills";
import { Footer } from "./components/Footer";

export default function Home() {
  return (
    <div className="font-sans bg-cream text-dark">
      <Navbar />
      <main>
        <Hero />
        <Quickstart />
        <HowItWorks />
        <ProblemStatement />
        <Pipeline />
        <TwoSkillsSection />
        <Principles />
        <BuiltInSkills />
      </main>
      <Footer />
    </div>
  );
}
